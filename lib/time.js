const { config } = require('./config');

// 中国（Asia/Shanghai）无夏令时，固定 UTC+8，按北京时间取小时
function beijingHour(d = new Date()) {
  return (d.getUTCHours() + 8) % 24;
}

function timePeriodLabel(d = new Date()) {
  const h = beijingHour(d);
  if (h >= 5 && h < 8) return '清晨';
  if (h >= 8 && h < 11) return '上午';
  if (h >= 11 && h < 14) return '中午';
  if (h >= 14 && h < 17) return '下午';
  if (h >= 17 && h < 20) return '傍晚';
  if (h >= 20 && h < 23) return '晚上';
  return '深夜';
}

function isSleepingTime(d = new Date()) {
  const start = Number(config.sleepStartHour);
  const end = Number(config.sleepEndHour);
  const h = beijingHour(d);
  if (Number.isNaN(start) || Number.isNaN(end) || start === end) return false;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}

function beijingDateParts(d = new Date()) {
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
  return { m: bj.getUTCMonth() + 1, day: bj.getUTCDate() };
}

function scenePeriodKey(h) {
  return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 11 ? 'morning' : h >= 11 && h < 14 ? 'noon' : h >= 14 && h < 17 ? 'afternoon' : h >= 17 && h < 20 ? 'dusk' : h >= 20 && h < 23 ? 'night' : 'deep';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { beijingHour, timePeriodLabel, isSleepingTime, beijingDateParts, scenePeriodKey, sleep };
