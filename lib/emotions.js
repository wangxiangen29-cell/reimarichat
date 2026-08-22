// ---------- 情绪注册表：立绘差分的情绪种类（可扩展），存 data/emotions.json ----------
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'emotions.json');
const AVATAR_DIR = path.join(__dirname, '..', 'public', 'avatars');
const KEY_RE = /^[a-z0-9_]{2,20}$/;

// 内置默认（label 用于 AI 提示词与标注页；keywords 供前端在 AI 未标注时做关键词兜底）
const DEFAULT_EMOTIONS = [
  { key: 'normal', label: '平常', keywords: '' },
  { key: 'smile', label: '开心笑', keywords: '嘻嘻,嘿嘿,哈哈,好耶,太好了,开心,高兴,忍不住,笑' },
  { key: 'shy', label: '害羞脸红', keywords: '脸红,红着脸,害羞,心跳,扑通,耳根,发烫,不好意思,脸热,红了脸' },
  { key: 'angry', label: '生气不悦', keywords: '生气,气死,可恶,不许,别碰,真是的,烦死,气人,讨厌,哼' },
  { key: 'surprise', label: '惊讶慌张', keywords: '咦,吓,惊,怎么会,？！,！？,难道' },
  { key: 'sad', label: '难过失落', keywords: '难过,失落,对不起,抱歉,叹气,眼泪,想哭,寂寞,孤单' },
  { key: 'smug', label: '得意坏笑', keywords: '得意,坏笑,瞧瞧,看吧,我说吧,交给我,包在我身上' },
  { key: 'think', label: '疑惑思考', keywords: '想想,思考,奇怪,纳闷,琢磨,怎么说呢,让我想' },
  { key: 'wry', label: '无奈吐槽', keywords: '无奈,吐槽,扶额,没救了,算了,真是服了,服了' }
];

let cached = null;

function loadEmotions() {
  if (cached) return cached;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (Array.isArray(raw) && raw.length) {
      cached = raw.filter((e) => e && KEY_RE.test(String(e.key)));
      return cached;
    }
  } catch (_) {}
  cached = JSON.parse(JSON.stringify(DEFAULT_EMOTIONS));
  return cached;
}

function saveEmotions(list) {
  cached = list;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function normalizeEmotion(e) {
  const key = String(e && e.key || '').trim().toLowerCase();
  const label = String(e && e.label || '').trim();
  const keywords = String(e && e.keywords || '').trim();
  if (!KEY_RE.test(key)) return { error: '情绪 key 只能是小写字母/数字/下划线，2~20 位' };
  if (!label || label.length > 10) return { error: '情绪名称不能为空且最多 10 个字' };
  if (keywords.length > 120) return { error: '兜底关键词最多 120 字（逗号分隔）' };
  return { item: { key, label, keywords } };
}

// 该情绪是否已存在任一角色的差分图（normal 对应 *_full.png）
function emotionHasArt(key) {
  const suffix = key === 'normal' ? 'full' : key;
  return ['reimu', 'marisa'].some((c) => fs.existsSync(path.join(AVATAR_DIR, `${c}_${suffix}.png`)));
}

// AI 批量协议里展示的情绪菜单（只列已有差分图的，避免 AI 选了没图的）
function emotionMenuText() {
  return loadEmotions()
    .filter((e) => emotionHasArt(e.key))
    .map((e) => `${e.key}（${e.label}）`)
    .join(' / ');
}

function emotionKeys() {
  return new Set(loadEmotions().map((e) => e.key));
}

module.exports = { loadEmotions, saveEmotions, normalizeEmotion, emotionHasArt, emotionMenuText, emotionKeys, DEFAULT_EMOTIONS };
