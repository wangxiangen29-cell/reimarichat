import { els, CHARACTERS, state } from './core.js';

// ---------- 提示 ----------
let toastTimer = null;
export function toast(msg) {
  els.toastEl.textContent = msg;
  els.toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toastEl.hidden = true;
  }, 5200);
}

// ---------- 关于弹窗 ----------
export function openAbout() {
  els.aboutModal.hidden = false;
}

export function closeAbout() {
  els.aboutModal.hidden = true;
}

// ---------- 断句与渲染 ----------
export function splitSentences(text) {
  const raw = String(text || '').trim();
  const chars = Array.from(raw);
  const STRONG = new Set(['。', '！', '？', '!', '?', '…', '—']);
  const DROP = new Set(['，', '；', '：']);
  const sentences = [];
  let buf = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (STRONG.has(ch)) {
      let punct = ch;
      while (i + 1 < chars.length && chars[i + 1] === ch) {
        punct += chars[i + 1];
        i++;
      }
      if (buf.trim()) {
        sentences.push(buf.trim() + punct);
        buf = '';
      }
    } else if (DROP.has(ch)) {
      if (buf.trim().length >= 2) {
        sentences.push(buf.trim());
        buf = '';
      }
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) sentences.push(buf.trim());
  return sentences;
}

export function mergePunctOnly(speaker, part, container) {
  if (!part) return false;
  const log = container || els.chatLog;
  const rows = log.querySelectorAll('.msg.' + speaker);
  const lastRow = rows[rows.length - 1];
  if (!lastRow) return false;
  const textEl = lastRow.querySelector('.bubble > div:last-child');
  if (!textEl || !textEl.textContent) return false;
  textEl.textContent += part;
  if (!state.suppressScroll) scrollToBottom();
  return true;
}

export function appendMessageSplit(speaker, text, container) {
  const sentences = splitSentences(text);
  const raw = String(text || '').trim();
  const parts = sentences.length ? sentences : [raw].filter(Boolean);
  for (const part of parts) {
    if (parts.length === 1 && /^[\s，。！？!?…—、；：,.!?~～…·]+$/.test(part) && mergePunctOnly(speaker, part, container)) {
      continue;
    }
    appendMessage(speaker, part, container);
  }
}

export function appendMessage(speaker, text, container) {
  const log = container || els.chatLog;
  let display = String(text == null ? '' : text).trim();
  const selfName = speaker === 'marisa' ? '魔理沙' : '灵梦';
  const m = display.match(new RegExp('^' + selfName + '\\s*[:：,，。.、!！?？…~～ ]+'));
  if (m) display = display.slice(m[0].length).trim();
  if (!display || display === selfName) return null;
  const row = document.createElement('div');
  row.className = `msg ${speaker}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  const img = document.createElement('img');
  if (speaker === 'user') {
    img.src = 'avatars/reimu_head.png';
    img.alt = '你';
    avatar.style.opacity = '0.55';
  } else {
    img.src = CHARACTERS[speaker].avatar;
    img.alt = CHARACTERS[speaker].full;
  }
  avatar.appendChild(img);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = speaker === 'user' ? '旁白' : CHARACTERS[speaker].full;
  const textEl = document.createElement('div');
  textEl.textContent = display;
  bubble.appendChild(who);
  bubble.appendChild(textEl);

  row.appendChild(avatar);
  row.appendChild(bubble);
  log.appendChild(row);
  if (!state.suppressScroll) scrollToBottom();
  return row;
}

export function appendSystem(text, container) {
  const log = container || els.chatLog;
  const row = document.createElement('div');
  row.className = 'msg system';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  log.appendChild(row);
  if (!state.suppressScroll) scrollToBottom();
}

export function appendNarration(text, container) {
  const log = container || els.chatLog;
  const row = document.createElement('div');
  row.className = 'msg narration';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = '旁白';
  const textEl = document.createElement('div');
  textEl.textContent = text;
  bubble.appendChild(who);
  bubble.appendChild(textEl);
  row.appendChild(bubble);
  log.appendChild(row);
  if (!state.suppressScroll) scrollToBottom();
}

export function appendTyping(speaker, container) {
  const log = container || els.chatLog;
  const row = document.createElement('div');
  row.className = `msg ${speaker} typing`;
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  const img = document.createElement('img');
  img.src = CHARACTERS[speaker].avatar;
  img.alt = CHARACTERS[speaker].full;
  avatar.appendChild(img);
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    bubble.appendChild(dot);
  }
  row.appendChild(avatar);
  row.appendChild(bubble);
  log.appendChild(row);
  if (!state.suppressScroll) scrollToBottom();
  return row;
}

export function removeTyping(row) {
  if (row && row.parentNode) row.parentNode.removeChild(row);
}

export function scrollToBottom() {
  // 只有用户本来就靠近底部时才自动跟随，避免被拽走或来回晃动
  const doc = document.documentElement;
  const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 120;
  if (!nearBottom) return;
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
}
