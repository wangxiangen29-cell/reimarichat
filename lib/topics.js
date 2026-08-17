const demo = require('../public/demo');
const { config } = require('./config');
const { state, demoEngine, pushLog } = require('./state');
const { aiUsable, speakerName, callAI, cleanDialogueLine } = require('./ai');

// ---------- 话题 ----------

function pickRandomTopic() {
  const pool = demo.TOPIC_POOL.filter((t) => t !== state.currentTopic);
  if (!pool.length) return demo.TOPIC_POOL[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function pickRelatedTopic() {
  if (!aiUsable()) return '';
  const recent = state.aiHistory
    .slice(-8)
    .map((m) => `${speakerName(m.speaker)}：${m.text}`)
    .join('\n');
  const prompt = [
    { role: 'system', content: '你是东方Project同人对话的编剧。请根据两人最近的对话，给出一个 3~12 字的新话题：它要从刚才聊的内容里自然长出来（比如由某样东西、某个词、某句心情延伸），不要凭空跳走，要适合甜甜的主角组日常；只输出话题本身，不要加引号、标点或解释。' },
    { role: 'user', content: `最近对话：\n${recent || '（无）'}` }
  ];
  try {
    const raw = await callAI(config.deepseekApiKey, config.baseUrl, config.model, prompt, 0.85, 300);
    let topic = cleanDialogueLine(raw).replace(/[。！？，、；：\s]/g, '');
    topic = topic.replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '').trim();
    if (topic.length >= 2 && topic.length <= 16 && topic !== state.currentTopic) return topic;
  } catch (err) {
    console.error('生成相关话题失败：', err.message);
  }
  return '';
}

async function rotateTopic() {
  let next = null;
  if (state.candidates.length) {
    const sorted = [...state.candidates].sort((a, b) => b.votes.size - a.votes.size);
    if (sorted[0].votes.size > 0) next = sorted[0].text;
  }
  if (!next && Math.random() < 0.4) next = await pickRelatedTopic();
  if (!next) return false;
  state.currentTopic = next;
  state.topicStartTs = Date.now();
  state.candidates = [];
  state.aiHistory = state.aiHistory.slice(-4);
  state.autoSummary = null;
  state.autoQueue = [];
  state.topicTransition = true;
  demoEngine.reset();
  pushLog('system', `（聊着聊着，两人自然地说起了「${next}」）`);
  return true;
}

module.exports = { pickRandomTopic, pickRelatedTopic, rotateTopic };
