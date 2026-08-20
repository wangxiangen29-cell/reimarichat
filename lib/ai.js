const { config } = require('./config');
const { state, lastSpeaker } = require('./state');
const { ALIVE_DIALOGUE_RULES, KOURINDOU_STYLE_REF, SELFCHECK_SYSTEM } = require('./personas');
const { timePeriodLabel, sleep } = require('./time');
const { weatherInjectionText, giftInjectionText } = require('./ambient');
const { advanceSceneState, sceneStateText, updateSceneNote } = require('./scene');
const { maybeDailyEvent, pendingEventText, heartMemoryText, catchHeartMoments } = require('./events');

// ---------- AI ----------

function speakerName(speaker) {
  if (speaker === 'marisa') return '魔理沙';
  if (speaker === 'user') return '旁白';
  return '灵梦';
}

const CANON_WORLD_KEYWORDS = [
  '红魔馆', '守矢神社', '雾之湖', '妖怪之山', '人间之里', '博丽神社',
  '魔法森林', '香霖堂', '迷途竹林', '永远亭', '月都', '天界', '地狱',
  '异变', '结界', '符卡', '宴会', '例大祭', '赛钱', '退治', '幻想乡'
];

function canonNeedsWorld(text) {
  const hay = String(text || '').toLowerCase();
  return CANON_WORLD_KEYWORDS.some((kw) => hay.includes(kw.toLowerCase()));
}

function canonTextFor({ character, topic, history, custom }) {
  if (custom) return String(custom || '').trim();
  if (config.canonEnabled === false) return '';
  const parts = [];
  const reimu = config.canonReimu;
  const marisa = config.canonMarisa;
  const speakerFirst = character === 'marisa';
  if (speakerFirst) {
    if (marisa) parts.push(`【魔理沙·一设】\n${marisa}`);
    if (reimu) parts.push(`【灵梦·一设】\n${reimu}`);
  } else {
    if (reimu) parts.push(`【灵梦·一设】\n${reimu}`);
    if (marisa) parts.push(`【魔理沙·一设】\n${marisa}`);
  }
  if (config.canonPair) parts.push(`【两人关系】\n${config.canonPair}`);
  if (config.canonAiNotes) parts.push(`【易错提醒】\n${config.canonAiNotes}`);
  const smart = config.canonSmart !== false;
  const contextText = `${topic || ''}\n${(history || []).map((m) => m && m.text).filter(Boolean).join('\n')}`;
  if (config.canonWorld && (!smart || canonNeedsWorld(contextText))) {
    parts.push(`【世界观】\n${config.canonWorld}`);
  }
  return parts.join('\n\n');
}



function buildMessages({ character, topic, history = [], persona, summary, canon }) {
  const isMarisa = character === 'marisa';
  const personaText = persona || (isMarisa ? config.autoPersonaMarisa : config.autoPersonaReimu);
  const selfName = isMarisa ? '魔理沙' : '灵梦';
  const messages = [
    { role: 'system', content: personaText },
  ];
  if (canon) {
    messages.push({
      role: 'system',
      content:
        `【一设参考资料】以下是东方Project官方设定的整理（一设），请作为事实依据融入角色与对话，不要与之冲突；不要把设定当话题直接讨论或解释：\n${canon}`
    });
  }
  if (summary) {
    messages.push({ role: 'system', content: `之前的对话总结：${summary}\n请在这个基础上自然地继续。` });
  }
  messages.push({
    role: 'system',
    content:
      `当前场景：你正在幻想乡和对方闲聊。话题背景：${topic || '随便聊聊'}\n` +
      `对话规则：顺着对方的上一句话自然地接下去，接住对方提到的具体细节，有来有回，可以吐槽、跑题或斗嘴，但必须保持角色性格；每次只说1~3句话；不要重复上文中已经说过的话，也不要复述对方的原句；口语自然，别像念稿；可以自然地写出甜甜的小剧情和心动细节（吃醋、照顾、靠近、小暧昧、口是心非），让对话更有糖分；不要提剧本、不要解释、不要跳出角色。\n` +
      `注意：对话中出现的「旁白」是场景描述或剧情事件，请自然地回应它，不要评价旁白本身。`
  });
  messages.push({ role: 'system', content: KOURINDOU_STYLE_REF });
  for (const item of (history || []).slice(-10)) {
    messages.push({ role: 'user', content: `${speakerName(item.speaker)}：「${String(item.text).trim()}」` });
  }
  messages.push({
    role: 'user',
    content: `现在轮到你（${selfName}）说话了，请以角色身份直接说出下一句台词，开头不要重复、也不要写出自己的名字（不要以「灵梦」或「魔理沙」自称），不要加引号。`
  });
  return messages;
}

function cleanReply(text) {
  return String(text || '')
    .trim()
    .replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDialogueLine(text) {
  let s = cleanReply(text);
  s = s.replace(/^(?:灵梦|魔理沙|旁白)\s*[:：]\s*/, '');
  s = s.replace(/^[-*•·]\s*/, '');
  s = s.replace(/^\d+[.、．]\s*/, '');
  return s.trim();
}

// 按发言人剥离“自己名字”前缀（防止“灵梦：”或整句“灵梦”混进台词；对方名字开头是正常称呼，不处理）
function stripSelfNamePrefix(text, speaker) {
  const self = speaker === 'marisa' ? '魔理沙' : '灵梦';
  let s = String(text || '').trim();
  const re = new RegExp('^' + self + '\\s*[:：,，。.、!！?？…~～ ]+');
  const m = s.match(re);
  if (m) s = s.slice(m[0].length).trim();
  return s;
}
function normalizeForCompare(text) {
  // 去掉空白与常见标点后再比较，避免“换了个标点就躲过去”的重复
  return String(text || '')
    .replace(/[\s，。！？、；：,.!?;:…—~～·「」『』""''（）()]/g, '')
    .toLowerCase();
}

function dedupeLines(lines, recentTexts) {
  const recentKeys = (recentTexts || []).map(normalizeForCompare).filter(Boolean);
  const seen = new Set(recentKeys);
  const out = [];
  for (const line of lines) {
    const key = normalizeForCompare(line);
    if (!key || seen.has(key)) continue;
    // 复述某条最近台词、再额外加几个字的“伪新句”也按重复处理
    const repeatsTail = recentKeys.some(
      (rk) => rk.length >= 4 && key.length > rk.length + 1 && key.startsWith(rk)
    );
    if (repeatsTail) continue;
    seen.add(key);
    out.push(line);
  }
  return out.length ? out : lines.slice(0);
}

const THINKING_MODES = ['none', 'low', 'high', 'max'];

function thinkingEffort(mode) {
  const m = String(mode || config.thinkingMode || 'none').toLowerCase();
  return THINKING_MODES.includes(m) ? m : 'none';
}

async function callAI(apiKey, baseUrl, model, messages, temperature, maxTokens = 300, jsonObject = false, thinking = 'none') {
  const url = String(baseUrl || config.baseUrl).replace(/\/+$/, '') + '/chat/completions';
  const payload = {
    model: model || config.model,
    messages,
    temperature: typeof temperature === 'number' ? temperature : 0.95,
    max_tokens: maxTokens
  };
  // 思考模式（DeepSeek 格式）：none 关闭思考；low/high/max 开启思考，
  // 同时发送 reasoning_effort 与 thinking.type=enabled，none 时不发这两个字段。
  // 推理内容会占用输出 token，因此顺带把 max_tokens 提到至少 800，避免挤掉正式台词。
  const effort = thinkingEffort(thinking);
  if (effort !== 'none') {
    payload.reasoning_effort = effort;
    payload.thinking = { type: 'enabled' };
    if (maxTokens < 800) payload.max_tokens = 800;
  }
  if (jsonObject) payload.response_format = { type: 'json_object' };
  // 对空内容、网络抖动、限流（429）与 5xx 做最多 3 次重试，缓解接口偶发波动
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await sleep(500 * attempt);
      console.warn('AI 调用重试 ' + (attempt + 1) + '/4：' + (lastErr && lastErr.message));
    }
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        let detail = '';
        try {
          detail = (await resp.text()).slice(0, 300);
        } catch (_) {}
        const status = resp.status;
        if (status === 429 || status >= 500) {
          lastErr = new Error('AI 接口返回 ' + status + '：' + (detail || '未知错误'));
          continue;
        }
        throw new Error('AI 接口返回 ' + status + '：' + (detail || '未知错误'));
      }
      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content ?? '';
      if (reply.trim()) return cleanReply(reply);
      lastErr = new Error('AI 返回了空内容，请重试');
    } catch (err) {
      const msg = String((err && err.message) || '');
      if (/fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(msg)) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('AI 调用失败');
}
let jsonModeUnsupported = false;
async function callBatchAI(apiKey, baseUrl, model, messages, temperature, maxTokens, thinking) {
  if (!jsonModeUnsupported) {
    try {
      return await callAI(apiKey, baseUrl, model, messages, temperature, maxTokens, true, thinking);
    } catch (err) {
      const msg = String((err && err.message) || '');
      // JSON 模式不受支持或反复返回空内容时，退回普通模式（解析层仍能容错）
      if (/response_format|json_object|json mode|空内容/i.test(msg)) {
        jsonModeUnsupported = true;
        console.warn('当前接口 JSON 模式不可靠，已退回普通模式');
      } else {
        throw err;
      }
    }
  }
  return callAI(apiKey, baseUrl, model, messages, temperature, maxTokens, false, thinking);
}

// 统一解析“用哪个 Key / 用哪个接口地址”。
// 关键安全约束：如果请求指定了自定义 baseUrl，但没带自己的 apiKey，
// 绝不能用服务器的内置 Key 去请求第三方地址（否则等于把内置 Key 外发）。
function resolveAiEndpoint({ apiKey, baseUrl, missingKeyMsg }) {
  const effectiveBase = String(baseUrl || config.baseUrl || '').replace(/\/+$/, '');
  const serverBase = String(config.baseUrl || '').replace(/\/+$/, '');
  const key = apiKey || (config.aiEnabled ? config.deepseekApiKey : '');
  if (!key) {
    return { error: missingKeyMsg || '还没有配置 AI Key。' };
  }
  if (!apiKey && effectiveBase !== serverBase) {
    return { error: '使用自定义接口地址时，请同时填写你自己的 API Key；服务器内置 Key 不会发送到第三方地址。' };
  }
  return { key, baseUrl: effectiveBase };
}

async function selfCheckReply({ persona, topic, history, reply, check, canon }) {
  const context = (history || [])
    .slice(-8)
    .map((m) => `${speakerName(m.speaker)}：「${m.text}」`)
    .join('\n');
  const prompt = [
    { role: 'system', content: SELFCHECK_SYSTEM },
    {
      role: 'user',
      content:
        `角色人设：\n${persona}\n\n` +
        `一设参考资料（官方设定）：\n${canon || '（无）'}\n\n` +
        `话题：${topic || '随便聊聊'}\n\n` +
        `对话上下文：\n${context || '（无）'}\n\n` +
        `待检查台词：\n${reply}`
    }
  ];
  const result = await callAI(check.apiKey, check.baseUrl, check.model, prompt, 0.3);
  const cleaned = cleanReply(result);
  const compact = cleaned.replace(/[【】\[\]「」""''\s]/g, '');
  if (/^(通过|没问题|无需修改|ok|okay)$/i.test(compact)) return reply;
  return cleaned || reply;
}

function aiUsable() {
  return config.aiEnabled && !!config.deepseekApiKey;
}

async function generateAutoMessage(speaker) {
  const messages = buildMessages({
    character: speaker,
    topic: state.currentTopic || '随便聊聊',
    history: state.aiHistory.slice(-20),
    persona: speaker === 'marisa' ? config.autoPersonaMarisa : config.autoPersonaReimu,
    summary: state.autoSummary || undefined,
    canon: canonTextFor({
      character: speaker,
      topic: state.currentTopic || '',
      history: state.aiHistory.slice(-12)
    })
  });
  return callAI(config.deepseekApiKey, config.baseUrl, config.model, messages, 0.95, 300, false, config.thinkingMode);
}

function parseBatchReply(raw, count) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  const toLines = (arr) =>
    arr
      .map((x) => cleanReply(typeof x === 'string' ? x : (x && (x.text || x.content)) || ''))
      .filter(Boolean);

  const tryExtract = (s) => {
    try {
      const v = JSON.parse(s);
      if (Array.isArray(v)) return v;
      if (v && Array.isArray(v.lines)) return v.lines;
      if (v && Array.isArray(v.replies)) return v.replies;
      return null;
    } catch (_) {
      return null;
    }
  };

  // 兼容全角逗号当分隔符、以及 {"lines":[...]} 这类对象包装
  const normalized = text.replace(/"，/g, '",');
  let arr = tryExtract(normalized);
  if (!arr) {
    const start = normalized.indexOf('[');
    const end = normalized.lastIndexOf(']');
    if (start !== -1) {
      arr = tryExtract(end > start ? normalized.slice(start, end + 1) : normalized.slice(start));
    }
  }

  let lines = arr ? toLines(arr) : [];

  // 兜底：截断或仍不合法时，抓取所有成对引号包裹的台词
  if (!lines.length) {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    const region = start !== -1
      ? (end > start ? text.slice(start + 1, end) : text.slice(start + 1))
      : text;
    const matches = [
      ...region.matchAll(/"((?:[^"\\]|\\.)*)"/g),
      ...region.matchAll(/'((?:[^'\\]|\\.)*)'/g),
      ...region.matchAll(/“([^“”]*)”/g),
      ...region.matchAll(/「([^「」]*)」/g)
    ];
    if (matches.length) {
      lines = matches.map((m) => cleanDialogueLine(m[1])).filter(Boolean);
    }
  }

  if (!lines.length) {
    lines = text
      .split(/\n+/)
      .map(cleanDialogueLine)
      .filter(Boolean);
  }

  // 最后手段：只剩一条且还带数组外壳时，去掉外壳后按标点拆开
  if (lines.length === 1 && /[\[【]/.test(lines[0])) {
    const inner = lines[0].replace(/^[\[【]+/, '').replace(/[\]】]+$/, '');
    lines = inner
      .split(/\s*[,，;；]\s*/)
      .map(cleanDialogueLine)
      .filter(Boolean);
  }

  return lines.slice(0, count);
}

const AUTO_KEEP_SECTIONS = new Set(['名字', '外貌', '性格', '关系', '说话习惯', '口头禅', '禁止事项']);
function compactPersona(text) {
  if (!text || text.length < 400) return text;
  const parts = String(text).split(/(【[^】]+】)/).filter(Boolean);
  const out = [];
  let currentTag = '';
  for (const p of parts) {
    if (/^【[^】]+】$/.test(p)) { currentTag = p; continue; }
    const tagName = currentTag.replace(/[【】]/g, '');
    if (AUTO_KEEP_SECTIONS.has(tagName)) {
      out.push(currentTag + p);
    } else if (tagName === '台词范例') {
      const quotes = String(p).match(/「[^」]*」/g) || [];
      if (quotes.length) out.push(currentTag + quotes.slice(0, 2).join(''));
    } else if (tagName === '互动示范') {
      const rounds = String(p).match(/[^：\n]{1,8}：[^「\n]+/g) || [];
      if (rounds.length) out.push(currentTag + rounds.slice(0, 2).join(''));
    } else if (tagName === '情绪反应') {
      const body = String(p);
      const idx = body.indexOf('担心');
      out.push(currentTag + body.slice(0, idx > 0 ? idx : 70));
    }
  }
  const compact = out.join('').trim();
  const hasCore = /【(性格|关系|说话习惯|口头禅|禁止事项)/.test(compact);
  return (compact.length >= 180 && hasCore) ? compact : text;
}

async function generateAutoBatch() {
  const count = Math.min(24, Math.max(2, Number(config.autoBatchSize) || 24));
  const startSpeaker = lastSpeaker() === 'marisa' ? 'reimu' : 'marisa';
  maybeDailyEvent();
  advanceSceneState();
  const canon = canonTextFor({
    character: startSpeaker,
    topic: state.currentTopic || '',
    history: state.aiHistory.slice(-12)
  });
  const messages = [
    { role: 'system', content: '你是幻想乡同人对话的编剧。下面会提供两位主角的人设、一设资料和当前话题，请以她们的身份编写接下来连续的多句对话台词。' },
    { role: 'system', content: `【博丽灵梦·人设】\n${compactPersona(config.autoPersonaReimu)}` },
    { role: 'system', content: `【雾雨魔理沙·人设】\n${compactPersona(config.autoPersonaMarisa)}` },
    { role: 'system', content: ALIVE_DIALOGUE_RULES },
    { role: 'system', content: KOURINDOU_STYLE_REF }
  ];
  if (canon) messages.push({ role: 'system', content: `【一设参考】\n${canon}` });
  if (state.autoSummary) messages.push({ role: 'system', content: `之前对话总结：${state.autoSummary}` });
  messages.push({ role: 'system', content: `当前话题：${state.currentTopic || '随便聊聊'}` });
  messages.push({ role: 'system', content: `现在是幻想乡的${timePeriodLabel()}（按真实世界时间）。你可以自然地呼应天色、作息与心情，但不要报出具体钟点和现实日期。` });
  messages.push({ role: 'system', content: weatherInjectionText() });
  const eventText = pendingEventText();
  if (eventText) messages.push({ role: 'system', content: eventText });
  const sceneText = sceneStateText();
  if (sceneText) messages.push({ role: 'system', content: sceneText });
  const memText = heartMemoryText();
  if (memText) messages.push({ role: 'system', content: memText });
  const giftText = giftInjectionText();
  if (giftText) messages.push({ role: 'system', content: giftText });
  if (state.topicTransition) {
    messages.push({ role: 'system', content: `刚才的话题已经聊得差不多了。请让两人顺着最近一句话里的某个细节（提到的物件、天气、吃食、心情等），像日常聊天一样自然地把话头带到「${state.currentTopic}」上；可以由某样东西联想过去，也可以由其中一人顺口提起，过渡句要和前文接得上，不要出现“换话题”“话题切换”这类场外说明。` });
    state.topicTransition = false;
  }
  for (const m of state.aiHistory.slice(-10)) {
    messages.push({ role: 'user', content: `${speakerName(m.speaker)}：${m.text}` });
  }
  messages.push({
    role: 'user',
    content: `请以 JSON 对象格式输出，格式必须严格为 {"lines":["台词一","台词二","台词三","台词四"]}，其中 lines 必须恰好包含 ${count} 个字符串，一条都不能少（先在心中列好 1 到 ${count} 的台词清单，再逐条完整输出；宁可每句短一点，也要把 ${count} 条写满；每句 1~3 句中文，口语自然，符合角色性格），第一句由${speakerName(startSpeaker)}说，之后两人严格交替。每句都要有新内容，接住对方上一句的具体细节，不要重复上文中已经说过的话；要有甜甜的小剧情和心动细节，让情绪有来有回，不要公式化一问一答。只输出这个 JSON 对象，不要角色名前缀、不要任何解释；每句台词都直接以说话内容开头，严禁在台词开头写出说话人自己的名字（比如灵梦说的话绝不能以「灵梦」二字开头，魔理沙也不能以「魔理沙」开头）。`
  });
  const raw = await callBatchAI(config.deepseekApiKey, config.baseUrl, config.model, messages, 0.85, Math.min(8000, Math.max(2000, count * 250)), config.thinkingMode);
  let lines = parseBatchReply(raw, count);
  if (!lines.length) throw new Error('批量生成返回空');
  lines = dedupeLines(lines, state.aiHistory.slice(-10).map((m) => m.text));
  updateSceneNote(lines);
  catchHeartMoments(lines);
  let sp = startSpeaker;
  return lines.map((text) => {
    const item = { speaker: sp, text: stripSelfNamePrefix(text, sp) || text };
    sp = sp === 'marisa' ? 'reimu' : 'marisa';
    return item;
  });
}

module.exports = {
  speakerName,
  canonTextFor,
  buildMessages,
  cleanReply,
  cleanDialogueLine,
  stripSelfNamePrefix,
  normalizeForCompare,
  dedupeLines,
  callAI,
  callBatchAI,
  thinkingEffort,
  resolveAiEndpoint,
  selfCheckReply,
  aiUsable,
  generateAutoMessage,
  parseBatchReply,
  compactPersona,
  generateAutoBatch,
  CANON_WORLD_KEYWORDS
};
