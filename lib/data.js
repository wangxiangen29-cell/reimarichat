// ---------- 双 agent 数据层（JSON 文件即状态） ----------
// 每角色独立提示词（agents.json）、每角色知识库（canon.json）、
// 自动闲聊对话日志（messages.json）、总结历史（summaries.json，从旧文件迁移）。
// 原子写（tmp + rename）；启动加载一次、经 API 修改，不热重载。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('./config');
const {
  DEFAULT_REIMU_PERSONA,
  DEFAULT_MARISA_PERSONA,
  DEFAULT_CANON_REIMU,
  DEFAULT_CANON_MARISA,
  DEFAULT_CANON_WORLD,
  DEFAULT_CANON_PAIR,
  DEFAULT_CANON_NOTES
} = require('./personas');
const { agentDefaults } = require('./agents');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const CANON_FILE = path.join(DATA_DIR, 'canon.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const SUMMARIES_FILE = path.join(DATA_DIR, 'summaries.json');
const LEGACY_SUMMARY_FILE = path.join(__dirname, '..', 'summary_history.json');

const MESSAGES_CAP = 500;
const SUMMARIES_CAP = 50;
// canon 条目的输出顺序（与旧 canonTextFor 的段落顺序一致：一设 → 关系 → 易错提醒 → 世界观）
const CATEGORY_ORDER = ['一设', '关系', '易错提醒', '世界观'];

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function atomicWriteJson(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return v == null ? fallback : v;
  } catch (err) {
    console.error(`读取 ${path.basename(file)} 失败：`, err.message);
    return fallback;
  }
}

// ---------- 内存缓存 ----------
let agentsStore = null;
let canonStore = null;
let messagesStore = null;

// ---------- Seed / 迁移（仅文件缺失时执行，幂等） ----------
function seedAgents() {
  if (fs.existsSync(AGENTS_FILE)) {
    agentsStore = loadJson(AGENTS_FILE, { version: 1, agents: {} });
    return;
  }
  const agents = {};
  for (const ch of ['reimu', 'marisa']) {
    const d = agentDefaults(ch);
    agents[ch] = {
      base_prompt:
        ch === 'reimu'
          ? config.autoPersonaReimu || DEFAULT_REIMU_PERSONA
          : config.autoPersonaMarisa || DEFAULT_MARISA_PERSONA,
      goals: d.goals,
      memory_instructions: d.memory_instructions,
      few_shots: d.few_shots
    };
  }
  agentsStore = { version: 1, agents };
  atomicWriteJson(AGENTS_FILE, agentsStore);
}

function seedCanon() {
  if (fs.existsSync(CANON_FILE)) {
    canonStore = loadJson(CANON_FILE, { version: 1, entries: [] });
    return;
  }
  const entries = [
    { id: 'reimu-yishe-1', character: 'reimu', category: '一设', content: config.canonReimu || DEFAULT_CANON_REIMU, sort: 1 },
    { id: 'marisa-yishe-1', character: 'marisa', category: '一设', content: config.canonMarisa || DEFAULT_CANON_MARISA, sort: 1 },
    { id: 'shared-shijieguan-1', character: 'shared', category: '世界观', content: config.canonWorld || DEFAULT_CANON_WORLD, sort: 1 },
    { id: 'shared-guanxi-1', character: 'shared', category: '关系', content: config.canonPair || DEFAULT_CANON_PAIR, sort: 1 },
    { id: 'shared-yicuotixing-1', character: 'shared', category: '易错提醒', content: config.canonAiNotes || DEFAULT_CANON_NOTES, sort: 1 }
  ];
  canonStore = { version: 1, entries };
  atomicWriteJson(CANON_FILE, canonStore);
}

function migrateSummaries() {
  if (fs.existsSync(SUMMARIES_FILE)) return;
  let arr = [];
  try {
    if (fs.existsSync(LEGACY_SUMMARY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LEGACY_SUMMARY_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        arr = parsed
          .filter((x) => x && typeof x.content === 'string' && x.content.trim())
          .slice(0, SUMMARIES_CAP);
      }
    }
  } catch (err) {
    console.error('迁移总结历史失败：', err.message);
  }
  atomicWriteJson(SUMMARIES_FILE, arr);
}

function ensureMessages() {
  if (messagesStore) return;
  if (fs.existsSync(MESSAGES_FILE)) {
    const loaded = loadJson(MESSAGES_FILE, null);
    messagesStore = loaded && Array.isArray(loaded.messages) ? loaded : { version: 1, meta: {}, messages: [] };
  } else {
    messagesStore = { version: 1, meta: {}, messages: [] };
    atomicWriteJson(MESSAGES_FILE, messagesStore);
  }
}

let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;
  ensureDataDir();
  seedAgents();
  seedCanon();
  migrateSummaries();
  ensureMessages();
}

// ---------- agents（每角色提示词分片） ----------
function getAgents() {
  if (!agentsStore) init();
  return agentsStore.agents || {};
}

function getAgent(character) {
  if (!agentsStore) init();
  const stored = (agentsStore.agents && agentsStore.agents[character]) || {};
  const d = agentDefaults(character);
  return {
    base_prompt: typeof stored.base_prompt === 'string' ? stored.base_prompt : d.base_prompt,
    goals: typeof stored.goals === 'string' ? stored.goals : d.goals,
    memory_instructions: typeof stored.memory_instructions === 'string' ? stored.memory_instructions : d.memory_instructions,
    few_shots: Array.isArray(stored.few_shots) ? stored.few_shots : d.few_shots
  };
}

function saveAgents(store) {
  agentsStore = store;
  atomicWriteJson(AGENTS_FILE, store);
}

function saveAgentRecord(character, record) {
  if (!agentsStore) init();
  agentsStore.agents[character] = {
    base_prompt: record.base_prompt,
    goals: record.goals,
    memory_instructions: record.memory_instructions,
    few_shots: record.few_shots
  };
  atomicWriteJson(AGENTS_FILE, agentsStore);
}

// ---------- canon（每角色知识库） ----------
function getCanonEntries() {
  if (!canonStore) init();
  return Array.isArray(canonStore.entries) ? canonStore.entries : [];
}

function getCanonFor(character) {
  const entries = getCanonEntries();
  const orderBy = (arr) =>
    arr
      .slice()
      .sort((a, b) => {
        const ra = CATEGORY_ORDER.indexOf(a.category);
        const rb = CATEGORY_ORDER.indexOf(b.category);
        return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb) || (a.sort || 0) - (b.sort || 0);
      });
  const own = entries.filter((e) => e.character === character);
  const shared = entries.filter((e) => e.character === 'shared');
  return orderBy(own).concat(orderBy(shared));
}

function addCanonEntry({ character, category, content, sort }) {
  if (!canonStore) init();
  const entry = { id: crypto.randomBytes(4).toString('hex'), character, category, content, sort: Number(sort) || 0 };
  canonStore.entries.push(entry);
  atomicWriteJson(CANON_FILE, canonStore);
  return entry;
}

function updateCanonEntry(id, patch) {
  if (!canonStore) init();
  const e = canonStore.entries.find((x) => x.id === id);
  if (!e) return false;
  if (patch.character !== undefined) e.character = patch.character;
  if (patch.category !== undefined) e.category = patch.category;
  if (patch.content !== undefined) e.content = patch.content;
  if (patch.sort !== undefined) e.sort = Number(patch.sort) || 0;
  atomicWriteJson(CANON_FILE, canonStore);
  return true;
}

function deleteCanonEntry(id) {
  if (!canonStore) init();
  const idx = canonStore.entries.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  canonStore.entries.splice(idx, 1);
  atomicWriteJson(CANON_FILE, canonStore);
  return true;
}

// ---------- messages（对话日志，重启续聊） ----------
function loadMessages() {
  ensureMessages();
  return messagesStore.messages;
}

function getMessagesMeta() {
  ensureMessages();
  return messagesStore.meta || {};
}

function setTopicMeta(meta) {
  ensureMessages();
  messagesStore.meta = Object.assign({}, messagesStore.meta, meta);
  atomicWriteJson(MESSAGES_FILE, messagesStore);
}

function appendMessage(entry) {
  ensureMessages();
  messagesStore.messages.push(entry);
  if (messagesStore.messages.length > MESSAGES_CAP) {
    messagesStore.messages.splice(0, messagesStore.messages.length - MESSAGES_CAP);
  }
  atomicWriteJson(MESSAGES_FILE, messagesStore);
}

// ---------- summaries ----------
function loadSummaries() {
  return loadJson(SUMMARIES_FILE, []);
}

function setSummaries(arr) {
  atomicWriteJson(SUMMARIES_FILE, (arr || []).slice(0, SUMMARIES_CAP));
}

// ---------- 手动对话历史（data/manuals.json） ----------
const MANUALS_FILE = path.join(DATA_DIR, 'manuals.json');
const MANUALS_CAP = 100;
const MANUALS_MSG_CAP = 400;
let manualsStore = null;

function ensureManuals() {
  if (manualsStore) return;
  if (fs.existsSync(MANUALS_FILE)) {
    const loaded = loadJson(MANUALS_FILE, []);
    manualsStore = Array.isArray(loaded) ? loaded : [];
  } else {
    manualsStore = [];
    atomicWriteJson(MANUALS_FILE, manualsStore);
  }
}
function saveManuals() {
  atomicWriteJson(MANUALS_FILE, manualsStore);
}
function manualTitle(topic, title, now) {
  if (title && String(title).trim()) return String(title).trim();
  if (topic && String(topic).trim()) return String(topic).trim();
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return '对话 ' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function getManualSessions() {
  ensureManuals();
  return manualsStore.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
function createManualSession({ topic, title } = {}) {
  ensureManuals();
  const now = Date.now();
  const id = crypto.randomBytes(4).toString('hex');
  const session = {
    id,
    title: manualTitle(topic, title, now),
    topic: topic ? String(topic).trim() : '',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  manualsStore.unshift(session);
  if (manualsStore.length > MANUALS_CAP) manualsStore.length = MANUALS_CAP;
  saveManuals();
  return session;
}
function getManualSession(id) {
  ensureManuals();
  return manualsStore.find((x) => x.id === id) || null;
}
function appendManualMessages(id, entries) {
  ensureManuals();
  const session = manualsStore.find((x) => x.id === id);
  if (!session) return null;
  const arr = Array.isArray(entries) ? entries : [];
  for (const e of arr) {
    if (!e || typeof e.text !== 'string' || !e.text.trim()) continue;
    session.messages.push({ speaker: e.speaker || 'user', text: String(e.text).trim(), ts: Number(e.ts) || Date.now() });
  }
  if (session.messages.length > MANUALS_MSG_CAP) session.messages.splice(0, session.messages.length - MANUALS_MSG_CAP);
  session.updatedAt = Date.now();
  saveManuals();
  return session;
}
function renameManualSession(id, title) {
  ensureManuals();
  const session = manualsStore.find((x) => x.id === id);
  if (!session) return null;
  if (title && String(title).trim()) session.title = String(title).trim();
  session.updatedAt = Date.now();
  saveManuals();
  return session;
}
function deleteManualSession(id) {
  ensureManuals();
  const i = manualsStore.findIndex((x) => x.id === id);
  if (i === -1) return false;
  manualsStore.splice(i, 1);
  saveManuals();
  return true;
}

module.exports = {
  init,
  atomicWriteJson,
  loadJson,
  getAgents,
  getAgent,
  saveAgents,
  saveAgentRecord,
  getCanonEntries,
  getCanonFor,
  addCanonEntry,
  updateCanonEntry,
  deleteCanonEntry,
  loadMessages,
  getMessagesMeta,
  setTopicMeta,
  appendMessage,
  loadSummaries,
  setSummaries,
  getManualSessions,
  createManualSession,
  getManualSession,
  appendManualMessages,
  renameManualSession,
  deleteManualSession
};
