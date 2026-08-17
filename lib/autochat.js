const { config } = require('./config');
const { state, demoEngine, pushLog, lastSpeaker, newSummaryId, saveSummaryHistory } = require('./state');
const { SUMMARIZE_SYSTEM } = require('./personas');
const { isSleepingTime, sleep } = require('./time');
const { maybeAmbient } = require('./ambient');
const { pickRandomTopic, rotateTopic } = require('./topics');
const { generateAutoBatch, aiUsable, speakerName, callAI } = require('./ai');

const AUTO_INTERVAL_MS = 7000;
const AUTO_INTERVAL_JITTER_MS = 3500;

async function callSummaryAI(messages) {
  const prompt = [
    { role: 'system', content: SUMMARIZE_SYSTEM },
    { role: 'user', content: messages.map((m) => `${speakerName(m.speaker)}：「${m.text}」`).join('\n') }
  ];
  return callAI(config.deepseekApiKey, config.baseUrl, config.model, prompt, 0.4);
}

async function maybeSummarizeAuto() {
  const after = Number(config.summarizeAfter) || 0;
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
    await autoChatTick();
    if (config.autoChatEnabled) {
      state.autoTimer = setTimeout(loop, AUTO_INTERVAL_MS + Math.random() * AUTO_INTERVAL_JITTER_MS);
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
    if (state.aiHistory.length > 30) state.aiHistory.shift();
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
  if (state.aiHistory.length > 30) state.aiHistory.shift();
  maybeAmbient();
}

module.exports = { callSummaryAI, maybeSummarizeAuto, startAutoChat, stopAutoChat, autoChatTick };
