// ---------- 双 agent 每角色提示词组装 ----------
// 本模块只依赖 config + personas（不依赖 data/ai/state，避免 require 环）。
// canon 条目由调用方从 data.getCanonFor() 取好传入，组装逻辑保持纯粹。
const { config } = require('./config');
const {
  DEFAULT_REIMU_PERSONA,
  DEFAULT_MARISA_PERSONA,
  DEFAULT_REIMU_RULES,
  DEFAULT_MARISA_RULES,
  DEFAULT_AGENT_GOALS,
  DEFAULT_AGENT_MEMORY,
  extractPersonaFewShots
} = require('./personas');

// ---------- 世界观动态门控关键词（从 ai.js 迁入，单一来源） ----------
const CANON_WORLD_KEYWORDS = [
  '红魔馆', '守矢神社', '雾之湖', '妖怪之山', '人间之里', '博丽神社',
  '魔法森林', '香霖堂', '迷途竹林', '永远亭', '月都', '天界', '地狱',
  '异变', '结界', '符卡', '宴会', '例大祭', '赛钱', '退治', '幻想乡'
];

function canonNeedsWorld(text) {
  const hay = String(text || '').toLowerCase();
  return CANON_WORLD_KEYWORDS.some((kw) => hay.includes(kw.toLowerCase()));
}

// ---------- 每角色默认提示词分片 ----------
function agentDefaults(character) {
  const reimu = character === 'reimu';
  return {
    base_prompt: reimu ? DEFAULT_REIMU_PERSONA : DEFAULT_MARISA_PERSONA,
    goals: DEFAULT_AGENT_GOALS[character],
    memory_instructions: DEFAULT_AGENT_MEMORY[character],
    few_shots: extractPersonaFewShots(reimu ? DEFAULT_REIMU_RULES : DEFAULT_MARISA_RULES)
  };
}

// 组装每角色的 system 提示：base 人设 + 本回动机/目标 + 知识库使用说明。
// 台词范例（few_shots）不再放 system 开头（会被淹没），改由 buildMessages 在【此刻】块紧贴生成点注入。
function buildAgentSystemPrompt(agent) {
  const parts = [];
  if (agent.base_prompt) parts.push(agent.base_prompt);
  if (agent.goals) parts.push(`【本回动机/目标】\n${agent.goals}`);
  if (agent.memory_instructions) parts.push(`【知识库使用说明】\n${agent.memory_instructions}`);
  return parts.join('\n\n');
}

// ---------- 每角色 canon 文本 ----------
function labelFor(e) {
  if (e.category === '一设') return `【${e.character === 'reimu' ? '灵梦' : '魔理沙'}·一设】`;
  if (e.category === '世界观') return '【世界观】';
  if (e.category === '关系') return '【两人关系】';
  if (e.category === '易错提醒') return '【易错提醒】';
  return `【${e.category}】`;
}

// 双 agent 路径：只取「自己的 + shared」条目；世界观条目受 canonSmart 门控（沿用旧语义）
function agentCanonTextFor(character, topic, history, canonEntries) {
  if (config.canonEnabled === false) return '';
  const smart = config.canonSmart !== false;
  const contextText = `${topic || ''}\n${(history || []).map((m) => m && m.text).filter(Boolean).join('\n')}`;
  const parts = [];
  for (const e of canonEntries || []) {
    if (e.category === '世界观' && smart && !canonNeedsWorld(contextText)) continue;
    parts.push(`${labelFor(e)}\n${e.content}`);
  }
  return parts.join('\n\n');
}

module.exports = {
  CANON_WORLD_KEYWORDS,
  canonNeedsWorld,
  agentDefaults,
  buildAgentSystemPrompt,
  agentCanonTextFor
};
