const { config } = require('./config');
const { state, pushLog } = require('./state');
const { beijingHour, beijingDateParts } = require('./time');

// ---------- 场景氛围（纯本地旁白，不消耗 token） ----------
function specialDayLine(d = new Date()) {
  const { m, day } = beijingDateParts(d);
  const map = {
    '1-1': '（新年的钟声还在回响，神社的初詣香客刚刚散尽）',
    '5-5': '（风里飘着粽叶香，人间之里似乎在准备过节）',
    '10-31': '（今晚幻想乡格外热闹，听说妖怪们要开什么“万圣”聚会）',
    '12-25': '（夜里落了雪，神社的灯笼映着雪花，安安静静的）'
  };
  return map[m + '-' + day] || '';
}

function ambientLine(d = new Date()) {
  const h = beijingHour(d);
  const pools = {
    dawn: ['（晨雾还没散，鸟已经在枝头叫起来了）', '（晨光从云缝漏下来，露水把石阶打得微亮）'],
    morning: ['（上午的阳光正好，把廊下晒得暖洋洋的）', '（风里飘着若有若无的花香，让人想赖着不动）'],
    noon: ['（日头正高，蝉鸣一阵接一阵）', '（午后的风把竹帘吹得轻轻晃）'],
    afternoon: ['（下午的光线变柔了，影子在榻榻米上慢慢爬）', '（茶凉了一会儿，又被续上了热水）'],
    dusk: ['（夕阳把神社的走廊染成橘色，风里带着晚饭的香气）', '（晚霞铺开半边天，屋檐的影子拉得老长）'],
    night: ['（月色很淡，远处传来几声虫鸣）', '（夜风凉丝丝的，把灯影吹得轻轻摇）'],
    deep: ['（万籁俱寂，只有更漏一样的心跳声）', '（星光很淡，神社安静得像沉进了梦里）']
  };
  const key = h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 11 ? 'morning' : h >= 11 && h < 14 ? 'noon' : h >= 14 && h < 17 ? 'afternoon' : h >= 17 && h < 20 ? 'dusk' : h >= 20 && h < 23 ? 'night' : 'deep';
  let pool = pools[key] || pools.morning;
  if (Math.random() < 0.35) {
    pool = pool.concat(['（屋檐下滴答滴答，不知什么时候下起了小雨）', '（一阵风卷着花瓣扑簌簌落在廊下）']);
  }
  return pool[Math.floor(Math.random() * pool.length)] || '';
}

function maybeAmbient() {
  state.ambientCounter = (state.ambientCounter || 0) + 1;
  const every = Math.max(3, Number(config.ambientEvery) || 8);
  if (state.ambientCounter < every) return;
  state.ambientCounter = 0;
  const line = specialDayLine() || weatherAmbientLine() || ambientLine();
  if (line) pushLog('system', line);
}

const GIFT_TYPES = [
  { id: 'dango', text: '一串琥珀色的烤团子', icon: '🍡' },
  { id: 'mushroom', text: '三颗胖乎乎的鲜蘑菇', icon: '🍄' },
  { id: 'blossom', text: '一枝沾着露水的樱花', icon: '🌸' },
  { id: 'tea', text: '一包后院新焙的茶叶', icon: '🍵' },
  { id: 'coin', text: '一枚亮闪闪的香油钱', icon: '🪙' },
  { id: 'book', text: '一本“暂时借来”的魔法书', icon: '📖' }
];
function handleGift(body) {
  const voterId = String(body.voterId || '').trim();
  if (!voterId || voterId.length > 64) return { status: 400, error: '缺少有效的观众身份' };
  const gift = GIFT_TYPES.find((g) => g.id === String(body.giftId || '').trim());
  if (!gift) return { status: 400, error: '没有这种礼物' };
  if (!config.autoChatEnabled) return { status: 400, error: '自动闲聊未开启，暂时不能投喂' };
  const now = Date.now();
  const last = state.giftCooldown.get(voterId) || 0;
  if (now - last < 20000) return { status: 429, error: '送得太快啦，歇一会儿再送吧' };
  state.giftCooldown.set(voterId, now);
  if (state.giftCooldown.size > 2000) {
    for (const [k, v] of state.giftCooldown) {
      if (now - v > 120000) state.giftCooldown.delete(k);
    }
  }
  state.giftQueue.push({ text: gift.text, ts: now });
  if (state.giftQueue.length > 3) state.giftQueue.shift();
  pushLog('system', '（观众送来了：' + gift.text + '）');
  return { status: 200, ok: true, cooldownMs: 20000 };
}
function giftInjectionText() {
  if (!state.giftQueue || !state.giftQueue.length) return '';
  const items = state.giftQueue.map((g) => g.text);
  state.giftQueue = [];
  return '【观众送的礼物】直播间里刚才有人送来了：' + items.join('、') + '。两人可以自然地提一句、尝一口、收下或道谢，也可以调侃一句；随性自然，不要长篇大论地道谢，不要主动解释这是观众投喂。';
}

function refreshWeather() {
  const { m, day } = beijingDateParts();
  const today = m + '-' + day;
  if (state.weather && state.weather.day === today) return state.weather;
  const winter = m === 12 || m === 1 || m === 2;
  const roll = Math.random();
  let kind = 'sunny';
  if (winter && roll < 0.16) kind = 'snow';
  else if (roll < 0.34) kind = 'rain';
  else if (roll < 0.55) kind = 'cloudy';
  else if (roll < 0.70) kind = 'wind';
  state.weather = { day: today, kind };
  return state.weather;
}
function weatherInjectionText() {
  const w = refreshWeather();
  const labels = {
    sunny: '今日天气：晴。阳光正好，风也温柔，两人可以自然提到晒被褥、出门走走、茶喝得格外香之类的小事；不要像报天气那样生硬地介绍。',
    cloudy: '今日天气：多云。云把太阳挡得忽明忽暗，风里带着一点想下雨又没下的潮气。',
    rain: '今日天气：小雨。屋檐一直在滴水，石阶湿漉漉的，两人多半得窝在屋里；可以自然提到收衣服、借伞、路上溅水等。',
    wind: '今日天气：大风。院子里的落叶和晾着的衣服被吹得乱飞，扫帚都快站不稳了。',
    snow: '今日天气：雪。世界安静下来，呼出的气都是白的，木屐踩在雪上咯吱响。'
  };
  return labels[w.kind] || labels.sunny;
}
function weatherAmbientLine() {
  const w = refreshWeather();
  const pools = {
    sunny: ['（阳光正好，把晾着的巫女服晒得蓬松）', '（天很蓝，云朵慢悠悠地飘）'],
    cloudy: ['（云层很厚，阳光偶尔漏下一束又合上）', '（天色阴沉，风里带着潮气）'],
    rain: ['（屋檐滴答滴答地下着雨，院里积了浅浅的水洼）', '（雨丝斜斜地飘，石阶被打湿了）'],
    wind: ['（风很大，院子里的落叶打着旋到处跑）', '（晾衣绳上的东西被吹得哗啦响）'],
    snow: ['（雪落得又轻又密，世界安静下来）', '（屋檐挂下一排冰棱，闪着细碎的光）']
  };
  const pool = pools[w.kind] || pools.sunny;
  return pool[Math.floor(Math.random() * pool.length)] || '';
}

module.exports = {
  specialDayLine,
  ambientLine,
  maybeAmbient,
  GIFT_TYPES,
  handleGift,
  giftInjectionText,
  refreshWeather,
  weatherInjectionText,
  weatherAmbientLine
};
