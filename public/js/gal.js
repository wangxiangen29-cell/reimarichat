// ---------- Galgame 式对话框引擎：台词逐句排队，点击 / 回车 / 空格推进 ----------
// 出字用打字机效果，点一下未打完的句子会立即补全；队列空了但仍在生成时显示加载提示。
import { els, state, CHARACTERS } from './core.js';
import { appendMessage, appendNarration, appendSystem } from './render.js';
import { speakLine } from './voice.js';

const TYPE_MS = 26;
const PUNCT_SLOW = '。！？…—!?';
const PUNCT_MID = '，、；：,~～';

const NAME_LABELS = {
  reimu: '博丽灵梦',
  marisa: '雾雨魔理沙',
  user: '旁白',
  narration: '旁白',
  system: '系统'
};

// ---------- 立绘差分：情绪由服务器注册表驱动（/api/emotions），AI 标注优先、关键词兜底 ----------
// files[char][emotion] = 差分图地址；rules = 关键词兜底正则（来自注册表 keywords）
const files = { reimu: {}, marisa: {} };
const rules = [];

function portraitImg(speaker) {
  const el = document.getElementById(speaker === 'marisa' ? 'marisaPortrait' : 'reimuPortrait');
  return el ? el.querySelector('img') : null;
}

function emotionFile(char, key) {
  return files[char] && files[char][key] || null;
}

function setPortrait(speaker, emotion) {
  const img = portraitImg(speaker);
  if (!img) return;
  const base = files[speaker] && files[speaker].base;
  if (!base) return;
  const src = emotion ? emotionFile(speaker, emotion) : null;
  const finalSrc = src || base;
  if (img.dataset.emotion === finalSrc) return;
  img.dataset.emotion = finalSrc;
  img.style.opacity = '0.25';
  img.onload = () => { img.style.opacity = ''; };
  img.onerror = () => { img.dataset.emotion = ''; img.src = base; };
  img.src = finalSrc;
}

function detectEmotion(text) {
  const t = String(text || '');
  for (const [emo, re] of rules) {
    if (re.test(t)) return emo;
  }
  return null;
}

// 拉取情绪注册表：注册有差分图的情绪 + 构建 keywords 兜底正则
async function loadEmotionRegistry() {
  try {
    const res = await fetch('/api/emotions', { cache: 'no-store' });
    const data = await res.json();
    const list = Array.isArray(data.emotions) ? data.emotions : [];
    for (const char of ['reimu', 'marisa']) {
      files[char] = { base: `avatars/${char}_full.png` };
    }
    for (const e of list) {
      const suffix = e.key === 'normal' ? 'full' : e.key;
      for (const char of ['reimu', 'marisa']) {
        const src = `avatars/${char}_${suffix}.png`;
        // 探测差分图是否存在（存在才注册，避免切换到 404）
        const probe = new Image();
        probe.onload = () => { if (files[char]) files[char][e.key] = src; };
        probe.src = src;
      }
      if (e.key !== 'normal' && e.keywords) {
        const parts = String(e.keywords).split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        if (parts.length) {
          const safe = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
          rules.push([e.key, new RegExp(safe)]);
        }
      }
    }
  } catch (_) {}
}

const views = {};

function makeView(name, ids, backlog, backlogBtn) {
  const dom = {};
  for (const key of Object.keys(ids)) dom[key] = document.getElementById(ids[key]);
  const v = {
    name, dom, backlog, backlogBtn,
    queue: [], current: null, producer: false, finished: false,
    waiters: [], backlogOpen: false,
    idleHTML: dom.text ? dom.text.innerHTML : ''
  };
  if (dom.box) dom.box.addEventListener('click', () => advance(name));
  if (backlogBtn) backlogBtn.addEventListener('click', () => toggleBacklog(name));
  return v;
}

export function initGal() {
  views.manual = makeView('manual', {
    box: 'galBox', nameplate: 'galNameplate', text: 'galText', cursor: 'galCursor', hint: 'galHint'
  }, els.chatLog, document.getElementById('manualBacklogBtn'));
  views.auto = makeView('auto', {
    box: 'autoGalBox', nameplate: 'autoGalNameplate', text: 'autoGalText', cursor: 'autoGalCursor', hint: 'autoGalHint'
  }, els.autoChatLog, document.getElementById('autoBacklogBtn'));
  loadEmotionRegistry();
}

function activeName() {
  return !els.autoView.hidden ? 'auto' : 'manual';
}

// ---------- 渲染 ----------

function setHint(v, text, tone) {
  const el = v.dom.hint;
  if (!el) return;
  el.hidden = !text;
  el.textContent = text || '';
  el.dataset.tone = tone || '';
}

function renderLine(v) {
  const c = v.current;
  const d = v.dom;
  if (!c) return;
  d.nameplate.hidden = false;
  d.nameplate.textContent = NAME_LABELS[c.speaker] || c.speaker;
  d.box.className = 'gal-box speaker-' + c.speaker;
  d.text.textContent = c.shown;
  d.cursor.hidden = !c.done;
  setHint(v, '');
}

function renderIdle(v) {
  const d = v.dom;
  d.nameplate.hidden = true;
  d.cursor.hidden = true;
  d.box.className = 'gal-box';
  if (v.producer) {
    d.text.innerHTML = '<div class="gal-loading"><i></i><i></i><i></i><span>'
      + (v.name === 'manual' ? '正在准备台词…' : '等待下一句闲聊…') + '</span></div>';
    setHint(v, '正在生成中，稍等一下，好了会自动出现');
  } else if (v.finished) {
    d.text.innerHTML = '<div class="gal-done">— 本段对话结束 —</div>';
    setHint(v, v.name === 'manual' ? '点「继续对话」接着聊，或插一句旁白' : '等下一轮闲聊开启');
  } else {
    d.text.innerHTML = v.idleHTML;
    setHint(v, '');
  }
}

function renderCurrentText(v) {
  const c = v.current;
  if (!c) return;
  v.dom.text.textContent = c.shown;
  v.dom.cursor.hidden = !c.done;
}

// ---------- 打字机 ----------

function typeTick(v) {
  const c = v.current;
  if (!c) return;
  if (c.shown.length < c.text.length) {
    c.shown = c.text.slice(0, c.shown.length + 1);
    renderCurrentText(v);
    const ch = c.shown[c.shown.length - 1];
    const delay = PUNCT_SLOW.includes(ch) ? 150 : PUNCT_MID.includes(ch) ? 70 : TYPE_MS;
    c.timer = setTimeout(() => typeTick(v), delay);
  } else {
    c.done = true;
    clearTimeout(c.timer);
    renderCurrentText(v);
  }
}

function finishTyping(v) {
  const c = v.current;
  if (!c) return;
  clearTimeout(c.timer);
  c.shown = c.text;
  c.done = true;
  renderCurrentText(v);
}

function highlightPortraits(speaker) {
  const reimuPortrait = document.getElementById('reimuPortrait');
  const marisaPortrait = document.getElementById('marisaPortrait');
  if (!reimuPortrait || !marisaPortrait) return;
  const talking = speaker === 'reimu' || speaker === 'marisa';
  reimuPortrait.classList.toggle('is-speaking', talking && speaker === 'reimu');
  marisaPortrait.classList.toggle('is-speaking', talking && speaker === 'marisa');
}

// ---------- 台词流转 ----------

function showNext(v) {
  const item = v.queue.shift();
  if (!item) return;
  v.finished = false;
  v.current = {
    speaker: item.speaker,
    text: item.text,
    shown: '',
    done: false,
    timer: null
  };
  renderLine(v);
  highlightPortraits(item.speaker);
  // 立绘表情：优先执行 AI 在台词里附带的情绪指令（switch_portrait 协议），无指令时用关键词兜底
  if (item.speaker === 'reimu' || item.speaker === 'marisa') {
    const aiEmo = item.emotion && emotionFile(item.speaker, item.emotion) ? item.emotion : '';
    const emo = aiEmo === 'normal' ? null : (aiEmo || detectEmotion(item.text));
    setPortrait(item.speaker, emo);
    speakLine(item.speaker, item.text);
  }
  typeTick(v);
}

function archive(v, item) {
  const prevSuppress = state.suppressScroll;
  state.suppressScroll = true;
  try {
    if (item.speaker === 'system') {
      appendSystem(item.text, v.backlog);
    } else if (item.speaker === 'user' || item.speaker === 'narration') {
      appendNarration(item.text, v.backlog);
    } else {
      appendMessage(item.speaker, item.text, v.backlog);
    }
  } finally {
    state.suppressScroll = prevSuppress;
  }
  if (v.backlogOpen && v.backlog) {
    v.backlog.scrollTop = v.backlog.scrollHeight;
  }
}

function resolveWaiters(v) {
  if (v.queue.length || v.current) return;
  const list = v.waiters.splice(0);
  for (const fn of list) fn();
}

function pulseHint(v) {
  const el = v.dom.hint;
  if (!el) return;
  if (v.producer) {
    setHint(v, '别急，下一句还在准备中…', 'wait');
  } else if (v.finished) {
    setHint(v, '本段已经结束啦，点「继续对话」接着聊', 'wait');
  }
  if (!el.textContent) return;
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
  clearTimeout(v.pulseTimer);
  v.pulseTimer = setTimeout(() => el.classList.remove('pulse'), 1100);
}

function advance(name) {
  const v = views[name];
  if (!v) return;
  if (v.current && !v.current.done) {
    finishTyping(v);
    return;
  }
  if (v.current && v.current.done) {
    archive(v, v.current);
    v.current = null;
    if (v.queue.length) {
      showNext(v);
    } else {
      renderIdle(v);
      resolveWaiters(v);
    }
    return;
  }
  if (v.queue.length) {
    showNext(v);
    return;
  }
  pulseHint(v);
}

export function advanceActive() {
  advance(activeName());
}

// ---------- 对外接口 ----------

export function enqueueGal(name, speaker, text, emotion) {
  const v = views[name];
  const t = String(text == null ? '' : text).trim();
  if (!v || !t) return;
  v.queue.push({ speaker, text: t, emotion: emotion || null });
  v.finished = false;
  if (!v.current) showNext(v);
}

export function beginGal(name) {
  const v = views[name];
  if (!v) return;
  discardCurrent(v);
  v.queue = [];
  v.producer = true;
  v.finished = false;
  renderIdle(v);
}

export function setProducerGal(name, on) {
  const v = views[name];
  if (!v) return;
  v.producer = !!on;
  if (!v.producer && !v.queue.length && !v.current) {
    v.finished = true;
  }
  if (!v.current) renderIdle(v);
}

function resetPortraitAll() {
  setPortrait('reimu', null);
  setPortrait('marisa', null);
}

export function endGal(name) {
  const v = views[name];
  if (!v) return;
  v.producer = false;
  // 正常结束队列应为空；万一还有没点完的，收进记录免得丢
  flushGal(name, { keepBacklog: true });
  v.finished = true;
  renderIdle(v);
  resetPortraitAll();
}

export function waitDrainGal(name) {
  const v = views[name];
  if (!v) return Promise.resolve();
  return new Promise((resolve) => {
    v.waiters.push(resolve);
    resolveWaiters(v);
  });
}

// 冲刷：把当前句和队列全部立即归档（keepBacklog=true）或丢弃（false），并唤醒等待方
export function flushGal(name, { keepBacklog = true } = {}) {
  const v = views[name];
  if (!v) return;
  discardCurrent(v);
  if (keepBacklog) {
    while (v.queue.length) archive(v, v.queue.shift());
  } else {
    v.queue = [];
  }
  v.producer = false;
  v.finished = false;
  renderIdle(v);
  resetPortraitAll();
  resolveWaiters(v);
}

export function resetGal(name) {
  const v = views[name];
  if (!v) return;
  discardCurrent(v);
  v.queue = [];
  v.producer = false;
  v.finished = false;
  renderIdle(v);
  resetPortraitAll();
  resolveWaiters(v);
}

function discardCurrent(v) {
  if (v.current) {
    clearTimeout(v.current.timer);
    v.current = null;
  }
}

export function redrawGal() {
  for (const v of Object.values(views)) {
    if (v.current) renderLine(v);
    else renderIdle(v);
  }
}

function toggleBacklog(name) {
  const v = views[name];
  if (!v || !v.backlog || !v.backlogBtn) return;
  v.backlogOpen = !v.backlogOpen;
  v.backlog.hidden = !v.backlogOpen;
  v.backlogBtn.textContent = v.backlogOpen ? '收起记录' : '记录';
  if (v.backlogOpen) v.backlog.scrollTop = v.backlog.scrollHeight;
}
