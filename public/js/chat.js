import { els, state, demoEngine, sleepMs } from './core.js';
import { toast, appendMessage, appendSystem, appendNarration, appendTyping, removeTyping, splitSentences, mergePunctOnly } from './render.js';
import { syncControls, updateModeBadge } from './auto.js';
import { assemblePersona, assembleCanon, canonCustomized } from './panels.js';

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

async function renderReply(speaker, text) {
  if (!text || state.stopRequested) return false;
  const sentences = splitSentences(text);
  const parts = sentences.length ? sentences : [String(text).trim()].filter(Boolean);
  state.history.push({ speaker, text });

  const typingRow = appendTyping(speaker);
  const typingMs = Math.min(1500, 280 + Array.from(text).length * 9) + Math.random() * 220;
  await sleepMs(typingMs);
  removeTyping(typingRow);
  if (state.stopRequested) return false;

  if (parts.length === 1 && /^[\s，。！？!?…—、；：,.!?~～…·]+$/.test(parts[0]) && mergePunctOnly(speaker, parts[0])) {
    await maybeSummarizeManual();
    return true;
  }

  for (let i = 0; i < parts.length; i++) {
    appendMessage(speaker, parts[i]);
    if (i < parts.length - 1) {
      const endsStrong = /[！？。!?…—]$/.test(parts[i]);
      await sleepMs(endsStrong ? 380 + Math.random() * 260 : 300 + Math.random() * 240);
      if (state.stopRequested) return false;
    }
  }
  await maybeSummarizeManual();
  return true;
}

async function speak(speaker) {
  if (state.stopRequested) return null;
  state.busy = true;
  syncControls();
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
      state.mode = 'demo';
      updateModeBadge();
      toast('内置 AI 已关闭，本次对话使用演示台词');
      text = await demoReply(speaker);
    } else {
      toast(msg || '出错了，请重试');
      state.stopRequested = true;
      state.busy = false;
      syncControls();
      return null;
    }
  }
  const ok = await renderReply(speaker, text);
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
      baseUrl: state.settings.baseUrl,
      model: state.settings.model,
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
      baseUrl: state.settings.baseUrl,
      model: state.settings.model,
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
  state.stopRequested = false;
  const continuing = state.history.length > 0;
  if (!continuing) {
    state.manualTopic = els.topicInput.value.trim();
    state.manualSummary = '';
    state.history = [];
    demoEngine.reset();
    els.chatLog.innerHTML = '';
    if (state.manualTopic) {
      appendNarration(`（开场话题）${state.manualTopic}`);
    }
  } else if (els.topicInput.value.trim()) {
    state.manualTopic = els.topicInput.value.trim();
  }
  const total = Number(els.roundsSelect.value) * 2;
  state.pendingTurns = total;
  state.interjectQueue = [];
  state.running = true;
  syncControls();
  if (continuing) toast('继续上一段对话');

  const speaker = nextCharacterSpeaker();
  let replies = [];
  if (state.mode === 'ai') {
    try {
      replies = await askBatch(speaker, total);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('管理员关闭')) {
        state.mode = 'demo';
        updateModeBadge();
        toast('内置 AI 已关闭，本次对话使用演示台词');
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
  for (const item of replies) {
    if (state.stopRequested || !state.running) break;
    const ok = await renderReply(item.speaker, item.text);
    if (!ok) break;
    state.pendingTurns--;
  }
  await drainInterjections();
  state.running = false;
  state.busy = false;
  syncControls();
  if (state.stopRequested && state.history.length) {
    toast('已停止，可以继续插话或重新开始。');
  }
  state.stopRequested = false;
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
    appendNarration(text);
    state.history.push({ speaker: 'user', text });
    speak(nextCharacterSpeaker()).then(() => drainInterjections()).then(() => syncControls());
  }
}

async function drainInterjections() {
  while (state.interjectQueue.length && !state.stopRequested) {
    const text = state.interjectQueue.shift();
    appendNarration(text);
    state.history.push({ speaker: 'user', text });
    await speak(nextCharacterSpeaker());
  }
}
