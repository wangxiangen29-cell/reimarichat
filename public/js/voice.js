import { CHARACTERS } from './core.js';

const VOICE_KEY = 'gensokyo-galgame-voice-v3';
const defaults = {
  enabled: false,
  mode: 'browser',
  rate: 1,
  pitch: 1
};

let settings = loadSettings();
let lastLine = null;
let currentAudio = null;
let token = 0;

function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(VOICE_KEY) || '{}') };
  } catch (_) {
    return { ...defaults };
  }
}

function saveSettings() {
  try { localStorage.setItem(VOICE_KEY, JSON.stringify(settings)); } catch (_) {}
}

function $(id) { return document.getElementById(id); }

function setStatus(text, tone = '') {
  const el = $('voiceStatus');
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

function updateToggle() {
  const btn = $('voiceToggle');
  if (!btn) return;
  btn.textContent = settings.enabled ? '◉ 语音：开' : '◉ 语音：关';
  btn.setAttribute('aria-pressed', String(settings.enabled));
  btn.classList.toggle('voice-on', settings.enabled);
}

function renderSettings() {
  const mode = $('voiceModeSelect');
  const rate = $('voiceRateInput');
  const pitch = $('voicePitchInput');
  if (mode) mode.value = settings.mode;
  if (rate) rate.value = settings.rate;
  if (pitch) pitch.value = settings.pitch;
  const rateValue = $('voiceRateValue');
  const pitchValue = $('voicePitchValue');
  if (rateValue) rateValue.textContent = Number(settings.rate).toFixed(2);
  if (pitchValue) pitchValue.textContent = Number(settings.pitch).toFixed(2);
  updateToggle();
  setStatus(settings.mode === 'yukkuri' ? '油库里接口待机' : '浏览器语音待机');
}

function bindField(id, key, parse = (value) => value) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input', () => {
    settings[key] = parse(el.value);
    saveSettings();
    if (key === 'rate') $('voiceRateValue').textContent = Number(settings.rate).toFixed(2);
    if (key === 'pitch') $('voicePitchValue').textContent = Number(settings.pitch).toFixed(2);
    if (key === 'mode') setStatus(settings.mode === 'yukkuri' ? '油库里接口待机' : '浏览器语音待机');
  });
}

export function initVoice() {
  renderSettings();
  const toggle = $('voiceToggle');
  if (toggle) toggle.addEventListener('click', () => {
    settings.enabled = !settings.enabled;
    saveSettings();
    updateToggle();
    if (!settings.enabled) stopVoice();
    setStatus(settings.enabled ? '语音已开启' : '语音已关闭', settings.enabled ? 'ok' : '');
  });
  const replay = $('voiceReplayBtn');
  if (replay) replay.addEventListener('click', () => {
    if (lastLine) speakLine(lastLine.speaker, lastLine.text, true);
    else setStatus('还没有可重播的台词');
  });
  bindField('voiceModeSelect', 'mode');
  bindField('voiceRateInput', 'rate', Number);
  bindField('voicePitchInput', 'pitch', Number);
}

function pickBrowserVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find((voice) => /^zh(-|_)?CN/i.test(voice.lang))
    || voices.find((voice) => /Chinese|中文|中国/i.test(voice.name))
    || voices[0];
}

function speakBrowser(text, speaker) {
  if (!window.speechSynthesis) throw new Error('浏览器不支持语音合成');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.voice = pickBrowserVoice() || null;
  utterance.rate = Math.max(0.1, Number(settings.rate) + (speaker === 'marisa' ? 0.05 : -0.03));
  utterance.pitch = Math.max(0.1, Number(settings.pitch) + (speaker === 'reimu' ? 0.08 : -0.02));
  utterance.onstart = () => setStatus(`${CHARACTERS[speaker]?.name || '角色'}正在说话`, 'ok');
  utterance.onend = () => setStatus('浏览器语音待机');
  utterance.onerror = () => setStatus('浏览器语音播放失败', 'error');
  window.speechSynthesis.speak(utterance);
}

async function speakYukkuri(text, speaker, requestToken) {
  // 油库里语音由网站服务器统一代理（/api/tts → 服务器本机的 yukkuri 服务），浏览器无需任何配置
  const url = `/api/tts?text=${encodeURIComponent(text)}&speaker=${encodeURIComponent(speaker)}`;
  const audioRes = await fetch(url);
  if (!audioRes.ok) {
    const detail = await audioRes.text().catch(() => '');
    throw new Error(`语音合成失败（${audioRes.status}）${detail.slice(0, 120)}`);
  }
  if (requestToken !== token) return;
  const blob = await audioRes.blob();
  if (currentAudio) currentAudio.pause();
  currentAudio = new Audio(URL.createObjectURL(blob));
  // ykcn 引擎不支持变速变调，语速用播放速率模拟，音调仅对浏览器语音生效
  currentAudio.playbackRate = Math.min(2, Math.max(0.5, Number(settings.rate) || 1));
  currentAudio.onplay = () => setStatus(`${CHARACTERS[speaker]?.name || '角色'}正在说话`, 'ok');
  currentAudio.onended = () => setStatus('油库里接口待机');
  await currentAudio.play();
}

export function stopVoice() {
  token += 1;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

export async function speakLine(speaker, text, force = false) {
  if (!text || speaker === 'user' || speaker === 'system' || speaker === 'narration') return;
  lastLine = { speaker, text: String(text).trim() };
  if (!settings.enabled && !force) return;
  const requestToken = ++token;
  stopVoice();
  const activeToken = ++token;
  setStatus(settings.mode === 'yukkuri' ? '连接油库里接口…' : '准备播放…');
  try {
    if (settings.mode === 'yukkuri') {
      await speakYukkuri(lastLine.text, speaker, activeToken);
    } else {
      speakBrowser(lastLine.text, speaker);
    }
  } catch (err) {
    if (activeToken !== token) return;
    setStatus('油库里未连接，已回退浏览器语音', 'error');
    try { speakBrowser(lastLine.text, speaker); } catch (_) {}
  }
}

export function getLastLine() {
  return lastLine;
}
