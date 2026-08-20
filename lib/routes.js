const crypto = require('crypto');
const { config, saveConfig } = require('./config');
const { state, saveSummaryHistory } = require('./state');
const {
  DEFAULT_REIMU_BASE,
  DEFAULT_REIMU_RULES,
  DEFAULT_MARISA_BASE,
  DEFAULT_MARISA_RULES,
  DEFAULT_REIMU_PERSONA,
  DEFAULT_MARISA_PERSONA,
  DEFAULT_CANON_REIMU,
  DEFAULT_CANON_MARISA,
  DEFAULT_CANON_WORLD,
  DEFAULT_CANON_PAIR,
  DEFAULT_CANON_NOTES,
  ALIVE_DIALOGUE_RULES,
  KOURINDOU_STYLE_REF,
  SUMMARIZE_SYSTEM
} = require('./personas');
const { timePeriodLabel } = require('./time');
const { handleGift, refreshWeather, weatherInjectionText } = require('./ambient');
const { advanceSceneState, sceneStateText, displaySceneText, updateSceneNote } = require('./scene');
const {
  resolveAiEndpoint,
  buildMessages,
  canonTextFor,
  callAI,
  selfCheckReply,
  stripSelfNamePrefix,
  callBatchAI,
  parseBatchReply,
  dedupeLines,
  speakerName
} = require('./ai');
const { startAutoChat, stopAutoChat } = require('./autochat');
const data = require('./data');
const { agentDefaults } = require('./agents');

// ---------- HTTP ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error('请求不是合法的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(req, res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }, baseHeaders(req)));
  res.end(body);
}

// ---------- 公开部署加固：CORS 与按访问者限流 ----------
function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (fwd) return fwd;
  return req.socket.remoteAddress || 'unknown';
}

const rateBuckets = new Map();
function rateLimit(req, pathname) {
  const perMin = Number(config.rateLimitPerMin) || 0;
  if (perMin <= 0) return null;
  if (pathname !== '/api/chat' && pathname !== '/api/chat/batch' && pathname !== '/api/summarize' && pathname !== '/api/models') return null;
  const ip = clientIp(req);
  const now = Date.now();
  const win = rateBuckets.get(ip) || { start: now, count: 0 };
  if (now - win.start >= 60000) {
    win.start = now;
    win.count = 0;
  }
  win.count++;
  rateBuckets.set(ip, win);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (now - v.start >= 60000) rateBuckets.delete(k);
    }
  }
  if (win.count > perMin) {
    return { status: 429, error: `请求太频繁了，请 ${Math.ceil((win.start + 60000 - now) / 1000)} 秒后再试` };
  }
  return null;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) {
    if (now - v.start >= 60000) rateBuckets.delete(k);
  }
}, 60000);

function baseHeaders(req) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin'
  };
  const origin = String(req.headers.origin || '');
  if (origin && /^https?:\/\//.test(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return headers;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function candidatesView(voterId) {
  return state.candidates.map((c) => ({
    id: c.id,
    text: c.text,
    votes: c.votes.size,
    votedByMe: c.votes.has(voterId || '')
  }));
}

async function handleChat(req, res, body) {
  const {
    character,
    topic,
    history,
    apiKey,
    baseUrl,
    model,
    temperature,
    persona,
    summary,
    checkEnabled,
    checkApiKey,
    checkBaseUrl,
    checkModel,
    canon,
    canonMode,
    thinkingMode
  } = body;
  if (character !== 'reimu' && character !== 'marisa') {
    return sendJSON(req, res, 400, { error: '缺少发言人（character）参数' });
  }
  const resolved = resolveAiEndpoint({
    apiKey,
    baseUrl,
    missingKeyMsg: config.aiEnabled
      ? '还没有配置 AI Key：请在设置里填入自己的 API Key，或在 config.json 里配置 DeepSeek Key。'
      : '内置 AI 已被管理员关闭，当前只能使用演示台词。'
  });
  if (resolved.error) return sendJSON(req, res, 400, { error: resolved.error });
  try {
    const personaText = persona || (character === 'marisa' ? config.personaMarisa : config.personaReimu);
    const canonText = canonTextFor({
      character,
      topic,
      history,
      custom: canonMode === 'custom' ? canon : ''
    });
    const messages = buildMessages({
      character,
      topic,
      history,
      persona: personaText,
      summary: summary || undefined,
      canon: canonText
    });
    let reply = await callAI(resolved.key, resolved.baseUrl, model || config.model, messages, temperature, 300, false, thinkingMode);
    if (checkEnabled && checkApiKey) {
      try {
        reply = await selfCheckReply({
          persona: personaText,
          topic,
          history,
          reply,
          check: { apiKey: checkApiKey, baseUrl: checkBaseUrl, model: checkModel },
          canon: canonText
        });
      } catch (err) {
        console.error('自查失败，保留原台词：', err.message);
      }
    }
    reply = stripSelfNamePrefix(reply, character) || reply;
    sendJSON(req, res, 200, { reply });
  } catch (err) {
    sendJSON(req, res, 502, { error: `调用 AI 失败：${err.message}` });
  }
}

async function handleChatBatch(req, res, body) {
  const {
    character,
    topic,
    history,
    apiKey,
    baseUrl,
    model,
    temperature,
    personas,
    summary,
    checkEnabled,
    checkApiKey,
    checkBaseUrl,
    checkModel,
    canon,
    canonMode,
    turns,
    thinkingMode
  } = body;
  if (character !== 'reimu' && character !== 'marisa') {
    return sendJSON(req, res, 400, { error: '缺少发言人（character）参数' });
  }
  const resolved = resolveAiEndpoint({
    apiKey,
    baseUrl,
    missingKeyMsg: config.aiEnabled
      ? '还没有配置 AI Key：请在设置里填入自己的 API Key，或在 config.json 里配置 DeepSeek Key。'
      : '内置 AI 已被管理员关闭，当前只能使用演示台词。'
  });
  if (resolved.error) return sendJSON(req, res, 400, { error: resolved.error });
  const count = Math.min(24, Math.max(2, Number(turns) || 4));
  // 批量输出要求句数精确，温度上限 0.75（太高容易漏句），创造性由单轮对谈承担
  const pReimu = (personas && personas.reimu) || config.personaReimu;
  const pMarisa = (personas && personas.marisa) || config.personaMarisa;
  const canonText = canonTextFor({
    character,
    topic,
    history,
    custom: canonMode === 'custom' ? canon : ''
  });
  try {
    const messages = [
      { role: 'system', content: '你是幻想乡同人对话的编剧。下面会提供两位主角的人设、一设资料和当前话题，请以她们的身份编写接下来连续的多句对话台词。' },
      { role: 'system', content: `【博丽灵梦·人设】\n${pReimu}` },
      { role: 'system', content: `【雾雨魔理沙·人设】\n${pMarisa}` },
        { role: 'system', content: ALIVE_DIALOGUE_RULES },
      { role: 'system', content: KOURINDOU_STYLE_REF }
    ];
    if (canonText) messages.push({ role: 'system', content: `【一设参考】\n${canonText}` });
    if (summary) messages.push({ role: 'system', content: `之前对话总结：${summary}` });
    if (!(history || []).length) {
      // 清空后的新一轮对话：不沿用上一轮的场景备注（自动闲聊的记忆不受影响）
      if (state.scene) state.scene.note = '';
    }
    advanceSceneState();
    const sceneText = sceneStateText();
    if (sceneText) messages.push({ role: 'system', content: sceneText });
    messages.push({ role: 'system', content: `现在是幻想乡的${timePeriodLabel()}（按真实世界时间）。你可以自然地呼应天色、作息与心情，但不要报出具体钟点和现实日期。` });
    messages.push({ role: 'system', content: weatherInjectionText() });
    messages.push({ role: 'system', content: `当前话题：${topic || '随便聊聊'}` });
    for (const m of (history || []).slice(-10)) {
      messages.push({ role: 'user', content: `${speakerName(m.speaker)}：${m.text}` });
    }
    messages.push({
      role: 'user',
      content: `请以 JSON 对象格式输出，格式必须严格为 {"lines":["台词一","台词二","台词三","台词四"]}，其中 lines 必须恰好包含 ${count} 个字符串，一条都不能少（先在心中列好 1 到 ${count} 的台词清单，再逐条完整输出；宁可每句短一点，也要把 ${count} 条写满；每句 1~3 句中文，口语自然，符合角色性格），第一句由${speakerName(character)}说，之后两人严格交替。每句都要有新内容，接住对方上一句的具体细节，不要重复上文中已经说过的话；要有甜甜的小剧情和心动细节，让情绪有来有回，不要公式化一问一答。只输出这个 JSON 对象，不要角色名前缀、不要任何解释；每句台词都直接以说话内容开头，严禁在台词开头写出说话人自己的名字（比如灵梦说的话绝不能以「灵梦」二字开头，魔理沙也不能以「魔理沙」开头）。`
    });
    const raw = await callBatchAI(resolved.key, resolved.baseUrl, model || config.model, messages, Math.min(Number(temperature) || 0.95, 0.75), Math.min(6000, Math.max(1600, count * 200)), thinkingMode);
    let lines = parseBatchReply(raw, count);
    if (!lines.length) throw new Error('批量生成返回空');
    lines = dedupeLines(lines, (history || []).slice(-10).map((m) => m.text));
    updateSceneNote(lines);
    let sp = character;
    const replies = lines.map((text) => {
      const item = { speaker: sp, text: stripSelfNamePrefix(text, sp) || text };
      sp = sp === 'marisa' ? 'reimu' : 'marisa';
      return item;
    });
    if (checkEnabled && checkApiKey) {
      for (const r of replies) {
        try {
          r.text = await selfCheckReply({
            persona: r.speaker === 'marisa' ? pMarisa : pReimu,
            topic,
            history,
            reply: r.text,
            check: { apiKey: checkApiKey, baseUrl: checkBaseUrl, model: checkModel },
            canon: canonText
          });
        } catch (_) {}
      }
    }
    sendJSON(req, res, 200, { replies });
  } catch (err) {
    sendJSON(req, res, 502, { error: `调用 AI 失败：${err.message}` });
  }
}
async function handleSummarize(req, res, body) {
  const { messages, topic, apiKey, baseUrl, model, summaryApiKey, summaryBaseUrl, summaryModel } = body;
  const list = Array.isArray(messages) ? messages.filter((m) => m && m.text) : [];
  if (!list.length) {
    return sendJSON(req, res, 400, { error: '没有可总结的对话内容' });
  }
  const resolved = resolveAiEndpoint({
    apiKey: summaryApiKey || apiKey,
    baseUrl: summaryBaseUrl || baseUrl,
    missingKeyMsg: config.aiEnabled
      ? '还没有可用的 API Key：请在设置里填自己的 Key，或确认 config.json 已配置 DeepSeek Key。'
      : '内置 AI 已被管理员关闭，无法自动总结。'
  });
  if (resolved.error) return sendJSON(req, res, 400, { error: resolved.error });
  try {
    const prompt = [
      { role: 'system', content: SUMMARIZE_SYSTEM },
      {
        role: 'user',
        content: `话题：${topic || '随便聊聊'}\n` + list.map((m) => `${speakerName(m.speaker)}：「${m.text}」`).join('\n')
      }
    ];
    const summary = await callAI(
      resolved.key,
      resolved.baseUrl,
      summaryModel || model || config.model,
      prompt,
      0.4
    );
    sendJSON(req, res, 200, { summary });
  } catch (err) {
    sendJSON(req, res, 502, { error: `自动总结失败：${err.message}` });
  }
}

async function handleModels(req, res, body) {
  const { apiKey, baseUrl } = body;
  const resolved = resolveAiEndpoint({
    apiKey,
    baseUrl,
    missingKeyMsg: config.aiEnabled
      ? '还没有可用的 API Key：请在设置里填自己的 Key，或确认 config.json 已配置 DeepSeek Key。'
      : '内置 AI 已被管理员关闭，无法获取模型列表。'
  });
  if (resolved.error) return sendJSON(req, res, 400, { error: resolved.error });
  try {
    const url = resolved.baseUrl + '/models';
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${resolved.key}` }
    });
    if (!resp.ok) {
      let detail = '';
      try {
        detail = (await resp.text()).slice(0, 200);
      } catch (_) {}
      throw new Error(`接口返回 ${resp.status}：${detail || '未知错误'}`);
    }
    const data = await resp.json();
    const models = [...new Set((data.data || []).map((m) => String(m.id || '')).filter(Boolean))].sort();
    if (!models.length) throw new Error('接口没有返回任何模型');
    sendJSON(req, res, 200, { models });
  } catch (err) {
    sendJSON(req, res, 502, { error: `获取模型列表失败：${err.message}` });
  }
}

function handleState(req, res, voterId) {
  sendJSON(req, res, 200, {
    aiEnabled: config.aiEnabled,
    autoChatEnabled: config.autoChatEnabled,
    twoAgentMode: config.twoAgentMode !== false,
    hasServerKey: !!config.deepseekApiKey,
    currentTopic: state.currentTopic,
    topicRoundSec: config.topicRoundSec,
    switchVotes: config.switchVotes,
    summarizeAfter: Number(config.summarizeAfter) || 0,
    summaryKeepRecent: Number(config.summaryKeepRecent) || 6,
    summaryStrength: String(config.summaryStrength || 'short'),
    ambientEvery: Number(config.ambientEvery) || 8,
    canonEnabled: config.canonEnabled !== false,
    canonSmart: config.canonSmart !== false,
    candidates: candidatesView(voterId),
    log: state.chatLog.slice(-60),
    sceneText: displaySceneText(),
    heartMoments: (state.heartMoments || []).slice(-2),
    weather: refreshWeather().kind,
    serverTime: Date.now()
  });
}

async function handleTopic(body) {
  const voterId = String(body.voterId || '').trim();
  const text = String(body.text || '').trim();
  if (!voterId || voterId.length > 64) return { status: 400, error: '缺少有效的观众身份' };
  if (!config.autoChatEnabled) return { status: 400, error: '自动闲聊未开启，暂时不能提议话题' };
  if (text.length < 2 || text.length > 40) return { status: 400, error: '话题长度需要在 2~40 字之间' };
  if (text === state.currentTopic) return { status: 400, error: '这个话题已经在聊了' };
  if (state.candidates.some((c) => c.text === text)) return { status: 400, error: '这个候选话题已经有人提过了' };
  if (state.candidates.length >= config.maxCandidates) return { status: 400, error: '候选池已满，稍后再试' };
  const now = Date.now();
  const last = state.lastProposal.get(voterId) || 0;
  if (now - last < config.proposalCooldownSec * 1000) {
    return { status: 429, error: '提议太频繁了，稍等一会儿再试' };
  }
  state.lastProposal.set(voterId, now);
  state.candidates.push({ id: state.nextId++, text, votes: new Set() });
  return { status: 200, candidates: candidatesView(voterId) };
}

function handleVote(body) {
  const voterId = String(body.voterId || '').trim();
  const topicId = Number(body.topicId);
  if (!voterId || voterId.length > 64) return { status: 400, error: '缺少有效的观众身份' };
  const candidate = state.candidates.find((c) => c.id === topicId);
  if (!candidate) return { status: 400, error: '候选话题不存在或已过期' };
  if (candidate.votes.has(voterId)) {
    candidate.votes.delete(voterId);
  } else {
    candidate.votes.add(voterId);
  }
  return { status: 200, candidates: candidatesView(voterId) };
}

async function handleAdmin(body) {
  const token = String(body.token || '');
  if (!safeEqual(token, config.adminToken)) {
    return { status: 403, error: '管理员口令不正确' };
  }
  const { action, enabled, strength } = body;
  if (action === 'ai') {
    config.aiEnabled = !!enabled;
    if (!config.aiEnabled) state.consecutiveErrors = 0;
    saveConfig();
  } else if (action === 'autochat') {
    config.autoChatEnabled = !!enabled;
    if (config.autoChatEnabled) {
      startAutoChat();
    } else {
      stopAutoChat();
    }
    saveConfig();
  } else if (action === 'twoagent') {
    config.twoAgentMode = !!enabled;
    saveConfig();
  } else if (action === 'summarystrength') {
    const ss = String(strength || '').toLowerCase();
    if (!['short', 'normal', 'long'].includes(ss)) {
      return { status: 400, error: '压缩强度必须是 short / normal / long' };
    }
    config.summaryStrength = ss;
    saveConfig();
  } else {
    return { status: 400, error: '未知的操作' };
  }
  return { status: 200, ok: true };
}

function handleAdminVerify(body) {
  const token = String(body.token || '');
  if (!safeEqual(token, config.adminToken)) {
    return { status: 403, error: '管理员口令不正确' };
  }
  return { status: 200, ok: true };
}

function handleManualPersonas() {
  return {
    status: 200,
    base: { reimu: DEFAULT_REIMU_BASE, marisa: DEFAULT_MARISA_BASE },
    rules: { reimu: DEFAULT_REIMU_RULES, marisa: DEFAULT_MARISA_RULES },
    full: { reimu: config.personaReimu, marisa: config.personaMarisa }
  };
}

function handleCanon() {
  return {
    status: 200,
    defaults: {
      reimu: DEFAULT_CANON_REIMU,
      marisa: DEFAULT_CANON_MARISA,
      world: DEFAULT_CANON_WORLD,
      pair: DEFAULT_CANON_PAIR,
      notes: DEFAULT_CANON_NOTES
    },
    server: {
      reimu: config.canonReimu,
      marisa: config.canonMarisa,
      world: config.canonWorld,
      pair: config.canonPair,
      notes: config.canonAiNotes
    },
    enabled: config.canonEnabled !== false,
    smart: config.canonSmart !== false,
    entries: data.getCanonEntries()
  };
}

// ---------- 双 agent 每角色提示词（数据层，adminToken 可改） ----------
function handleGetAgents() {
  return {
    status: 200,
    agents: { reimu: data.getAgent('reimu'), marisa: data.getAgent('marisa') },
    defaults: { reimu: agentDefaults('reimu'), marisa: agentDefaults('marisa') }
  };
}

function handleUpdateAgents(body) {
  const token = String(body.token || '');
  if (!safeEqual(token, config.adminToken)) {
    return { status: 403, error: '管理员口令不正确' };
  }
  const patch = body.agents;
  if (!patch || (!patch.reimu && !patch.marisa)) {
    return { status: 400, error: '缺少要修改的角色（agents.reimu / agents.marisa）' };
  }
  for (const ch of ['reimu', 'marisa']) {
    const p = patch[ch];
    if (!p) continue;
    const cur = data.getAgent(ch);
    if (p.base_prompt !== undefined) {
      const v = String(p.base_prompt).trim();
      if (v.length > 3000) return { status: 400, error: 'base_prompt 过长（最多 3000 字）' };
      cur.base_prompt = v;
    }
    if (p.goals !== undefined) {
      const v = String(p.goals).trim();
      if (v.length > 600) return { status: 400, error: 'goals 过长（最多 600 字）' };
      cur.goals = v;
    }
    if (p.memory_instructions !== undefined) {
      const v = String(p.memory_instructions).trim();
      if (v.length > 600) return { status: 400, error: 'memory_instructions 过长（最多 600 字）' };
      cur.memory_instructions = v;
    }
    if (p.few_shots !== undefined) {
      const arr = Array.isArray(p.few_shots)
        ? p.few_shots.map((s) => String(s).replace(/[「」]/g, '').trim()).filter(Boolean)
        : [];
      if (arr.length > 8 || arr.some((s) => s.length > 200)) {
        return { status: 400, error: 'few_shots 最多 8 条、每条最多 200 字' };
      }
      cur.few_shots = arr;
    }
    data.saveAgentRecord(ch, cur);
  }
  return {
    status: 200,
    ok: true,
    agents: { reimu: data.getAgent('reimu'), marisa: data.getAgent('marisa') },
    defaults: { reimu: agentDefaults('reimu'), marisa: agentDefaults('marisa') }
  };
}

// ---------- 每角色知识库（canon 条目增删改，adminToken 可改） ----------
function handleCanonWrite(body) {
  const token = String(body.token || '');
  if (!safeEqual(token, config.adminToken)) {
    return { status: 403, error: '管理员口令不正确' };
  }
  const { action } = body;
  if (action === 'add') {
    const entry = body.entry || {};
    const character = entry.character;
    if (!['reimu', 'marisa', 'shared'].includes(character)) {
      return { status: 400, error: 'character 必须是 reimu / marisa / shared' };
    }
    const category = String(entry.category || '').trim();
    if (!category || category.length > 20) return { status: 400, error: 'category 不能为空且最多 20 字' };
    const content = String(entry.content || '').trim();
    if (!content || content.length > 3000) return { status: 400, error: 'content 不能为空且最多 3000 字' };
    data.addCanonEntry({ character, category, content, sort: Number(entry.sort) || 0 });
  } else if (action === 'update') {
    if (!data.updateCanonEntry(body.id, body.entry || {})) return { status: 404, error: '条目不存在' };
  } else if (action === 'delete') {
    if (!data.deleteCanonEntry(body.id)) return { status: 404, error: '条目不存在' };
  } else {
    return { status: 400, error: '未知操作（add / update / delete）' };
  }
  return { status: 200, ok: true, entries: data.getCanonEntries() };
}

function handleAutoPersonas(body) {
  const token = String(body.token || '');
  const apiKey = String(body.apiKey || '').trim();
  const allowed = safeEqual(token, config.adminToken) || apiKey.length >= 8;
  if (!allowed) {
    return { status: 403, error: '自动闲聊人设仅管理员可改；或填上你自己的 API Key 后也可修改。' };
  }
  if (body.personas) {
    const reimu = String(body.personas.reimu || '').trim();
    const marisa = String(body.personas.marisa || '').trim();
    if (!reimu || !marisa) return { status: 400, error: '人设内容不能为空' };
    if (reimu.length > 3000 || marisa.length > 3000) {
      return { status: 400, error: '人设内容过长（单个最多 3000 字）' };
    }
    config.autoPersonaReimu = reimu;
    config.autoPersonaMarisa = marisa;
    saveConfig();
    // 同步写数据层 base_prompt，让双 agent 路径（buildAgentSystemPrompt）立即生效
    data.saveAgentRecord('reimu', Object.assign(data.getAgent('reimu'), { base_prompt: reimu }));
    data.saveAgentRecord('marisa', Object.assign(data.getAgent('marisa'), { base_prompt: marisa }));
  }
  return {
    status: 200,
    personas: { reimu: config.autoPersonaReimu, marisa: config.autoPersonaMarisa },
    defaults: { reimu: DEFAULT_REIMU_PERSONA, marisa: DEFAULT_MARISA_PERSONA }
  };
}

function handleGetSummaries() {
  return {
    status: 200,
    current: state.currentSummary || null,
    history: state.summaryHistory
  };
}

function handleUpdateSummary(id, body) {
  const content = String((body && body.content) || '').trim();
  if (!content) return { status: 400, error: '总结内容不能为空' };
  if (content.length > 2000) return { status: 400, error: '总结内容过长（最多 2000 字）' };
  const entry = state.summaryHistory.find((s) => s.id === id);
  if (!entry) return { status: 404, error: '总结不存在' };
  entry.content = content;
  entry.updatedAt = Date.now();
  if (state.currentSummary && state.currentSummary.id === id) {
    state.currentSummary.content = content;
    state.autoSummary = content;
  }
  saveSummaryHistory();
  return { status: 200, ok: true, current: state.currentSummary || null, history: state.summaryHistory };
}

function handleDeleteSummary(id) {
  const idx = state.summaryHistory.findIndex((s) => s.id === id);
  if (idx === -1) return { status: 404, error: '总结不存在' };
  state.summaryHistory.splice(idx, 1);
  if (state.currentSummary && state.currentSummary.id === id) {
    state.currentSummary = null;
    state.autoSummary = null;
  }
  saveSummaryHistory();
  return { status: 200, ok: true, current: state.currentSummary || null, history: state.summaryHistory };
}


// ---------- 手动对话历史 ----------
function publicManualSession(session) {
  return {
    id: session.id,
    title: session.title,
    topic: session.topic,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages
  };
}
function handleGetManuals() {
  const list = data.getManualSessions().map((s) => ({
    id: s.id,
    title: s.title,
    topic: s.topic,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    msgCount: s.messages.length,
    preview: s.messages.length ? String(s.messages[s.messages.length - 1].text).slice(0, 40) : ''
  }));
  return { status: 200, ok: true, sessions: list };
}
function handleCreateManual(body) {
  const session = data.createManualSession({ topic: body && body.topic, title: body && body.title });
  return { status: 200, ok: true, session: publicManualSession(session) };
}
function handleGetManual(id) {
  const session = data.getManualSession(id);
  if (!session) return { status: 404, ok: false, error: '未找到该对话' };
  return { status: 200, ok: true, session: publicManualSession(session) };
}
function handleAppendManual(id, body) {
  const session = data.appendManualMessages(id, body && body.messages);
  if (!session) return { status: 404, ok: false, error: '未找到该对话' };
  return { status: 200, ok: true, session: publicManualSession(session) };
}
function handleRenameManual(id, body) {
  const session = data.renameManualSession(id, body && body.title);
  if (!session) return { status: 404, ok: false, error: '未找到该对话' };
  return { status: 200, ok: true, session: { id: session.id, title: session.title } };
}
function handleDeleteManual(id) {
  const ok = data.deleteManualSession(id);
  if (!ok) return { status: 404, ok: false, error: '未找到该对话' };
  return { status: 200, ok: true };
}

module.exports = {
  readBody,
  sendJSON,
  clientIp,
  rateLimit,
  baseHeaders,
  safeEqual,
  candidatesView,
  handleChat,
  handleChatBatch,
  handleSummarize,
  handleModels,
  handleState,
  handleTopic,
  handleVote,
  handleAdmin,
  handleAdminVerify,
  handleManualPersonas,
  handleCanon,
  handleAutoPersonas,
  handleGetAgents,
  handleUpdateAgents,
  handleCanonWrite,
  handleGetSummaries,
  handleUpdateSummary,
  handleDeleteSummary,
  handleGetManuals,
  handleCreateManual,
  handleGetManual,
  handleAppendManual,
  handleRenameManual,
  handleDeleteManual
};
