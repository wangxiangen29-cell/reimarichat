const path = require('path');
const crypto = require('crypto');
const demo = require('../public/demo');
const data = require('./data');

// 旧总结文件路径（仅迁移用；总结已改存 data/summaries.json）
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
    const arr = data.loadSummaries();
    if (Array.isArray(arr)) {
      state.summaryHistory = arr
        .filter((x) => x && typeof x.content === 'string' && x.content.trim())
        .slice(0, 50);
    }
  } catch (err) {
    console.error('读取总结历史失败：', err.message);
  }
}

function saveSummaryHistory() {
  try {
    data.setSummaries(state.summaryHistory);
  } catch (err) {
    console.error('保存总结历史失败：', err.message);
  }
}

// 启动时从 data/messages.json 重建：显示日志 + LLM 历史 + 话题，实现重启续聊
function initFromDisk() {
  data.init();
  const msgs = data.loadMessages();
  state.chatLog = msgs.slice(-200);
  state.aiHistory = msgs
    .filter((m) => m.type === 'reimu' || m.type === 'marisa')
    .slice(-60)
    .map((m) => ({ speaker: m.type, text: m.text }));
  if (msgs.length) {
    state.nextId = Math.max(...msgs.map((m) => m.id)) + 1;
  }
  const meta = data.getMessagesMeta();
  if (meta && meta.currentTopic) {
    state.currentTopic = meta.currentTopic;
    state.topicStartTs = meta.topicStartTs || Date.now();
  }
  loadSummaryHistory();
}
initFromDisk();

function pushLog(type, text, emotion) {
  const entry = { id: state.nextId++, type, text, ts: Date.now() };
  // AI 指定的立绘表情（toolcall 协议字段），仅角色台词有意义
  if (emotion && (type === 'reimu' || type === 'marisa')) entry.emotion = String(emotion).slice(0, 20);
  state.chatLog.push(entry);
  if (state.chatLog.length > 200) state.chatLog.shift();
  try {
    data.appendMessage(entry);
  } catch (err) {
    console.error('写入对话日志失败：', err.message);
  }
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
