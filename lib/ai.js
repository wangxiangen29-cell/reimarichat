const { config } = require('./config');
const { state, lastSpeaker } = require('./state');
const { ALIVE_DIALOGUE_RULES, KOURINDOU_STYLE_REF, SELFCHECK_SYSTEM } = require('./personas');
const { timePeriodLabel, sleep } = require('./time');
const { weatherInjectionText, giftInjectionText } = require('./ambient');
const { advanceSceneState, sceneStateText, firstPersonPresence, updateSceneNote } = require('./scene');
const { maybeDailyEvent, pendingEventText, heartMemoryText, catchHeartMoments } = require('./events');
const { getAgent, getCanonFor } = require('./data');
const { buildAgentSystemPrompt, agentCanonTextFor, CANON_WORLD_KEYWORDS, canonNeedsWorld } = require('./agents');
const { emotionKeys, emotionMenuText } = require('./emotions');

// ---------- AI ----------

function speakerName(speaker) {
  if (speaker === 'marisa') return '魔理沙';
  if (speaker === 'user') return '旁白';
  return '灵梦';
}

// CANON_WORLD_KEYWORDS / canonNeedsWorld 已迁到 lib/agents.js（单一来源），此处从上方 import

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



// 方法派组装：让 AI「成为」角色而非「执行」任务。
// system 顺序按 recency 排——身份 → 角色记忆 → 总结 → 【此刻】第一人称在场块（最后一条 system，紧贴生成点）。
// 结尾不再有「请以角色身份说出台词」之类的元框架：历史以对方最后一句收尾即是接话点，
// 只有空历史或最后一句是自己（连续 follow-up）时才补一条轻旁白兜底。
function buildMessages({ character, topic, history = [], persona, summary, canon, fewShots }) {
  const isMarisa = character === 'marisa';
  const personaText = persona || (isMarisa ? config.autoPersonaMarisa : config.autoPersonaReimu);
  const selfName = isMarisa ? '魔理沙' : '灵梦';
  const otherName = isMarisa ? '灵梦' : '魔理沙';
  const messages = [
    // 1. 身份块：你是谁（base 人设 + 本回动机 + 知识库使用说明）
    { role: 'system', content: personaText },
  ];
  // 2. 角色记忆：你心里一直知道的事（角色视角，不是资料）
  if (canon) {
    messages.push({
      role: 'system',
      content:
        `【你心里一直知道的事】你是土生土长的幻想乡人，下面这些事你从小就知道、早已烂熟于心——聊到相关的事就自然带过，像老朋友一样信手拈来，不要当成资料念出来，也不要解释设定：\n${canon}`
    });
  }
  if (summary) {
    messages.push({ role: 'system', content: `之前的对话总结：${summary}\n请在这个基础上自然地继续。` });
  }
  // 3. 【此刻】第一人称在场块（最后一条 system）：此刻画面 + 时间/天气 + 关系温度 + 文风底色 + 说话风格示例
  const nowBlock = [
    `【此刻】${firstPersonPresence(character)}`,
    `时间：现在是幻想乡的${timePeriodLabel()}（呼应天色与作息，但不要报出具体钟点和现实日期）。`,
    `天气：${weatherInjectionText()}`,
    `你和她（${otherName}）心照不宣地亲昵——都把对方当成最重要的人。日常的斗嘴和嫌弃是亲密的表现，不是真的冷淡；甜落在细节里：留的茶、留的饭、记得的喜好、第一个想分享的人。`,
    `文风底色：把魔法、异变、能力都当日常背景，轻轻带过，举重若轻；用具体小物代替抽象形容（茶凉了、帽檐沾了灰、袖口留着一缕烟味）。`,
    `对方若是「旁白」（场景或事件的描述），把它当作正发生的事自然地回应，别评价旁白本身。`
  ].join('\n');
  const style = Array.isArray(fewShots) && fewShots.length
    ? `\n\n你平时说话的样子（作语感参考，别整句照搬）：\n` + fewShots.slice(0, 2).map((s) => `「${s}」`).join('\n')
    : '';
  messages.push({ role: 'system', content: nowBlock + style });

  // 4. 历史：以对方最后一句作接话点
  const historyItems = (history || []).slice(-10);
  for (const item of historyItems) {
    messages.push({ role: 'user', content: `${speakerName(item.speaker)}：「${String(item.text).trim()}」` });
  }
  const last = historyItems[historyItems.length - 1];
  if (!last) {
    messages.push({ role: 'user', content: `（${selfName}正一个人待着，心里有点想找${otherName}说话。先开个口吧。）` });
  } else if (last.speaker === character) {
    messages.push({ role: 'user', content: `（片刻安静，${otherName}正看着你，等你说下去。）` });
  }
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
      const aiMsg = data.choices?.[0]?.message || {};
      // 抓取思考内容（reasoning_content）：max 思考下查看 AI 是否真的在「当角色」想事情
      if (aiMsg.reasoning_content) console.log('[思考] ' + String(aiMsg.reasoning_content).trim());
      const reply = aiMsg.content ?? '';
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
  const agent = getAgent(speaker);
  const messages = buildMessages({
    character: speaker,
    topic: state.currentTopic || '随便聊聊',
    history: state.aiHistory.slice(-20),
    persona: buildAgentSystemPrompt(agent),
    summary: state.autoSummary || undefined,
    canon: agentCanonTextFor(speaker, state.currentTopic || '', state.aiHistory.slice(-12), getCanonFor(speaker)),
    fewShots: agent.few_shots
  });
  return callAI(config.deepseekApiKey, config.baseUrl, config.model, messages, 0.95, 300, false, config.thinkingMode);
}

const EMOTION_ALLOWED = () => emotionKeys();

function parseBatchReply(raw, count) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  // 台词可以是字符串，也可以是 {text, emotion} 对象（AI 通过 emotion 字段“调用”立绘切换）
  const toItems = (arr) =>
    arr
      .map((x) => {
        if (typeof x === 'string') return { text: cleanReply(x), emotion: null };
        if (x && typeof x === 'object') {
          let emo = String(x.emotion || x.emotion_type || '').toLowerCase().trim();
          if (!EMOTION_ALLOWED().has(emo)) emo = null;
          return { text: cleanReply(x.text || x.content || x.line || ''), emotion: emo };
        }
        return { text: '', emotion: null };
      })
      .filter((it) => it.text);

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

  let lines = arr ? toItems(arr) : [];

  // 兜底：截断或仍不合法时，抓取所有成对引号包裹的台词（无 emotion 信息）
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
      lines = matches.map((m) => ({ text: cleanDialogueLine(m[1]), emotion: null })).filter((it) => it.text);
    }
  }

  if (!lines.length) {
    lines = text
      .split(/\n+/)
      .map((s) => ({ text: cleanDialogueLine(s), emotion: null }))
      .filter((it) => it.text);
  }

  // 最后手段：只剩一条且还带数组外壳时，去掉外壳后按标点拆开
  if (lines.length === 1 && /[\[【]/.test(lines[0].text)) {
    const inner = lines[0].text.replace(/^[\[【]+/, '').replace(/[\]】]+$/, '');
    lines = inner
      .split(/\s*[,，;；]\s*/)
      .map((s) => ({ text: cleanDialogueLine(s), emotion: null }))
      .filter((it) => it.text);
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
  messages.push({ role: 'system', content: '关系温度：两人亲密到彼此心照不宣（相当于好感度体系的「思慕」——都把彼此当成最重要的人，深深在意、愿意为对方付出，会分享心事、主动邀请对方、约好明天见）。日常的斗嘴和嫌弃是亲密的表现，不是真的冷淡；甜要落在细节里：留的茶、留的饭、记得的喜好、第一个想分享的人。' });
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
    content: `请以 JSON 对象格式输出，格式必须严格为 {"lines":[{"text":"台词一","emotion":"smile"},{"text":"台词二","emotion":"normal"}]}，其中 lines 必须恰好包含 ${count} 个元素，一条都不能少（先在心中列好 1 到 ${count} 的台词清单，再逐条完整输出；宁可每句短一点，也要把 ${count} 条写满；每句 1~3 句中文，口语自然，符合角色性格），第一句由${speakerName(startSpeaker)}说，之后两人严格交替。emotion 是这句台词说话人的立绘表情，相当于一次界面调用（switch_portrait），只能从这些里选一个：${emotionMenuText()}，按台词内容认真选择，不明确就用 normal。每句都要有新内容，接住对方上一句的具体细节，不要重复上文中已经说过的话；要有甜甜的小剧情和心动细节，让情绪有来有回，不要公式化一问一答。只输出这个 JSON 对象，不要角色名前缀、不要任何解释；每句台词都直接以说话内容开头，严禁在台词开头写出说话人自己的名字（比如灵梦说的话绝不能以「灵梦」二字开头，魔理沙也不能以「魔理沙」开头）。`
  });
  const raw = await callBatchAI(config.deepseekApiKey, config.baseUrl, config.model, messages, 0.85, Math.min(8000, Math.max(2000, count * 250)), config.thinkingMode);
  let items = parseBatchReply(raw, count);
  if (!items.length) throw new Error('批量生成返回空');
  const deduped = dedupeLines(items.map((it) => it.text), state.aiHistory.slice(-10).map((m) => m.text));
  const emoByText = new Map(items.map((it) => [it.text, it.emotion]));
  updateSceneNote(deduped);
  catchHeartMoments(deduped);
  let sp = startSpeaker;
  return deduped.map((text) => {
    const item = { speaker: sp, text: stripSelfNamePrefix(text, sp) || text, emotion: emoByText.get(text) || null };
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
