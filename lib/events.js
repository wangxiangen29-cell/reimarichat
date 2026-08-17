const { state, pushLog } = require('./state');
const { beijingHour, beijingDateParts, scenePeriodKey } = require('./time');

// ---------- 心动瞬间记忆（本地关键词提取，不消耗 token） ----------
const HEART_WORDS = ['脸红', '耳尖', '耳朵', '牵手', '抱住', '约定', '明天', '一辈子', '最喜欢', '偷偷', '心跳', '舍不得', '等你', '回来', '温柔', '甜'];
function catchHeartMoments(texts) {
  if (!Array.isArray(state.heartMoments)) state.heartMoments = [];
  for (const t of (texts || [])) {
    const str = String(t || '').trim();
    if (!str || str.length < 4 || !HEART_WORDS.some((w) => str.includes(w))) continue;
    const line = str.slice(0, 42);
    if (state.heartMoments.includes(line)) continue;
    state.heartMoments.push(line);
    if (state.heartMoments.length > 5) state.heartMoments.shift();
  }
}
function heartMemoryText() {
  if (!state.heartMoments || !state.heartMoments.length) return '';
  const pick = state.heartMoments.slice(-2);
  return '【你们之间的小回忆】你们之前聊到过：' + pick.join('；') + '。如果合适，可以自然地呼应一下（比如“上次你说……”），不要强行提起，也不要当作当前话题反复强调。';
}

// ---------- 随机日常小事件（每天至多一次，本地生成） ----------
const DAILY_EVENTS = [
  { key: 'morning', text: '人间之里的早市捎来了两串新烤的团子，还热乎着' },
  { key: 'any', text: '香霖堂送来一箱新到的茶叶，附了张纸条：给神社的常客们尝尝' },
  { key: 'any', text: '一只乌鸦衔着红魔馆的邀请函落在鸟居上' },
  { key: 'any', text: '今天的赛钱箱里破天荒地躺着一枚金币' },
  { key: 'any', text: '魔理沙的扫帚又抽风了，一头栽进院子里的灌木丛' },
  { key: 'any', text: '一阵风卷着花瓣扑进屋里，落了一桌' },
  { key: 'any', text: '窗外忽然传来“咔嚓”一声，晾着的巫女服被风吹落了' },
  { key: 'any', text: '魔理沙的帽子里掉出一颗新采的蘑菇，被围观的妖精捡走了' },
  { key: 'any', text: '神社的老树上多了个陌生的小窝，里面放着一颗糖' },
  { key: 'dusk', text: '黄昏的风里带着烤红薯的香气，人间之里那边炊烟袅袅' },
  { key: 'night', text: '夜空划过一颗流星，两人不约而同地抬头' }
];
function maybeDailyEvent() {
  const { m, day } = beijingDateParts();
  const today = `${m}-${day}`;
  if (state.lastEventDay === today) return;
  state.lastEventDay = today;
  if (Math.random() >= 0.45) return;
  const p = scenePeriodKey(beijingHour());
  const pool = DAILY_EVENTS.filter((e) => e.key === 'any' || e.key === p);
  if (!pool.length) return;
  const ev = pool[Math.floor(Math.random() * pool.length)];
  state.pendingEvent = ev.text;
  pushLog('system', '（' + ev.text + '）');
}
function pendingEventText() {
  if (!state.pendingEvent) return '';
  const t = state.pendingEvent;
  state.pendingEvent = null;
  return '【刚刚发生的小事】' + t + '。两人自然地聊到或处理了这件事，可以各抒己见或一起行动，但不要用“刚才发生了什么”之类的场外说明，也不要突然跳到别的题目。';
}

module.exports = { HEART_WORDS, catchHeartMoments, heartMemoryText, DAILY_EVENTS, maybeDailyEvent, pendingEventText };
