import { els, state, sleepMs, SUMMARY_STRENGTHS, SUMMARY_STRENGTH_LABELS } from './core.js';
import { toast, appendSystem, appendMessageSplit, appendMessageSplitAnimated, appendTyping, removeTyping, scrollToBottom } from './render.js';

// ---------- 模式徽章与控件状态 ----------
export function updateModeBadge() {
  if (state.settings.apiKey) {
    state.mode = 'ai';
    els.modeBadge.textContent = 'AI 实时对话（自填 Key）';
    els.modeBadge.className = 'mode-badge ai';
  } else if (state.serverInfo.hasServerKey && state.serverInfo.aiEnabled) {
    state.mode = 'ai';
    els.modeBadge.textContent = 'AI 实时对话（内置 DeepSeek）';
    els.modeBadge.className = 'mode-badge ai';
  } else {
    state.mode = 'demo';
    els.modeBadge.textContent = state.serverInfo.hasServerKey
      ? '演示模式（内置 AI 已关闭）'
      : '内置台词演示模式';
    els.modeBadge.className = 'mode-badge demo';
  }
}

export function syncControls() {
  els.startBtn.disabled = state.running || state.busy;
  els.stopBtn.hidden = !(state.running || state.busy);
  els.interjectBtn.disabled = state.history.length === 0 || state.busy;
  els.clearBtn.disabled = false;
  els.topicPanelBtn.disabled = !state.serverInfo.autoChatEnabled;
  els.startBtn.textContent = state.running || state.busy
    ? '对谈中…'
    : state.history.length
      ? '继续对话'
      : '开始对话';
}

export function clearChat() {
  state.stopRequested = true;
  state.running = false;
  state.history = [];
  state.manualTopic = '';
  state.manualSummary = '';
  state.manualSessionId = null;
  state.pendingTurns = 0;
  state.interjectQueue = [];
  els.chatLog.innerHTML = '';
  els.chatLog.appendChild(els.welcome);
  if (els.topicInput) els.topicInput.value = '';
  syncControls();
  // 服务端只清手动对谈残留的场景备注，自动闲聊的一切状态（话题、历史、总结、心动回忆）都不受影响
  fetch('/api/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then((r) => r.json())
    .then(() => { fetchState(); toast('已清空手动对谈，自动闲聊不受影响'); })
    .catch(() => {});
}

// ---------- 服务器状态与自动闲聊 ----------
export async function fetchState() {
  try {
    const res = await fetch(`/api/state?voter=${encodeURIComponent(state.viewerId)}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `状态请求失败（${res.status}）`);
    state.serverInfo = {
      hasServerKey: data.hasServerKey,
      aiEnabled: data.aiEnabled,
      autoChatEnabled: data.autoChatEnabled,
      twoAgentMode: data.twoAgentMode !== false,
      currentTopic: data.currentTopic,
      summarizeAfter: Number(data.summarizeAfter) || 0,
      summaryKeepRecent: Number(data.summaryKeepRecent) || 6
    };
    updateAutoPanel(data);
    if (els.autoChatToggle) els.autoChatToggle.checked = !!data.autoChatEnabled;
    if (els.twoAgentToggle) els.twoAgentToggle.checked = data.twoAgentMode !== false;
    if (els.summaryStrengthSlider) {
      const ssv = String(data.summaryStrength || 'short').toLowerCase();
      const ssi = SUMMARY_STRENGTHS.indexOf(ssv) === -1 ? 0 : SUMMARY_STRENGTHS.indexOf(ssv);
      els.summaryStrengthSlider.value = String(ssi);
      els.summaryStrengthValue.textContent = SUMMARY_STRENGTH_LABELS[ssi] || SUMMARY_STRENGTH_LABELS[0];
    }
    if (data.autoChatEnabled) {
      if (!state.autoActive) {
        enterAutoMode(data);
      } else {
        renderNewAutoEntries(data.log);
      }
    } else if (state.autoActive) {
      exitAutoMode();
    }
    updateModeBadge();
    syncControls();
    setStatusDot(true);
  } catch (err) {
    setStatusDot(false);
  }
}

export function setStatusDot(ok) {
  if (ok === state.lastStatusOk) return;
  state.lastStatusOk = ok;
  els.statusDot.style.background = ok ? '#7fd6a0' : '#e06a5a';
}

export function switchView(view) {
  const auto = view === 'auto';
  els.manualView.hidden = auto;
  els.autoView.hidden = !auto;
  els.manualTab.classList.toggle('active', !auto);
  els.autoTab.classList.toggle('active', auto);
  scrollToBottom();
}

function beijingClockLabel() {
  const bj = new Date(Date.now() + 8 * 3600 * 1000);
  const hh = String(bj.getUTCHours()).padStart(2, '0');
  const mm = String(bj.getUTCMinutes()).padStart(2, '0');
  const h = bj.getUTCHours();
  const period = h >= 5 && h < 8 ? '清晨' : h >= 8 && h < 11 ? '上午' : h >= 11 && h < 14 ? '中午' : h >= 14 && h < 17 ? '下午' : h >= 17 && h < 20 ? '傍晚' : h >= 20 && h < 23 ? '晚上' : '深夜';
  return '北京时间 ' + hh + ':' + mm + ' · ' + period;
}

export function updateBeijingClock() {
  if (!els.beijingTimeChip) return;
  els.beijingTimeChip.textContent = beijingClockLabel();
  els.beijingTimeChip.hidden = false;
}

function updateAutoPanel(data) {
  els.autoPanel.classList.toggle('running', data.autoChatEnabled);
  els.autoStatusText.textContent = data.autoChatEnabled ? '自动闲聊：运行中' : '自动闲聊：未开启';
  if (els.giftBar) els.giftBar.hidden = !data.autoChatEnabled;
  if (data.autoChatEnabled && data.currentTopic) {
    els.topicChip.textContent = '当前话题：' + data.currentTopic;
    els.topicChip.hidden = false;
  } else {
    els.topicChip.hidden = true;
  }
  if (data.sceneText) {
    els.sceneTextChip.textContent = data.sceneText;
    els.sceneTextChip.hidden = false;
    if (els.manualSceneChip) els.manualSceneChip.textContent = data.sceneText;
    if (els.manualEnv) els.manualEnv.hidden = false;
  } else {
    els.sceneTextChip.hidden = true;
  }
  if (els.heartChip) {
    const h = (data.heartMoments || []).filter(Boolean);
    if (h.length) {
      els.heartChip.textContent = '还记得：' + h[0].slice(0, 26) + (h[0].length > 26 ? '…' : '');
      els.heartChip.hidden = false;
    } else {
      els.heartChip.hidden = true;
    }
  }
  if (els.weatherChip) {
    const wmap = { sunny: '☀ 晴', cloudy: '☁ 多云', rain: '☂ 小雨', wind: '🌬 大风', snow: '❄ 雪' };
    if (data.weather && wmap[data.weather]) {
      els.weatherChip.textContent = '今日天气：' + wmap[data.weather];
      els.weatherChip.hidden = false;
      if (els.manualWeatherChip) {
        els.manualWeatherChip.textContent = '今日天气：' + wmap[data.weather];
      }
    } else {
      els.weatherChip.hidden = true;
    }
  }
  if (data.autoChatEnabled && els.topicPanelBtn.textContent === '话题投票') {
    els.topicPanelBtn.textContent = '收起投票';
    els.votePanel.hidden = false;
  } else if (!data.autoChatEnabled) {
    els.topicPanelBtn.textContent = '话题投票';
    els.votePanel.hidden = true;
  }
  renderCandidates(data.candidates || []);
}

function enterAutoMode(data) {
  state.autoActive = true;
  els.autoChatLog.innerHTML = '';
  state.lastAutoMsgId = 0;
  renderAutoLog(data.log || []);
  switchView('auto');
  if (state.initialized) toast('自动闲聊已开启');
  syncControls();
}

function exitAutoMode() {
  state.autoActive = false;
  els.autoChatLog.innerHTML = '';
  els.autoChatLog.appendChild(els.autoWelcome);
  if (state.initialized) toast('自动闲聊已暂停');
  syncControls();
}

function renderAutoLog(log) {
  state.suppressScroll = true;
  for (const entry of log) {
    if (entry.type === 'system') {
      appendSystem(entry.text, els.autoChatLog);
    } else {
      appendMessageSplit(entry.type, entry.text, els.autoChatLog);
    }
    if (entry.id > state.lastAutoMsgId) state.lastAutoMsgId = entry.id;
  }
  state.suppressScroll = false;
  scrollToBottom();
}

async function renderNewAutoEntries(log) {
  if (!log.length) return;
  const newEntries = log.filter((e) => e.id > state.lastAutoMsgId);
  if (!newEntries.length) return;
  const maxId = log[log.length - 1].id;
  // 服务器重启导致编号回退时，整体重绘
  if (maxId < state.lastAutoMsgId) {
    els.autoChatLog.innerHTML = '';
    state.lastAutoMsgId = 0;
    renderAutoLog(log);
    return;
  }
  // 角色说话前先亮一下「输入中」，让自动闲聊更有活人感
  state.suppressScroll = true;
  for (const entry of newEntries) {
    if (entry.type === 'system') {
      appendSystem(entry.text, els.autoChatLog);
    } else {
      const tw = appendTyping(entry.type, els.autoChatLog);
      await sleepMs(320 + Math.random() * 260);
      removeTyping(tw);
      await sleepMs(70 + Math.random() * 110);
      await appendMessageSplitAnimated(entry.type, entry.text, els.autoChatLog);
    }
    state.lastAutoMsgId = entry.id;
    state.suppressScroll = false;
    scrollToBottom();
    state.suppressScroll = true;
  }
  state.suppressScroll = false;
  scrollToBottom();
}

function renderCandidates(candidates) {
  els.voteList.innerHTML = '';
  if (!candidates || !candidates.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-votes';
    empty.textContent = '还没有候选话题，来提议一个吧';
    els.voteList.appendChild(empty);
    return;
  }
  for (const c of candidates) {
    const item = document.createElement('div');
    item.className = 'vote-item' + (c.votedByMe ? ' voted' : '');
    const text = document.createElement('span');
    text.className = 'vote-text';
    text.textContent = c.text;
    const count = document.createElement('span');
    count.className = 'vote-count';
    count.textContent = c.votes + ' 票';
    const btn = document.createElement('button');
    btn.className = 'vote-btn';
    btn.type = 'button';
    btn.textContent = c.votedByMe ? '已投' : '投票';
    btn.addEventListener('click', () => voteTopic(c.id));
    item.appendChild(text);
    item.appendChild(count);
    item.appendChild(btn);
    els.voteList.appendChild(item);
  }
}

export async function proposeTopic() {
  const text = els.topicProposalInput.value.trim();
  if (!text) return;
  const res = await fetch('/api/topic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voterId: state.viewerId, text })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(data.error || '提议失败');
    return;
  }
  els.topicProposalInput.value = '';
  renderCandidates(data.candidates);
  toast('话题已进入候选池，等大家投票！');
}

async function voteTopic(topicId) {
  const res = await fetch('/api/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voterId: state.viewerId, topicId })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(data.error || '投票失败');
    return;
  }
  renderCandidates(data.candidates);
}

export async function sendGift(giftId, btn) {
  if (!giftId || btn.disabled) return;
  btn.disabled = true;
  try {
    const res = await fetch('/api/gift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: state.viewerId, giftId })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast('送出了礼物～');
      setTimeout(() => { btn.disabled = false; }, data.cooldownMs || 20000);
    } else {
      toast(data.error || '送礼失败');
      btn.disabled = false;
    }
  } catch (err) {
    toast('送礼失败，请重试');
    btn.disabled = false;
  }
}
