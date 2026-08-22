import { els, state, demoEngine } from './core.js';
import { toast, appendMessage, appendSystem, appendNarration, splitSentences } from './render.js';
import { syncControls, updateModeBadge } from './auto.js';
import { assemblePersona, assembleCanon, canonCustomized } from './panels.js';
import { enqueueGal, beginGal, endGal, setProducerGal, waitDrainGal, resetGal } from './gal.js';
import { openDrawer, closeDrawer } from './drawer.js';

function isAiNetworkError(err) {
  return /fetch failed|网络|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EACCES|socket hang up/i.test(String(err?.message || err || ''));
}

function syncStageMeta() {
  const topic = document.getElementById('manualTopicBadge');
  const progress = document.getElementById('dialogueProgress');
  if (topic) topic.textContent = state.manualTopic ? `话题：${state.manualTopic}` : '等待你的开场';
  if (progress) {
    const lines = state.history.filter((entry) => entry.speaker === 'reimu' || entry.speaker === 'marisa').length;
    progress.textContent = lines ? `SCENE ${String(lines).padStart(2, '0')}` : '—';
  }
}

// ---------- 手动对谈 ----------
export function nextCharacterSpeaker() {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const s = state.history[i].speaker;
    if (s === 'reimu' || s === 'marisa') {
      return s === 'marisa' ? 'reimu' : 'marisa';
    }
  }
  return 'marisa';
}

// 将新增台词写入当前手动会话（服务端持久化）
async function persistManual(entries) {
  const id = state.manualSessionId;
  if (!id || !entries || !entries.length) return;
  try {
    await fetch('/api/manuals/' + id + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: entries })
    });
  } catch (_) {}
}

export function openManualHistory() {
  openDrawer('history');
  renderManualHistory();
}

export async function renderManualHistory() {
  const list = els.manualHistoryList;
  list.innerHTML = '<p class="vote-hint">加载中…</p>';
  try {
    const res = await fetch('/api/manuals', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '加载失败');
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    state.manualSessions = sessions;
    if (!sessions.length) {
      list.innerHTML = '<p class="vote-hint">还没有历史对话。开始一场手动对谈后会自动保存。</p>';
      return;
    }
    list.innerHTML = '';
    for (const s of sessions) {
      const row = document.createElement('div');
      row.className = 'manual-history-item';
      const when = new Date(s.updatedAt);
      const p = (n) => String(n).padStart(2, '0');
      const time = when.getFullYear() + '-' + p(when.getMonth() + 1) + '-' + p(when.getDate()) + ' ' + p(when.getHours()) + ':' + p(when.getMinutes());
      const info = document.createElement('div');
      info.className = 'manual-history-info';
      const title = document.createElement('div');
      title.className = 'manual-history-title';
      title.textContent = s.title || '未命名对话';
      const meta = document.createElement('div');
      meta.className = 'manual-history-meta';
      meta.textContent = (s.topic ? '话题：' + s.topic + ' · ' : '') + s.msgCount + ' 条 · ' + time;
      info.appendChild(title);
      info.appendChild(meta);
      const actions = document.createElement('div');
      actions.className = 'manual-history-actions';
      const openBtn = document.createElement('button');
      openBtn.className = 'btn small';
      openBtn.textContent = '打开';
      openBtn.addEventListener('click', () => loadManualSession(s.id));
      const delBtn = document.createElement('button');
      delBtn.className = 'btn small ghost';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', async () => {
        if (!confirm('确定删除这段对话历史？')) return;
        try { await fetch('/api/manuals/' + s.id, { method: 'DELETE' }); } catch (_) {}
        renderManualHistory();
      });
      actions.appendChild(openBtn);
      actions.appendChild(delBtn);
      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    }
  } catch (err) {
    list.innerHTML = '<p class="vote-hint">加载历史失败。</p>';
  }
}

export async function loadManualSession(id) {
  try {
    const res = await fetch('/api/manuals/' + id, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '加载失败');
    const session = data.session;
    if (!session) throw new Error('对话不存在');
    state.stopRequested = true;
    state.running = false;
    state.busy = false;
    state.manualTopic = session.topic || '';
    state.manualSummary = '';
    state.manualSessionId = session.id;
    state.history = (session.messages || [])
      .filter((m) => m && m.speaker && typeof m.text === 'string')
      .map((m) => ({ speaker: m.speaker, text: m.text }));
    els.topicInput.value = state.manualTopic || '';
    els.chatLog.innerHTML = '';
    resetGal('manual');
    if (state.manualTopic) appendNarration('（开场话题）' + state.manualTopic);
    for (const m of state.history) {
      if (m.speaker === 'user') appendNarration(m.text);
      else if (m.speaker === 'system') appendSystem(m.text);
      else appendMessage(m.speaker, m.text);
    }
    closeDrawer();
    syncControls();
    toast('已载入历史对话，可直接继续。');
  } catch (err) {
    toast(err.message || '载入失败');
  }
}
async function renderReply(speaker, text, emotion) {
  if (!text || state.stopRequested) return false;
  const sentences = splitSentences(text);
  const parts = sentences.length ? sentences : [String(text).trim()].filter(Boolean);
  state.history.push({ speaker, text });
  syncStageMeta();
  persistManual([{ speaker, text }]);

  // Galgame 式：台词逐句进队列，由用户点击推进；全部点完才继续生成下一轮
  // AI 在批量协议里给整条 reply 标注的立绘情绪（switch_portrait），继承到每个短句
  for (const part of parts) {
    enqueueGal('manual', speaker, part, emotion);
  }
  await waitDrainGal('manual');
  if (state.stopRequested) return false;

  await maybeSummarizeManual();
  return true;
}

async function speak(speaker) {
  if (state.stopRequested) return null;
  state.busy = true;
  syncControls();
  setProducerGal('manual', true);
  let text = '';
  try {
    if (state.mode === 'ai') {
      text = await askAI(speaker);
    } else {
      text = await demoReply(speaker);
    }
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('管理员关闭')) {
      state.aiUnavailable = false;
      state.mode = 'demo';
      updateModeBadge();
      toast('内置 AI 已关闭，本次对话使用演示台词');
      text = await demoReply(speaker);
    } else if (isAiNetworkError(err)) {
      state.aiUnavailable = true;
      state.mode = 'demo';
      updateModeBadge();
      toast('AI 服务暂时无法连接，已切换到演示台词；请检查接口地址或网络后再试');
      text = await demoReply(speaker);
    } else {
      toast(msg || '出错了，请重试');
      state.stopRequested = true;
      setProducerGal('manual', false);
      state.busy = false;
      syncControls();
      return null;
    }
  }
  const ok = await renderReply(speaker, text);
  setProducerGal('manual', false);
  state.busy = false;
  syncControls();
  return ok ? text : null;
}

async function askBatch(speaker, count) {
  const res = await fetch('/api/chat/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      character: speaker,
      topic: state.manualTopic || '随便聊聊',
      history: state.history,
      turns: count,
      apiKey: state.settings.apiKey || undefined,
      // 未自填 Key 时走服务器内置配置；本地保存的自定义地址/模型不随请求发送
      baseUrl: state.settings.apiKey ? state.settings.baseUrl : undefined,
      model: state.settings.apiKey ? state.settings.model : undefined,
      temperature: state.settings.temperature,
      thinkingMode: state.settings.thinkingMode,
      personas: { reimu: assemblePersona('reimu'), marisa: assemblePersona('marisa') },
      summary: state.manualSummary || undefined,
      canon: assembleCanon(),
      canonMode: canonCustomized() ? 'custom' : 'default',
      checkEnabled: state.settings.checkMode === 'on' && !!state.settings.checkApiKey,
      checkApiKey: state.settings.checkMode === 'on' ? state.settings.checkApiKey : undefined,
      checkBaseUrl: state.settings.checkMode === 'on' ? state.settings.checkBaseUrl : undefined,
      checkModel: state.settings.checkMode === 'on' ? state.settings.checkModel : undefined
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败：${res.status}`);
  }
  return Array.isArray(data.replies) ? data.replies : [];
}

async function askAI(speaker) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      character: speaker,
      topic: state.manualTopic || '随便聊聊',
      history: state.history,
      apiKey: state.settings.apiKey || undefined,
      // 未自填 Key 时走服务器内置配置；本地保存的自定义地址/模型不随请求发送
      baseUrl: state.settings.apiKey ? state.settings.baseUrl : undefined,
      model: state.settings.apiKey ? state.settings.model : undefined,
      temperature: state.settings.temperature,
      thinkingMode: state.settings.thinkingMode,
      persona: assemblePersona(speaker),
      summary: state.manualSummary || undefined,
      canon: assembleCanon(),
      canonMode: canonCustomized() ? 'custom' : 'default',
      checkEnabled: state.settings.checkMode === 'on' && !!state.settings.checkApiKey,
      checkApiKey: state.settings.checkMode === 'on' ? state.settings.checkApiKey : undefined,
      checkBaseUrl: state.settings.checkMode === 'on' ? state.settings.checkBaseUrl : undefined,
      checkModel: state.settings.checkMode === 'on' ? state.settings.checkModel : undefined
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败（${res.status}）`);
  }
  return data.reply;
}

async function maybeSummarizeManual() {
  const after = Number(state.serverInfo.summarizeAfter) || 0;
  const keep = Math.max(1, Number(state.serverInfo.summaryKeepRecent) || 6);
  if (!after || state.history.length <= after) return;
  const split = state.history.length - keep;
  const old = state.history.slice(0, split);
  const recent = state.history.slice(split);
  let summary = '';
  if (state.mode === 'ai') {
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: state.manualTopic,
          messages: old,
          summaryApiKey: state.settings.summaryMode === 'custom' ? state.settings.summaryApiKey : undefined,
          summaryBaseUrl: state.settings.summaryMode === 'custom' ? state.settings.summaryBaseUrl : undefined,
          summaryModel: state.settings.summaryMode === 'custom' ? state.settings.summaryModel : undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `总结失败（${res.status}）`);
      summary = data.summary;
    } catch (err) {
      toast(`自动总结失败：${err.message || '未知错误'}`);
      return;
    }
  } else {
    summary = `前面聊了${old.length}条关于「${state.manualTopic || '幻想乡'}」的内容`;
  }
  state.manualSummary = summary;
  state.history = recent;
  appendSystem(`（自动总结：${summary}）`);
}

function demoReply(speaker) {
  return new Promise((resolve) => {
    const delay = 700 + Math.random() * 900;
    setTimeout(() => {
      const lastItem = state.history[state.history.length - 1];
      resolve(demoEngine.reply(speaker, state.manualTopic, lastItem ? lastItem.speaker : null));
    }, delay);
  });
}

export async function startConversation() {
  if (state.running || state.busy) return;
  state.aiUnavailable = false;
  updateModeBadge();
  state.stopRequested = false;
  const continuing = state.history.length > 0;
  if (!continuing) {
    state.manualTopic = els.topicInput.value.trim();
    syncStageMeta();
    state.manualSummary = '';
    state.history = [];
    demoEngine.reset();
    els.chatLog.innerHTML = '';
    try {
      const res = await fetch('/api/manuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: state.manualTopic })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.session) state.manualSessionId = d.session.id;
    } catch (_) {}
    if (state.manualTopic) {
      enqueueGal('manual', 'user', `（开场话题）${state.manualTopic}`);
    }
  } else if (els.topicInput.value.trim()) {
    state.manualTopic = els.topicInput.value.trim();
    syncStageMeta();
  }
  const total = Number(els.roundsSelect.value) * 2;
  state.pendingTurns = total;
  state.interjectQueue = [];
  state.running = true;
  syncControls();
  if (continuing) toast('继续上一段对话');
  // 批量台词会一次性预取回来，之后全部交给点击推进
  beginGal('manual');

  const speaker = nextCharacterSpeaker();
  let replies = [];
  if (state.mode === 'ai') {
    try {
      replies = await askBatch(speaker, total);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('管理员关闭')) {
        state.aiUnavailable = false;
        state.mode = 'demo';
        updateModeBadge();
        toast('内置 AI 已关闭，本次对话使用演示台词');
      } else if (isAiNetworkError(err)) {
        state.aiUnavailable = true;
        state.mode = 'demo';
        updateModeBadge();
        toast('AI 服务暂时无法连接，已切换到演示台词；请检查接口地址或网络后再试');
      } else {
        toast(msg || '出错了，请重试');
        state.stopRequested = true;
      }
    }
  }
  if (!replies.length && state.mode === 'demo') {
    let sp = speaker;
    for (let i = 0; i < total && !state.stopRequested; i++) {
      const text = await demoReply(sp);
      if (text) replies.push({ speaker: sp, text });
      sp = sp === 'marisa' ? 'reimu' : 'marisa';
    }
  }
  try {
    for (const item of replies) {
      if (state.stopRequested || !state.running) break;
      const ok = await renderReply(item.speaker, item.text, item.emotion);
      if (!ok) break;
      state.pendingTurns--;
    }
    await drainInterjections();
  } finally {
    endGal('manual');
    state.running = false;
    state.busy = false;
    syncControls();
    if (state.stopRequested && state.history.length) {
      toast('已停止，可以继续插话或重新开始。');
    }
    state.stopRequested = false;
  }
}

export function queueInterjection() {
  const text = els.interjectInput.value.trim();
  if (!text) return;
  els.interjectInput.value = '';
  els.interjectRow.hidden = true;
  els.interjectBtn.hidden = false;
  if (state.busy || state.running) {
    state.interjectQueue.push(text);
    toast(state.busy ? '收到，等角色说完就接上。' : '收到，马上轮到。');
  } else {
    // 旁白先进队列展示，同时立刻开始生成回应（预取，用户点完旁白时多半已生成好）
    enqueueGal('manual', 'user', text);
    state.history.push({ speaker: 'user', text });
    persistManual([{ speaker: 'user', text }]);
    speak(nextCharacterSpeaker()).then(() => drainInterjections()).then(() => syncControls());
  }
}

async function drainInterjections() {
  while (state.interjectQueue.length && !state.stopRequested) {
    const text = state.interjectQueue.shift();
    enqueueGal('manual', 'user', text);
    state.history.push({ speaker: 'user', text });
    persistManual([{ speaker: 'user', text }]);
    await speak(nextCharacterSpeaker());
  }
}
