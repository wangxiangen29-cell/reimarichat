const { config } = require('./config');
const { state, demoEngine, pushLog, lastSpeaker, newSummaryId, saveSummaryHistory } = require('./state');
const { summarizeSystem } = require('./personas');
const { isSleepingTime, sleep } = require('./time');
const { maybeAmbient, ambientLine } = require('./ambient');
const { pickRandomTopic, rotateTopic } = require('./topics');
const { generateAutoBatch, generateAutoMessage, aiUsable, speakerName, callAI } = require('./ai');
const data = require('./data');

const AUTO_INTERVAL_MS = 7000;
const AUTO_INTERVAL_JITTER_MS = 3500;
// 内存对话历史上限：60 条（要能容纳 long 档压缩的 50+ 触发轮数，且总结输入不丢内容）
const AI_HISTORY_MAX = 60;

// ---------- 双 agent 真实对话（config.twoAgentMode 开关） ----------
// 每个角色独立人设、独立触发节奏：灵梦慵懒响应慢、魔理沙元气响应快
const AGENT_LATENCY = {
  reimu: { base: 3800, jitter: 3000 },
  marisa: { base: 1600, jitter: 2200 }
};
const AGENT_FOLLOWUP_P = 0.12; // 偶尔同一人连说两句，打破「一句我一句」
const AGENT_PAUSE_P = 0.15;    // 偶尔沉默一拍，插一条氛围旁白

function delayFor(speaker) {
  const L = AGENT_LATENCY[speaker] || AGENT_LATENCY.marisa;
  return L.base + Math.random() * L.jitter;
}

function chooseNextSpeaker() {
  const last = lastSpeaker();
  if (!last) return Math.random() < 0.5 ? 'reimu' : 'marisa';
  if (Math.random() < AGENT_FOLLOWUP_P) return last;
  return last === 'marisa' ? 'reimu' : 'marisa';
}

async function agentChatTick() {
  if (!config.autoChatEnabled) return;
  if (isSleepingTime()) {
    if (!state.sleeping) {
      state.sleeping = true;
      state.autoQueue = [];
      pushLog('system', '（夜深了，两人各自歇下，明早再继续～）');
    }
    return;
  }
  if (state.sleeping) {
    state.sleeping = false;
    pushLog('system', '（新的一天，神社的日常又继续了）');
  }

  await maybeSummarizeAuto();

  if (state.consecutiveErrors >= 4) {
    pushLog('system', '（内置 AI 暂时打盹了，休息一会儿再继续…）');
    state.consecutiveErrors = 0;
    await sleep(15000);
    return;
  }

  if (!aiUsable()) {
    const speaker = lastSpeaker() === 'marisa' ? 'reimu' : 'marisa';
    const text = demoEngine.reply(speaker, state.currentTopic || '', lastSpeaker());
    await sleep(600 + Math.random() * 900);
    pushLog(speaker, text);
    state.aiHistory.push({ speaker, text });
    if (state.aiHistory.length > AI_HISTORY_MAX) state.aiHistory.shift();
    maybeAmbient();
    return;
  }

  if (Math.random() < AGENT_PAUSE_P) {
    const line = ambientLine();
    if (line) pushLog('system', line);
    return;
  }

  const speaker = chooseNextSpeaker();
  try {
    const text = await generateAutoMessage(speaker);
    if (!text) return;
    state.consecutiveErrors = 0;
    pushLog(speaker, text);
    state.aiHistory.push({ speaker, text });
    if (state.aiHistory.length > AI_HISTORY_MAX) state.aiHistory.shift();
    maybeAmbient();
  } catch (err) {
    state.consecutiveErrors++;
    console.error('双 agent 台词生成失败：', err.message);
  }
}

// 各档压缩强度对应的输出上限（short=120字提要 / normal=300字 / long=600字，留足余量）
const SUMMARY_MAX_TOKENS = { short: 400, normal: 800, long: 1200 };
// 触发轮数系数：档位越高，攒的对话越多才压缩（不能所有档位都用同一轮数触发）
const SUMMARY_TRIGGER_MULT = { short: 1, normal: 1.6, long: 2.5 };

function summaryTriggerAfter() {
  const base = Number(config.summarizeAfter) || 0;
  const strength = String(config.summaryStrength || 'short').toLowerCase();
  return base ? Math.round(base * (SUMMARY_TRIGGER_MULT[strength] || 1)) : 0;
}

async function callSummaryAI(messages) {
  const strength = String(config.summaryStrength || 'short').toLowerCase();
  const prompt = [
    { role: 'system', content: summarizeSystem(strength) },
    { role: 'user', content: messages.map((m) => `${speakerName(m.speaker)}：「${m.text}」`).join('\n') }
  ];
  return callAI(config.deepseekApiKey, config.baseUrl, config.model, prompt, 0.4, SUMMARY_MAX_TOKENS[strength] || 400);
}

async function maybeSummarizeAuto() {
  const after = summaryTriggerAfter();
  const keep = Math.max(1, Number(config.summaryKeepRecent) || 6);
  if (!after || state.aiHistory.length <= after) return;
  const split = state.aiHistory.length - keep;
  const old = state.aiHistory.slice(0, split);
  const recent = state.aiHistory.slice(split);
  let summaryText = '';
  if (aiUsable()) {
    try {
      summaryText = await callSummaryAI(old);
    } catch (err) {
      console.error('自动闲聊总结失败：', err.message);
      return;
    }
  } else {
    summaryText = `前面聊了${old.length}条关于「${state.currentTopic || '幻想乡'}」的内容`;
  }
  state.autoSummary = summaryText;
  state.aiHistory = recent;
  pushLog('system', `（自动总结：${summaryText}）`);
  const entry = {
    id: newSummaryId(),
    topic: state.currentTopic || '自动闲聊',
    content: summaryText,
    createdAt: Date.now()
  };
  state.summaryHistory.unshift(entry);
  if (state.summaryHistory.length > 50) state.summaryHistory.pop();
  state.currentSummary = entry;
  saveSummaryHistory();
}

// ---------- 自动闲聊 ----------
function startAutoChat() {
  if (state.autoTimer) return;
  if (!state.currentTopic) {
    state.currentTopic = pickRandomTopic();
    state.topicStartTs = Date.now();
    data.setTopicMeta({ currentTopic: state.currentTopic, topicStartTs: state.topicStartTs });
  }
  const last = state.chatLog[state.chatLog.length - 1];
  if (!last || last.type === 'system') {
    pushLog('system', `（自动闲聊开始，话题：${state.currentTopic}）`);
  }
  const loop = async () => {
    if (!config.autoChatEnabled) {
      state.autoTimer = null;
      return;
    }
    let delay;
    if (config.twoAgentMode) {
      await agentChatTick();
      const last = lastSpeaker();
      delay = delayFor(last === 'marisa' ? 'reimu' : 'marisa');
    } else {
      await autoChatTick();
      delay = AUTO_INTERVAL_MS + Math.random() * AUTO_INTERVAL_JITTER_MS;
    }
    if (config.autoChatEnabled) {
      state.autoTimer = setTimeout(loop, delay);
    } else {
      state.autoTimer = null;
    }
  };
  state.autoTimer = setTimeout(loop, 1200);
}

function stopAutoChat() {
  if (state.autoTimer) {
    clearTimeout(state.autoTimer);
    state.autoTimer = null;
  }
  pushLog('system', '（自动闲聊已暂停）');
}

async function autoChatTick() {
  if (!config.autoChatEnabled) return;

  if (isSleepingTime()) {
    if (!state.sleeping) {
      state.sleeping = true;
      state.autoQueue = [];
      pushLog('system', '（夜深了，两人各自歇下，明早再继续～）');
    }
    return;
  }
  if (state.sleeping) {
    state.sleeping = false;
    pushLog('system', '（新的一天，神社的日常又继续了）');
  }

  await maybeSummarizeAuto();

  // 队列里还有没播完的台词时先不轮换，避免白费已生成的 token
  if (!state.autoQueue.length) {
    if (Date.now() - state.topicStartTs >= config.topicRoundSec * 1000) {
      await rotateTopic();
    }
    const winner = state.candidates.find((c) => c.votes.size >= config.switchVotes);
    if (winner) await rotateTopic();
  }

  if (state.consecutiveErrors >= 4) {
    pushLog('system', '（内置 AI 暂时打盹了，休息一会儿再继续…）');
    state.consecutiveErrors = 0;
    await sleep(15000);
    return;
  }

  if (!aiUsable()) {
    const speaker = lastSpeaker() === 'marisa' ? 'reimu' : 'marisa';
    const text = demoEngine.reply(speaker, state.currentTopic || '', lastSpeaker());
    await sleep(600 + Math.random() * 900);
    pushLog(speaker, text);
    state.aiHistory.push({ speaker, text });
    if (state.aiHistory.length > AI_HISTORY_MAX) state.aiHistory.shift();
    maybeAmbient();
    return;
  }

  if (!state.autoQueue.length) {
    try {
      state.autoQueue = await generateAutoBatch();
      state.consecutiveErrors = 0;
    } catch (err) {
      state.consecutiveErrors++;
      console.error('自动闲聊批量生成失败：', err.message);
      return;
    }
  }
  const item = state.autoQueue.shift();
  if (!item || !item.text) return;
  const speaker = item.speaker;
  const text = item.text;
  pushLog(speaker, text);
  state.aiHistory.push({ speaker, text });
  if (state.aiHistory.length > AI_HISTORY_MAX) state.aiHistory.shift();
  maybeAmbient();
}

module.exports = { callSummaryAI, maybeSummarizeAuto, startAutoChat, stopAutoChat, autoChatTick };
