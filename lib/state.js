const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const demo = require('../public/demo');

const SUMMARY_FILE = path.join(__dirname, '..', 'summary_history.json');

// ---------- 运行时状态 ----------
const state = {
  chatLog: [],
  candidates: [],
  lastProposal: new Map(),
  currentTopic: null,
  topicStartTs: 0,
  aiHistory: [],
  autoSummary: null,
  summaryHistory: [],
  currentSummary: null,
  consecutiveErrors: 0,
  autoTimer: null,
  autoQueue: [],
  sleeping: false,
  topicTransition: false,
  ambientCounter: 0,
  scene: null,
  heartMoments: [],
  lastEventDay: null,
  pendingEvent: null,
  weather: null,
  giftQueue: [],
  giftCooldown: new Map(),
  nextId: 1
};

const demoEngine = demo.createEngine();

function newSummaryId() {
  return crypto.randomBytes(6).toString('hex');
}

function loadSummaryHistory() {
  try {
    if (fs.existsSync(SUMMARY_FILE)) {
      const arr = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8'));
      if (Array.isArray(arr)) {
        state.summaryHistory = arr
          .filter((x) => x && typeof x.content === 'string' && x.content.trim())
          .slice(0, 50);
      }
    }
  } catch (err) {
    console.error('读取总结历史失败：', err.message);
  }
}

function saveSummaryHistory() {
  try {
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(state.summaryHistory, null, 2), 'utf8');
  } catch (err) {
    console.error('保存总结历史失败：', err.message);
  }
}
loadSummaryHistory();

function pushLog(type, text) {
  const entry = { id: state.nextId++, type, text, ts: Date.now() };
  state.chatLog.push(entry);
  if (state.chatLog.length > 200) state.chatLog.shift();
  return entry;
}

function lastSpeaker() {
  for (let i = state.chatLog.length - 1; i >= 0; i--) {
    const e = state.chatLog[i];
    if (e.type === 'reimu' || e.type === 'marisa') return e.type;
  }
  return null;
}

// 清空手动对谈：只清手动会话会残留的场景备注；自动闲聊的一切状态（话题、历史、总结、心动回忆、每日事件）完全不动
function resetConversationMemory() {
  if (state.scene) state.scene.note = '';
  return { ok: true };
}

module.exports = {
  state,
  demoEngine,
  newSummaryId,
  loadSummaryHistory,
  saveSummaryHistory,
  pushLog,
  lastSpeaker,
  resetConversationMemory,
  SUMMARY_FILE
};
