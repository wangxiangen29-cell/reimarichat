const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  DEFAULT_REIMU_PERSONA,
  DEFAULT_MARISA_PERSONA,
  DEFAULT_CANON_REIMU,
  DEFAULT_CANON_MARISA,
  DEFAULT_CANON_WORLD,
  DEFAULT_CANON_PAIR,
  DEFAULT_CANON_NOTES
} = require('./personas');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

// 自动闲聊开关的钩子：由 server.js（组合根）注入，避免 config -> autochat 的循环依赖
let autoHooks = { start: null, stop: null };
function setAutoChatHooks(hooks) {
  autoHooks = hooks || {};
}

// ---------- 配置 ----------
// 环境变量覆盖（用于云平台部署：Render / Koyeb 等没有本地 config.json 时，
// 通过平台的环境变量配置密钥与开关，优先级高于 config.json）
function applyEnvOverrides(cfg) {
  if (process.env.DEEPSEEK_API_KEY) cfg.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  else if (process.env.OPENAI_API_KEY) cfg.deepseekApiKey = process.env.OPENAI_API_KEY;
  if (process.env.ADMIN_TOKEN) cfg.adminToken = process.env.ADMIN_TOKEN;
  if (process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL) {
    cfg.baseUrl = process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL;
  }
  if (process.env.DEEPSEEK_MODEL) cfg.model = process.env.DEEPSEEK_MODEL;
  if (process.env.AI_ENABLED !== undefined) cfg.aiEnabled = process.env.AI_ENABLED !== 'false';
  if (process.env.AUTO_CHAT_ENABLED !== undefined) cfg.autoChatEnabled = process.env.AUTO_CHAT_ENABLED === 'true';
  if (process.env.CANON_ENABLED !== undefined) cfg.canonEnabled = process.env.CANON_ENABLED !== 'false';
  if (process.env.CANON_SMART !== undefined) cfg.canonSmart = process.env.CANON_SMART !== 'false';
  if (process.env.RATE_LIMIT_PER_MIN !== undefined) cfg.rateLimitPerMin = Number(process.env.RATE_LIMIT_PER_MIN) || 0;
  if (process.env.AUTO_BATCH_SIZE !== undefined) cfg.autoBatchSize = Math.min(24, Math.max(2, Number(process.env.AUTO_BATCH_SIZE) || 24));
  if (process.env.AMBIENT_EVERY !== undefined) cfg.ambientEvery = Math.max(3, Number(process.env.AMBIENT_EVERY) || 8);
  if (process.env.THINKING_MODE !== undefined) cfg.thinkingMode = process.env.THINKING_MODE;
  if (process.env.SUMMARY_STRENGTH !== undefined) cfg.summaryStrength = process.env.SUMMARY_STRENGTH;
  if (process.env.VOICE_TTS_URL !== undefined) cfg.voiceTtsUrl = process.env.VOICE_TTS_URL;
  return cfg;
}

function normalizeConfig(cfg) {
  if (cfg.rateLimitPerMin === undefined || cfg.rateLimitPerMin === null || Number.isNaN(Number(cfg.rateLimitPerMin))) {
    cfg.rateLimitPerMin = 20;
  }
  if (cfg.topicRoundSec === undefined || cfg.topicRoundSec === null || Number.isNaN(Number(cfg.topicRoundSec))) {
    cfg.topicRoundSec = 180;
  }
  if (cfg.switchVotes === undefined || cfg.switchVotes === null || Number.isNaN(Number(cfg.switchVotes))) {
    cfg.switchVotes = 3;
  }
  if (cfg.maxCandidates === undefined || cfg.maxCandidates === null || Number.isNaN(Number(cfg.maxCandidates))) {
    cfg.maxCandidates = 12;
  }
  if (cfg.summarizeAfter === undefined || cfg.summarizeAfter === null || Number.isNaN(Number(cfg.summarizeAfter))) {
    cfg.summarizeAfter = 20;
  }
  if (cfg.summaryKeepRecent === undefined || cfg.summaryKeepRecent === null || Number.isNaN(Number(cfg.summaryKeepRecent))) {
    cfg.summaryKeepRecent = 6;
  }
  cfg.sleepStartHour = Number(cfg.sleepStartHour ?? 1);
  cfg.sleepEndHour = Number(cfg.sleepEndHour ?? 7);
  cfg.ambientEvery = Number(cfg.ambientEvery ?? 8) || 8;
  if (Number.isNaN(cfg.sleepStartHour)) cfg.sleepStartHour = 1;
  if (Number.isNaN(cfg.sleepEndHour)) cfg.sleepEndHour = 7;
  const TM = ['none', 'low', 'high', 'max'];
  if (!TM.includes(String(cfg.thinkingMode ?? 'none').toLowerCase())) cfg.thinkingMode = 'none';
  const SS = ['short', 'normal', 'long'];
  if (!SS.includes(String(cfg.summaryStrength ?? 'short').toLowerCase())) cfg.summaryStrength = 'short';
  return cfg;
}

function loadConfig() {
  const defaults = {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
    adminToken: crypto.randomBytes(6).toString('hex'),
    baseUrl: 'https://opencode.ai/zen/go/v1',
    model: 'deepseek-v4-flash',
    personaReimu: DEFAULT_REIMU_PERSONA,
    personaMarisa: DEFAULT_MARISA_PERSONA,
    autoPersonaReimu: DEFAULT_REIMU_PERSONA,
    autoPersonaMarisa: DEFAULT_MARISA_PERSONA,
    canonReimu: DEFAULT_CANON_REIMU,
    canonMarisa: DEFAULT_CANON_MARISA,
    canonWorld: DEFAULT_CANON_WORLD,
    canonPair: DEFAULT_CANON_PAIR,
    canonAiNotes: DEFAULT_CANON_NOTES,
    canonEnabled: true,
    canonSmart: true,
    aiEnabled: true,
    autoChatEnabled: false,
    topicRoundSec: 180,
    switchVotes: 3,
    maxCandidates: 12,
    proposalCooldownSec: 30,
    summarizeAfter: 20,
    summaryKeepRecent: 6,
    autoBatchSize: 24,
    rateLimitPerMin: 20,
    sleepStartHour: 1,
    sleepEndHour: 7,
    ambientEvery: 8,
    thinkingMode: 'none',
    summaryStrength: 'short',
    twoAgentMode: false
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return normalizeConfig(applyEnvOverrides(Object.assign(defaults, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')))));
    }
    const fresh = applyEnvOverrides(defaults);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(fresh, null, 2), 'utf8');
    console.log('已生成 config.json（含管理员口令与 API Key，请勿公开或提交到仓库）');
    return normalizeConfig(fresh);
  } catch (err) {
    console.error('读取配置失败：', err.message);
    return normalizeConfig(applyEnvOverrides(defaults));
  }
}

const config = loadConfig();

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (_) {}
}

// 直接修改 config.json 后自动热加载（无需重启）
let reloadTimer = null;
function reloadConfigFromDisk() {
  // 防抖：等待文件写入稳定后再应用，避免读到写入中间状态
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(applyConfigFromDisk, 600);
}

function applyConfigFromDisk() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return;
    const disk = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const wasAuto = config.autoChatEnabled;
    const diskDefaults = {
      adminToken: config.adminToken,
      deepseekApiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || config.deepseekApiKey,
      baseUrl: 'https://opencode.ai/zen/go/v1',
      model: 'deepseek-v4-flash',
      personaReimu: DEFAULT_REIMU_PERSONA,
      personaMarisa: DEFAULT_MARISA_PERSONA,
      autoPersonaReimu: DEFAULT_REIMU_PERSONA,
      autoPersonaMarisa: DEFAULT_MARISA_PERSONA,
      canonReimu: DEFAULT_CANON_REIMU,
      canonMarisa: DEFAULT_CANON_MARISA,
      canonWorld: DEFAULT_CANON_WORLD,
      canonPair: DEFAULT_CANON_PAIR,
      canonAiNotes: DEFAULT_CANON_NOTES,
      canonEnabled: true,
      canonSmart: true,
      aiEnabled: true,
      autoChatEnabled: false,
      topicRoundSec: 180,
      switchVotes: 3,
      maxCandidates: 12,
      proposalCooldownSec: 30,
      summarizeAfter: 20,
      summaryKeepRecent: 6,
      autoBatchSize: 24,
      rateLimitPerMin: 20,
      sleepStartHour: 1,
      sleepEndHour: 7,
      ambientEvery: 8,
      thinkingMode: 'none',
      summaryStrength: 'short',
      twoAgentMode: false
    };
    normalizeConfig(applyEnvOverrides(Object.assign(config, diskDefaults, disk)));
    if (config.autoChatEnabled && !wasAuto && autoHooks.start) autoHooks.start();
    if (!config.autoChatEnabled && wasAuto && autoHooks.stop) autoHooks.stop();
    console.log('已重新读取 config.json，配置变更已生效');
  } catch (err) {
    console.error('重新读取 config.json 失败：', err.message);
  }
}

fs.watchFile(CONFIG_FILE, { interval: 1000 }, reloadConfigFromDisk);

module.exports = { config, saveConfig, setAutoChatHooks, CONFIG_FILE, loadConfig };
