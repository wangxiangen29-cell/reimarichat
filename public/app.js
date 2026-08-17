(function () {
  'use strict';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    chatLog: $('chatLog'),
    welcome: $('welcome'),
    topicInput: $('topicInput'),
    startBtn: $('startBtn'),
    stopBtn: $('stopBtn'),
    clearBtn: $('clearBtn'),
    roundsSelect: $('roundsSelect'),
    interjectBtn: $('interjectBtn'),
    interjectRow: $('interjectRow'),
    interjectInput: $('interjectInput'),
    sendInterjectBtn: $('sendInterjectBtn'),
    cancelInterjectBtn: $('cancelInterjectBtn'),
    settingsBtn: $('settingsBtn'),
    settingsPanel: $('settingsPanel'),
    apiKeyInput: $('apiKeyInput'),
    baseUrlInput: $('baseUrlInput'),
    modelInput: $('modelInput'),
    modelRow: $('modelRow'),
    fetchModelsBtn: $('fetchModelsBtn'),
    tempInput: $('tempInput'),
    tempValue: $('tempValue'),
    summaryModeSelect: $('summaryModeSelect'),
    summaryApiKeyInput: $('summaryApiKeyInput'),
    summaryBaseUrlInput: $('summaryBaseUrlInput'),
    summaryModelInput: $('summaryModelInput'),
    summaryCustomRow: $('summaryCustomRow'),
    checkModeSelect: $('checkModeSelect'),
    checkApiKeyInput: $('checkApiKeyInput'),
    checkBaseUrlInput: $('checkBaseUrlInput'),
    checkModelInput: $('checkModelInput'),
    checkCustomRow: $('checkCustomRow'),
    personaBtn: $('personaBtn'),
    personaPanel: $('personaPanel'),
    personaCloseBtn: $('personaCloseBtn'),
    personaBaseReimuInput: $('personaBaseReimuInput'),
    personaExtraReimuInput: $('personaExtraReimuInput'),
    personaPromptReimuInput: $('personaPromptReimuInput'),
    personaBaseMarisaInput: $('personaBaseMarisaInput'),
    personaExtraMarisaInput: $('personaExtraMarisaInput'),
    personaPromptMarisaInput: $('personaPromptMarisaInput'),
    personaSaveBtn: $('personaSaveBtn'),
    personaResetBtn: $('personaResetBtn'),
    canonBtn: $('canonBtn'),
    canonPanel: $('canonPanel'),
    canonCloseBtn: $('canonCloseBtn'),
    canonReimuInput: $('canonReimuInput'),
    canonMarisaInput: $('canonMarisaInput'),
    canonWorldInput: $('canonWorldInput'),
    canonPairInput: $('canonPairInput'),
    canonNotesInput: $('canonNotesInput'),
    canonSaveBtn: $('canonSaveBtn'),
    canonResetBtn: $('canonResetBtn'),
    modeBadge: $('modeBadge'),
    statusDot: $('statusDot'),
    aboutBtn: $('aboutBtn'),
    aboutModal: $('aboutModal'),
    aboutCloseBtn: $('aboutCloseBtn'),
    toastEl: $('toast'),
    autoPanel: $('autoPanel'),
    autoStatusText: $('autoStatusText'),
    topicChip: $('topicChip'),
    beijingTimeChip: $('beijingTimeChip'),
    sceneTextChip: $('sceneTextChip'),
    heartChip: $('heartChip'),
    weatherChip: $('weatherChip'),
    giftBar: $('giftBar'),
    manualEnv: $('manualEnv'),
    manualSceneChip: $('manualSceneChip'),
    manualWeatherChip: $('manualWeatherChip'),
    topicPanelBtn: $('topicPanelBtn'),
    votePanel: $('votePanel'),
    voteList: $('voteList'),
    summaryPanelBtn: $('summaryPanelBtn'),
    summaryPanel: $('summaryPanel'),
    summaryCurrent: $('summaryCurrent'),
    summaryList: $('summaryList'),
    topicProposalInput: $('topicProposalInput'),
    proposeBtn: $('proposeBtn'),
    manualTab: $('manualTab'),
    autoTab: $('autoTab'),
    manualView: $('manualView'),
    autoView: $('autoView'),
    autoChatLog: $('autoChatLog'),
    autoWelcome: $('autoWelcome')
  };

  const CHARACTERS = {
    reimu: { name: '灵梦', full: '博丽灵梦', avatar: 'avatars/reimu_head.png' },
    marisa: { name: '魔理沙', full: '雾雨魔理沙', avatar: 'avatars/marisa_head.png' }
  };
  const STORE_KEY = 'gensokyo-chat-settings-v1';
  const VIEWER_KEY = 'gensokyo-viewer-id';
  const demoEngine = window.GensokyoDemo.createEngine();

  // ---------- 状态 ----------
  let settings = loadSettings();
  let serverInfo = {
    hasServerKey: false,
    aiEnabled: true,
    autoChatEnabled: false,
    currentTopic: null,
    summarizeAfter: 20,
    summaryKeepRecent: 6
  };
  let viewerId = getViewerId();
  let mode = 'demo';
  let history = [];
  let pendingTurns = 0;
  let running = false;
  let busy = false;
  let stopRequested = false;
  let interjectQueue = [];
  let manualTopic = '';
  let manualSummary = '';
  let summaryData = { current: null, history: [] };
  let editingSummaryId = null;
  let autoActive = false;
  let pollTimer = null;
  let clockTimer = null;
  let lastAutoMsgId = 0;
  let initialized = false;
  let lastStatusOk = false;
  let settingsWasVisible = false;
  let suppressScroll = false;

  // ---------- 本地存储 ----------
  function loadSettings() {
    try {
      return Object.assign(
        {
          apiKey: '',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-v4-flash',
          temperature: 0.85,
          personaBaseReimu: '',
          personaExtraReimu: '',
          personaBaseMarisa: '',
          personaExtraMarisa: '',
          summaryMode: 'builtin',
          summaryApiKey: '',
          summaryBaseUrl: '',
          summaryModel: '',
          checkMode: 'off',
          checkApiKey: '',
          checkBaseUrl: '',
          checkModel: '',
          canonReimu: '',
          canonMarisa: '',
          canonWorld: '',
          canonPair: '',
          canonNotes: ''
        },
        JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
      );
    } catch (_) {
      return {
        apiKey: '',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        temperature: 0.85,
        personaBaseReimu: '',
        personaExtraReimu: '',
        personaBaseMarisa: '',
        personaExtraMarisa: '',
        summaryMode: 'builtin',
        summaryApiKey: '',
        summaryBaseUrl: '',
        summaryModel: '',
        checkMode: 'off',
        checkApiKey: '',
        checkBaseUrl: '',
        checkModel: '',
        canonReimu: '',
        canonMarisa: '',
        canonWorld: '',
        canonPair: '',
        canonNotes: ''
      };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function getViewerId() {
    let id = localStorage.getItem(VIEWER_KEY);
    if (!id) {
      id = 'v-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VIEWER_KEY, id);
    }
    return id;
  }

  function renderSettings() {
    els.apiKeyInput.value = settings.apiKey;
    els.baseUrlInput.value = settings.baseUrl;
    els.modelInput.value = settings.model;
    els.tempInput.value = String(settings.temperature);
    els.tempValue.textContent = settings.temperature.toFixed(2);
    els.summaryModeSelect.value = settings.summaryMode || 'builtin';
    els.summaryApiKeyInput.value = settings.summaryApiKey;
    els.summaryBaseUrlInput.value = settings.summaryBaseUrl;
    els.summaryModelInput.value = settings.summaryModel;
    els.summaryCustomRow.hidden = settings.summaryMode !== 'custom';
    els.checkModeSelect.value = settings.checkMode || 'off';
    els.checkApiKeyInput.value = settings.checkApiKey;
    els.checkBaseUrlInput.value = settings.checkBaseUrl;
    els.checkModelInput.value = settings.checkModel;
    els.checkCustomRow.hidden = settings.checkMode !== 'on';
  }

  // ---------- 提示 ----------
  let toastTimer = null;
  function toast(msg) {
    els.toastEl.textContent = msg;
    els.toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toastEl.hidden = true;
    }, 5200);
  }

  // ---------- 渲染 ----------
  function openAbout() {
    els.aboutModal.hidden = false;
  }

  function closeAbout() {
    els.aboutModal.hidden = true;
  }

  function splitSentences(text) {
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

  function mergePunctOnly(speaker, part, container) {
    if (!part) return false;
    const log = container || els.chatLog;
    const rows = log.querySelectorAll('.msg.' + speaker);
    const lastRow = rows[rows.length - 1];
    if (!lastRow) return false;
    const textEl = lastRow.querySelector('.bubble > div:last-child');
    if (!textEl || !textEl.textContent) return false;
    textEl.textContent += part;
    if (!suppressScroll) scrollToBottom();
    return true;
  }

  function appendMessageSplit(speaker, text, container) {
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

  function appendMessage(speaker, text, container) {
    const log = container || els.chatLog;
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
    textEl.textContent = text;
    bubble.appendChild(who);
    bubble.appendChild(textEl);

    row.appendChild(avatar);
    row.appendChild(bubble);
    log.appendChild(row);
    if (!suppressScroll) scrollToBottom();
    return row;
  }

  function appendSystem(text, container) {
    const log = container || els.chatLog;
    const row = document.createElement('div');
    row.className = 'msg system';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    log.appendChild(row);
    if (!suppressScroll) scrollToBottom();
  }

  function appendNarration(text, container) {
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
    if (!suppressScroll) scrollToBottom();
  }

  function appendTyping(speaker, container) {
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
    if (!suppressScroll) scrollToBottom();
    return row;
  }

  function removeTyping(row) {
    if (row && row.parentNode) row.parentNode.removeChild(row);
  }

  function scrollToBottom() {
    // 只有用户本来就靠近底部时才自动跟随，避免被拽走或来回晃动
    const doc = document.documentElement;
    const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 120;
    if (!nearBottom) return;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
  }

  function clearChat() {
    stopRequested = true;
    running = false;
    history = [];
    manualTopic = '';
    manualSummary = '';
    pendingTurns = 0;
    interjectQueue = [];
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

  function syncControls() {
    els.startBtn.disabled = running || busy;
    els.stopBtn.hidden = !(running || busy);
    els.interjectBtn.disabled = history.length === 0 || busy;
    els.clearBtn.disabled = false;
    els.topicPanelBtn.disabled = !serverInfo.autoChatEnabled;
    els.startBtn.textContent = running || busy
      ? '对谈中…'
      : history.length
        ? '继续对话'
        : '开始对话';
  }

  // ---------- 模式徽章 ----------
  function updateModeBadge() {
    if (settings.apiKey) {
      mode = 'ai';
      els.modeBadge.textContent = 'AI 实时对话（自填 Key）';
      els.modeBadge.className = 'mode-badge ai';
    } else if (serverInfo.hasServerKey && serverInfo.aiEnabled) {
      mode = 'ai';
      els.modeBadge.textContent = 'AI 实时对话（内置 DeepSeek）';
      els.modeBadge.className = 'mode-badge ai';
    } else {
      mode = 'demo';
      els.modeBadge.textContent = serverInfo.hasServerKey
        ? '演示模式（内置 AI 已关闭）'
        : '内置台词演示模式';
      els.modeBadge.className = 'mode-badge demo';
    }
  }

  // ---------- 服务器状态与自动闲聊 ----------
  async function fetchState() {
    try {
      const res = await fetch(`/api/state?voter=${encodeURIComponent(viewerId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `状态请求失败（${res.status}）`);
      serverInfo = {
        hasServerKey: data.hasServerKey,
        aiEnabled: data.aiEnabled,
        autoChatEnabled: data.autoChatEnabled,
        currentTopic: data.currentTopic,
        summarizeAfter: Number(data.summarizeAfter) || 0,
        summaryKeepRecent: Number(data.summaryKeepRecent) || 6
      };
      updateAutoPanel(data);
      if (data.autoChatEnabled) {
        if (!autoActive) {
          enterAutoMode(data);
        } else {
          renderNewAutoEntries(data.log);
        }
      } else if (autoActive) {
        exitAutoMode();
      }
      updateModeBadge();
      syncControls();
      setStatusDot(true);
    } catch (err) {
      setStatusDot(false);
    }
  }

  function setStatusDot(ok) {
    if (ok === lastStatusOk) return;
    lastStatusOk = ok;
    els.statusDot.style.background = ok ? '#7fd6a0' : '#e06a5a';
  }

  function switchView(view) {
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

  function updateBeijingClock() {
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
    autoActive = true;
    els.autoChatLog.innerHTML = '';
    lastAutoMsgId = 0;
    renderAutoLog(data.log || []);
    switchView('auto');
    if (initialized) toast('自动闲聊已开启');
    syncControls();
  }

  function exitAutoMode() {
    autoActive = false;
    els.autoChatLog.innerHTML = '';
    els.autoChatLog.appendChild(els.autoWelcome);
    if (initialized) toast('自动闲聊已暂停');
    syncControls();
  }

  function renderAutoLog(log) {
    suppressScroll = true;
    for (const entry of log) {
      if (entry.type === 'system') {
        appendSystem(entry.text, els.autoChatLog);
      } else {
        appendMessageSplit(entry.type, entry.text, els.autoChatLog);
      }
      if (entry.id > lastAutoMsgId) lastAutoMsgId = entry.id;
    }
    suppressScroll = false;
    scrollToBottom();
  }

  async function renderNewAutoEntries(log) {
    if (!log.length) return;
    const newEntries = log.filter((e) => e.id > lastAutoMsgId);
    if (!newEntries.length) return;
    const maxId = log[log.length - 1].id;
    // 服务器重启导致编号回退时，整体重绘
    if (maxId < lastAutoMsgId) {
      els.autoChatLog.innerHTML = '';
      lastAutoMsgId = 0;
      renderAutoLog(log);
      return;
    }
    // 角色说话前先亮一下「输入中」，让自动闲聊更有活人感
    suppressScroll = true;
    for (const entry of newEntries) {
      if (entry.type === 'system') {
        appendSystem(entry.text, els.autoChatLog);
      } else {
        const tw = appendTyping(entry.type, els.autoChatLog);
        await sleepMs(650 + Math.random() * 550);
        removeTyping(tw);
        await sleepMs(120 + Math.random() * 180);
        appendMessageSplit(entry.type, entry.text, els.autoChatLog);
      }
      lastAutoMsgId = entry.id;
      suppressScroll = false;
      scrollToBottom();
      suppressScroll = true;
    }
    suppressScroll = false;
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

  async function proposeTopic() {
    const text = els.topicProposalInput.value.trim();
    if (!text) return;
    const res = await fetch('/api/topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: viewerId, text })
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
      body: JSON.stringify({ voterId: viewerId, topicId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error || '投票失败');
      return;
    }
    renderCandidates(data.candidates);
  }

  // ---------- 总结历史 ----------
  async function fetchSummaries() {
    try {
      const res = await fetch('/api/summaries', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '读取总结失败');
      summaryData = { current: data.current || null, history: data.history || [] };
      renderSummaries();
    } catch (err) {
      toast(err.message || '读取总结失败');
    }
  }

  function renderSummaries() {
    renderCurrentSummary();
    renderSummaryList();
  }

  function renderCurrentSummary() {
    const box = els.summaryCurrent;
    box.innerHTML = '';
    const h = document.createElement('h4');
    h.textContent = '当前总结';
    box.appendChild(h);

    if (!summaryData.current) {
      const p = document.createElement('div');
      p.className = 'empty-votes';
      p.textContent = '暂无当前总结（自动闲聊积累到一定条数后会自动生成）。';
      box.appendChild(p);
      return;
    }

    const topic = document.createElement('div');
    topic.className = 'vote-hint';
    topic.textContent = '话题：' + (summaryData.current.topic || '自动闲聊');
    box.appendChild(topic);

    const ta = document.createElement('textarea');
    ta.value = summaryData.current.content || '';
    box.appendChild(ta);

    const save = document.createElement('button');
    save.className = 'btn small';
    save.type = 'button';
    save.textContent = '保存当前总结';
    save.addEventListener('click', async () => {
      await updateSummary(summaryData.current.id, ta.value);
    });
    box.appendChild(save);
  }

  function renderSummaryList() {
    const list = els.summaryList;
    list.innerHTML = '';
    const items = summaryData.history || [];
    if (!items.length) {
      const p = document.createElement('div');
      p.className = 'empty-votes';
      p.textContent = '还没有历史总结。';
      list.appendChild(p);
      return;
    }

    for (const s of items) {
      const item = document.createElement('div');
      item.className = 'vote-item summary-item';

      const head = document.createElement('div');
      head.className = 'summary-item-head';

      const label = document.createElement('span');
      label.className = 'vote-text';
      const isCurrent = summaryData.current && summaryData.current.id === s.id;
      const time = new Date(s.createdAt).toLocaleString('zh-CN', { hour12: false });
      label.textContent = (isCurrent ? '【当前】' : '') + (s.topic || '自动闲聊') + ' · ' + time;
      head.appendChild(label);

      const editBtn = document.createElement('button');
      editBtn.className = 'vote-btn';
      editBtn.type = 'button';
      editBtn.textContent = '编辑';
      editBtn.addEventListener('click', () => {
        editingSummaryId = s.id;
        renderSummaryList();
      });
      head.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'vote-btn danger';
      delBtn.type = 'button';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', async () => {
        if (!confirm('确定删除这条总结？')) return;
        await deleteSummary(s.id);
      });
      head.appendChild(delBtn);
      item.appendChild(head);

      if (editingSummaryId === s.id) {
        const ta = document.createElement('textarea');
        ta.value = s.content || '';
        item.appendChild(ta);

        const save = document.createElement('button');
        save.className = 'btn small';
        save.type = 'button';
        save.textContent = '保存';
        save.addEventListener('click', async () => {
          await updateSummary(s.id, ta.value);
          editingSummaryId = null;
        });
        item.appendChild(save);

        const cancel = document.createElement('button');
        cancel.className = 'btn small ghost';
        cancel.type = 'button';
        cancel.textContent = '取消';
        cancel.addEventListener('click', () => {
          editingSummaryId = null;
          renderSummaryList();
        });
        item.appendChild(cancel);
      } else {
        const content = document.createElement('div');
        content.className = 'summary-content';
        content.textContent = s.content || '';
        item.appendChild(content);
      }

      list.appendChild(item);
    }
  }

  async function updateSummary(id, content) {
    const res = await fetch('/api/summaries/' + encodeURIComponent(id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error || '保存失败');
      return;
    }
    summaryData = { current: data.current || null, history: data.history || [] };
    renderSummaries();
    toast('总结已保存');
  }

  async function deleteSummary(id) {
    const res = await fetch('/api/summaries/' + encodeURIComponent(id), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error || '删除失败');
      return;
    }
    summaryData = { current: data.current || null, history: data.history || [] };
    if (editingSummaryId === id) editingSummaryId = null;
    renderSummaries();
    toast('总结已删除');
  }

  // ---------- 人设管理（手动对谈，人人可改，仅存本机） ----------
  function closePersonaPanel() {
    els.personaPanel.hidden = true;
    els.settingsPanel.hidden = !settingsWasVisible;
  }

  async function openPersonaPanel() {
    try {
      const manualRes = await fetch('/api/personas/manual', { cache: 'no-store' });
      const manual = await manualRes.json().catch(() => ({}));
      if (!manualRes.ok) {
        toast(manual.error || '读取默认人设失败');
        return;
      }
      window.__manualDefaults = { base: manual.base, rules: manual.rules, full: manual.full };
      els.personaBaseReimuInput.value = settings.personaBaseReimu || manual.base.reimu;
      els.personaExtraReimuInput.value = settings.personaExtraReimu || '';
      els.personaBaseMarisaInput.value = settings.personaBaseMarisa || manual.base.marisa;
      els.personaExtraMarisaInput.value = settings.personaExtraMarisa || '';
      refreshPromptPreviews();
      settingsWasVisible = !els.settingsPanel.hidden;
      els.canonPanel.hidden = true;
      els.settingsPanel.hidden = true;
      els.personaPanel.hidden = false;
    } catch (_) {
      toast('无法连接服务器');
    }
  }

  function assemblePersona(character) {
    const d = window.__manualDefaults;
    if (!d) return undefined;
    const isMarisa = character === 'marisa';
    const cap = isMarisa ? 'Marisa' : 'Reimu';
    const key = isMarisa ? 'marisa' : 'reimu';
    const base = settings['personaBase' + cap] || d.base[key];
    const extra = settings['personaExtra' + cap] || '';
    return base + (extra ? '\n' + extra : '') + '\n' + d.rules[key];
  }

  function refreshPromptPreviews() {
    const d = window.__manualDefaults;
    if (!d) return;
    const reimuBase = els.personaBaseReimuInput.value.trim() || d.base.reimu;
    const reimuExtra = els.personaExtraReimuInput.value.trim();
    els.personaPromptReimuInput.value =
      reimuBase + (reimuExtra ? '\n' + reimuExtra : '') + '\n' + d.rules.reimu;
    const marisaBase = els.personaBaseMarisaInput.value.trim() || d.base.marisa;
    const marisaExtra = els.personaExtraMarisaInput.value.trim();
    els.personaPromptMarisaInput.value =
      marisaBase + (marisaExtra ? '\n' + marisaExtra : '') + '\n' + d.rules.marisa;
  }

  function savePersonas() {
    settings.personaBaseReimu = els.personaBaseReimuInput.value.trim();
    settings.personaExtraReimu = els.personaExtraReimuInput.value.trim();
    settings.personaBaseMarisa = els.personaBaseMarisaInput.value.trim();
    settings.personaExtraMarisa = els.personaExtraMarisaInput.value.trim();
    saveSettings();
    refreshPromptPreviews();
    toast('已保存到本机，手动对谈立即生效');
  }

  function resetPersonas() {
    if (!window.__manualDefaults) return;
    settings.personaBaseReimu = '';
    settings.personaExtraReimu = '';
    settings.personaBaseMarisa = '';
    settings.personaExtraMarisa = '';
    saveSettings();
    els.personaBaseReimuInput.value = window.__manualDefaults.base.reimu;
    els.personaExtraReimuInput.value = '';
    els.personaBaseMarisaInput.value = window.__manualDefaults.base.marisa;
    els.personaExtraMarisaInput.value = '';
    refreshPromptPreviews();
    toast('已恢复默认人设（本机）');
  }

  // ---------- 一设数据库（手动对谈，人人可改，仅存本机；自动闲聊用服务器配置） ----------
  function closeCanonPanel() {
    els.canonPanel.hidden = true;
    els.settingsPanel.hidden = !settingsWasVisible;
  }

  async function openCanonPanel() {
    try {
      const res = await fetch('/api/canon', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || '读取一设数据库失败');
        return;
      }
      window.__canonDefaults = data;
      els.canonReimuInput.value = settings.canonReimu || data.defaults.reimu || '';
      els.canonMarisaInput.value = settings.canonMarisa || data.defaults.marisa || '';
      els.canonWorldInput.value = settings.canonWorld || data.defaults.world || '';
      els.canonPairInput.value = settings.canonPair || data.defaults.pair || '';
      els.canonNotesInput.value = settings.canonNotes || data.defaults.notes || '';
      settingsWasVisible = !els.settingsPanel.hidden;
      els.personaPanel.hidden = true;
      els.settingsPanel.hidden = true;
      els.canonPanel.hidden = false;
    } catch (_) {
      toast('无法连接服务器');
    }
  }

  function canonCustomized() {
    return ['Reimu', 'Marisa', 'World', 'Pair', 'Notes'].some((k) => {
      const v = settings['canon' + k];
      return !!v && v.trim();
    });
  }

  function assembleCanon() {
    if (!canonCustomized()) return '';
    const d = window.__canonDefaults;
    if (!d || !d.defaults) return '';
    const get = (key, defKey) => {
      const v = settings['canon' + key];
      return v && v.trim() ? v.trim() : (d.defaults[defKey] || '');
    };
    const parts = [];
    const reimu = get('Reimu', 'reimu');
    const marisa = get('Marisa', 'marisa');
    const world = get('World', 'world');
    const pair = get('Pair', 'pair');
    const notes = get('Notes', 'notes');
    if (reimu) parts.push(`【博丽灵梦 · 一设】\n${reimu}`);
    if (marisa) parts.push(`【雾雨魔理沙 · 一设】\n${marisa}`);
    if (world) parts.push(`【幻想乡 · 基础世界观】\n${world}`);
    if (pair) parts.push(`【主角组 · 两人关系】\n${pair}`);
    if (notes) parts.push(`【AI 易错提醒】\n${notes}`);
    return parts.join('\n\n');
  }

  function saveCanon() {
    settings.canonReimu = els.canonReimuInput.value.trim();
    settings.canonMarisa = els.canonMarisaInput.value.trim();
    settings.canonWorld = els.canonWorldInput.value.trim();
    settings.canonPair = els.canonPairInput.value.trim();
    settings.canonNotes = els.canonNotesInput.value.trim();
    saveSettings();
    toast('已保存到本机，手动对谈立即生效');
  }

  function resetCanon() {
    if (!window.__canonDefaults) return;
    settings.canonReimu = '';
    settings.canonMarisa = '';
    settings.canonWorld = '';
    settings.canonPair = '';
    settings.canonNotes = '';
    saveSettings();
    const d = window.__canonDefaults.defaults;
    els.canonReimuInput.value = d.reimu || '';
    els.canonMarisaInput.value = d.marisa || '';
    els.canonWorldInput.value = d.world || '';
    els.canonPairInput.value = d.pair || '';
    els.canonNotesInput.value = d.notes || '';
    toast('已恢复默认一设（本机）');
  }

  // ---------- 手动对谈 ----------
  function nextCharacterSpeaker() {
    for (let i = history.length - 1; i >= 0; i--) {
      const s = history[i].speaker;
      if (s === 'reimu' || s === 'marisa') {
        return s === 'marisa' ? 'reimu' : 'marisa';
      }
    }
    return 'marisa';
  }

  function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function renderReply(speaker, text) {
    if (!text || stopRequested) return false;
    const sentences = splitSentences(text);
    const parts = sentences.length ? sentences : [String(text).trim()].filter(Boolean);
    history.push({ speaker, text });

    const typingRow = appendTyping(speaker);
    const typingMs = Math.min(2600, 450 + Array.from(text).length * 16) + Math.random() * 400;
    await sleepMs(typingMs);
    removeTyping(typingRow);
    if (stopRequested) return false;

    if (parts.length === 1 && /^[\s，。！？!?…—、；：,.!?~～…·]+$/.test(parts[0]) && mergePunctOnly(speaker, parts[0])) {
      await maybeSummarizeManual();
      return true;
    }

    for (let i = 0; i < parts.length; i++) {
      appendMessage(speaker, parts[i]);
      if (i < parts.length - 1) {
        const endsStrong = /[！？。!?…—]$/.test(parts[i]);
        await sleepMs(endsStrong ? 800 + Math.random() * 600 : 620 + Math.random() * 520);
        if (stopRequested) return false;
      }
    }
    await maybeSummarizeManual();
    return true;
  }

  async function speak(speaker) {
    if (stopRequested) return null;
    busy = true;
    syncControls();
    let text = '';
    try {
      if (mode === 'ai') {
        text = await askAI(speaker);
      } else {
        text = await demoReply(speaker);
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('管理员关闭')) {
        mode = 'demo';
        updateModeBadge();
        toast('内置 AI 已关闭，本次对话使用演示台词');
        text = await demoReply(speaker);
      } else {
        toast(msg || '出错了，请重试');
        stopRequested = true;
        busy = false;
        syncControls();
        return null;
      }
    }
    const ok = await renderReply(speaker, text);
    busy = false;
    syncControls();
    return ok ? text : null;
  }

  async function askBatch(speaker, count) {
    const res = await fetch('/api/chat/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character: speaker,
        topic: manualTopic || '随便聊聊',
        history,
        turns: count,
        apiKey: settings.apiKey || undefined,
        baseUrl: settings.baseUrl,
        model: settings.model,
        temperature: settings.temperature,
        personas: { reimu: assemblePersona('reimu'), marisa: assemblePersona('marisa') },
        summary: manualSummary || undefined,
        canon: assembleCanon(),
        canonMode: canonCustomized() ? 'custom' : 'default',
        checkEnabled: settings.checkMode === 'on' && !!settings.checkApiKey,
        checkApiKey: settings.checkMode === 'on' ? settings.checkApiKey : undefined,
        checkBaseUrl: settings.checkMode === 'on' ? settings.checkBaseUrl : undefined,
        checkModel: settings.checkMode === 'on' ? settings.checkModel : undefined
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
        topic: manualTopic || '随便聊聊',
        history,
        apiKey: settings.apiKey || undefined,
        baseUrl: settings.baseUrl,
        model: settings.model,
        temperature: settings.temperature,
        persona: assemblePersona(speaker),
        summary: manualSummary || undefined,
        canon: assembleCanon(),
        canonMode: canonCustomized() ? 'custom' : 'default',
        checkEnabled: settings.checkMode === 'on' && !!settings.checkApiKey,
        checkApiKey: settings.checkMode === 'on' ? settings.checkApiKey : undefined,
        checkBaseUrl: settings.checkMode === 'on' ? settings.checkBaseUrl : undefined,
        checkModel: settings.checkMode === 'on' ? settings.checkModel : undefined
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `请求失败（${res.status}）`);
    }
    return data.reply;
  }

  async function maybeSummarizeManual() {
    const after = Number(serverInfo.summarizeAfter) || 0;
    const keep = Math.max(1, Number(serverInfo.summaryKeepRecent) || 6);
    if (!after || history.length <= after) return;
    const split = history.length - keep;
    const old = history.slice(0, split);
    const recent = history.slice(split);
    let summary = '';
    if (mode === 'ai') {
      try {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: manualTopic,
            messages: old,
            summaryApiKey: settings.summaryMode === 'custom' ? settings.summaryApiKey : undefined,
            summaryBaseUrl: settings.summaryMode === 'custom' ? settings.summaryBaseUrl : undefined,
            summaryModel: settings.summaryMode === 'custom' ? settings.summaryModel : undefined
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
      summary = `前面聊了${old.length}条关于「${manualTopic || '幻想乡'}」的内容`;
    }
    manualSummary = summary;
    history = recent;
    appendSystem(`（自动总结：${summary}）`);
  }

  async function fetchModels() {
    const btn = document.getElementById('fetchModelsBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '获取中…';
    }
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || '获取模型列表失败');
        return;
      }
      const models = data.models || [];
      if (!models.length) {
        toast('没有获取到模型');
        return;
      }
      showModelSelect(models);
      toast(`已获取 ${models.length} 个模型，下拉选择后立即生效`);
    } catch (_) {
      toast('无法连接服务器');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '重新获取';
      }
    }
  }

  function showModelSelect(models) {
    const row = els.modelRow;
    if (!row) return;
    row.innerHTML = '';

    const select = document.createElement('select');
    select.id = 'modelSelect';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '选择模型…';
    select.appendChild(placeholder);

    let hasCurrent = false;
    if (settings.model && !models.includes(settings.model)) {
      const current = document.createElement('option');
      current.value = settings.model;
      current.textContent = settings.model + '（当前）';
      current.selected = true;
      select.appendChild(current);
      hasCurrent = true;
    }
    for (const id of models) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      if (id === settings.model) {
        opt.selected = true;
        hasCurrent = true;
      }
      select.appendChild(opt);
    }

    const custom = document.createElement('option');
    custom.value = '__custom__';
    custom.textContent = '自定义…';
    select.appendChild(custom);

    select.addEventListener('change', () => {
      const value = select.value;
      if (value === '__custom__') {
        restoreModelInput();
      } else if (value) {
        settings.model = value;
        saveSettings();
      }
    });

    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.id = 'fetchModelsBtn';
    btn.type = 'button';
    btn.textContent = '重新获取';
    btn.addEventListener('click', fetchModels);

    row.appendChild(select);
    row.appendChild(btn);
  }

  function restoreModelInput() {
    const row = els.modelRow;
    if (!row) return;
    row.innerHTML = '';

    const input = document.createElement('input');
    input.id = 'modelInput';
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = 'deepseek-v4-flash';
    input.value = settings.model || '';
    input.addEventListener('input', () => {
      settings.model = input.value.trim();
      saveSettings();
    });

    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.id = 'fetchModelsBtn';
    btn.type = 'button';
    btn.textContent = '自动获取';
    btn.addEventListener('click', fetchModels);

    row.appendChild(input);
    row.appendChild(btn);
    input.focus();
  }

  function demoReply(speaker) {
    return new Promise((resolve) => {
      const delay = 700 + Math.random() * 900;
      setTimeout(() => {
        const lastItem = history[history.length - 1];
        resolve(demoEngine.reply(speaker, manualTopic, lastItem ? lastItem.speaker : null));
      }, delay);
    });
  }

  async function startConversation() {
    if (running || busy) return;
    stopRequested = false;
    const continuing = history.length > 0;
    if (!continuing) {
      manualTopic = els.topicInput.value.trim();
      manualSummary = '';
      history = [];
      demoEngine.reset();
      els.chatLog.innerHTML = '';
      if (manualTopic) {
        appendNarration(`（开场话题）${manualTopic}`);
      }
    } else if (els.topicInput.value.trim()) {
      manualTopic = els.topicInput.value.trim();
    }
    const total = Number(els.roundsSelect.value) * 2;
    pendingTurns = total;
    interjectQueue = [];
    running = true;
    syncControls();
    if (continuing) toast('继续上一段对话');

    const speaker = nextCharacterSpeaker();
    let replies = [];
    if (mode === 'ai') {
      try {
        replies = await askBatch(speaker, total);
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('管理员关闭')) {
          mode = 'demo';
          updateModeBadge();
          toast('内置 AI 已关闭，本次对话使用演示台词');
        } else {
          toast(msg || '出错了，请重试');
          stopRequested = true;
        }
      }
    }
    if (!replies.length && mode === 'demo') {
      let sp = speaker;
      for (let i = 0; i < total && !stopRequested; i++) {
        const text = await demoReply(sp);
        if (text) replies.push({ speaker: sp, text });
        sp = sp === 'marisa' ? 'reimu' : 'marisa';
      }
    }
    for (const item of replies) {
      if (stopRequested || !running) break;
      const ok = await renderReply(item.speaker, item.text);
      if (!ok) break;
      pendingTurns--;
    }
    await drainInterjections();
    running = false;
    busy = false;
    syncControls();
    if (stopRequested && history.length) {
      toast('已停止，可以继续插话或重新开始。');
    }
    stopRequested = false;
  }

  function queueInterjection() {
    const text = els.interjectInput.value.trim();
    if (!text) return;
    els.interjectInput.value = '';
    els.interjectRow.hidden = true;
    els.interjectBtn.hidden = false;
    if (busy || running) {
      interjectQueue.push(text);
      toast(busy ? '收到，等角色说完就接上。' : '收到，马上轮到。');
    } else {
      appendNarration(text);
      history.push({ speaker: 'user', text });
      speak(nextCharacterSpeaker()).then(() => drainInterjections()).then(() => syncControls());
    }
  }

  async function drainInterjections() {
    while (interjectQueue.length && !stopRequested) {
      const text = interjectQueue.shift();
      appendNarration(text);
      history.push({ speaker: 'user', text });
      await speak(nextCharacterSpeaker());
    }
  }

  // ---------- 事件绑定 ----------
  function bindSettings() {
    const form = $('settingsForm');
    if (form) form.addEventListener('submit', (e) => e.preventDefault());
    els.apiKeyInput.addEventListener('input', () => {
      settings.apiKey = els.apiKeyInput.value.trim();
      saveSettings();
      updateModeBadge();
    });
    els.baseUrlInput.addEventListener('input', () => {
      settings.baseUrl = els.baseUrlInput.value.trim();
      saveSettings();
    });
    els.modelInput.addEventListener('input', () => {
      settings.model = els.modelInput.value.trim();
      saveSettings();
    });
    els.fetchModelsBtn.addEventListener('click', fetchModels);
    els.tempInput.addEventListener('input', () => {
      settings.temperature = Number(els.tempInput.value);
      els.tempValue.textContent = settings.temperature.toFixed(2);
      saveSettings();
    });
    els.summaryModeSelect.addEventListener('change', () => {
      settings.summaryMode = els.summaryModeSelect.value;
      els.summaryCustomRow.hidden = settings.summaryMode !== 'custom';
      saveSettings();
    });
    els.summaryApiKeyInput.addEventListener('input', () => {
      settings.summaryApiKey = els.summaryApiKeyInput.value.trim();
      saveSettings();
    });
    els.summaryBaseUrlInput.addEventListener('input', () => {
      settings.summaryBaseUrl = els.summaryBaseUrlInput.value.trim();
      saveSettings();
    });
    els.summaryModelInput.addEventListener('input', () => {
      settings.summaryModel = els.summaryModelInput.value.trim();
      saveSettings();
    });
    els.checkModeSelect.addEventListener('change', () => {
      settings.checkMode = els.checkModeSelect.value;
      els.checkCustomRow.hidden = settings.checkMode !== 'on';
      saveSettings();
    });
    els.checkApiKeyInput.addEventListener('input', () => {
      settings.checkApiKey = els.checkApiKeyInput.value.trim();
      saveSettings();
    });
    els.checkBaseUrlInput.addEventListener('input', () => {
      settings.checkBaseUrl = els.checkBaseUrlInput.value.trim();
      saveSettings();
    });
    els.checkModelInput.addEventListener('input', () => {
      settings.checkModel = els.checkModelInput.value.trim();
      saveSettings();
    });
    els.settingsBtn.addEventListener('click', () => {
      if (!els.personaPanel.hidden) {
        closePersonaPanel();
      }
      if (!els.canonPanel.hidden) closeCanonPanel();
      els.settingsPanel.hidden = !els.settingsPanel.hidden;
    });
    els.personaBtn.addEventListener('click', () => {
      if (!els.canonPanel.hidden) closeCanonPanel();
      if (!els.personaPanel.hidden) {
        closePersonaPanel();
      } else {
        openPersonaPanel();
      }
    });
    els.personaCloseBtn.addEventListener('click', closePersonaPanel);
    els.personaSaveBtn.addEventListener('click', savePersonas);
    els.personaResetBtn.addEventListener('click', resetPersonas);
    els.aboutBtn.addEventListener('click', openAbout);
    els.aboutCloseBtn.addEventListener('click', closeAbout);
    els.aboutModal.addEventListener('click', (e) => {
      if (e.target === els.aboutModal) closeAbout();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.aboutModal.hidden) closeAbout();
    });
    els.canonBtn.addEventListener('click', () => {
      if (!els.personaPanel.hidden) closePersonaPanel();
      if (!els.canonPanel.hidden) {
        closeCanonPanel();
      } else {
        openCanonPanel();
      }
    });
    els.canonCloseBtn.addEventListener('click', closeCanonPanel);
    els.canonSaveBtn.addEventListener('click', saveCanon);
    els.canonResetBtn.addEventListener('click', resetCanon);
    [
      els.personaBaseReimuInput,
      els.personaExtraReimuInput,
      els.personaBaseMarisaInput,
      els.personaExtraMarisaInput
    ].forEach((el) => {
      if (el) el.addEventListener('input', refreshPromptPreviews);
    });
  }

  function bindEvents() {
    els.manualTab.addEventListener('click', () => switchView('manual'));
    els.autoTab.addEventListener('click', () => switchView('auto'));
    els.startBtn.addEventListener('click', startConversation);
    els.topicInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') startConversation();
    });
    els.stopBtn.addEventListener('click', () => {
      stopRequested = true;
      running = false;
      busy = false;
      syncControls();
      toast('已停止。');
    });
    els.clearBtn.addEventListener('click', clearChat);

    els.interjectBtn.addEventListener('click', () => {
      els.interjectRow.hidden = false;
      els.interjectBtn.hidden = true;
      els.interjectInput.focus();
    });
    els.cancelInterjectBtn.addEventListener('click', () => {
      els.interjectRow.hidden = true;
      els.interjectBtn.hidden = false;
      els.interjectInput.value = '';
    });
    els.sendInterjectBtn.addEventListener('click', queueInterjection);
    els.interjectInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') queueInterjection();
    });

    els.topicPanelBtn.addEventListener('click', () => {
      els.votePanel.hidden = !els.votePanel.hidden;
      els.topicPanelBtn.textContent = els.votePanel.hidden ? '话题投票' : '收起投票';
    });
    els.summaryPanelBtn.addEventListener('click', () => {
      els.summaryPanel.hidden = !els.summaryPanel.hidden;
      if (!els.summaryPanel.hidden) {
        fetchSummaries();
      }
    });
    els.giftBar.querySelectorAll('.gift-btn').forEach((btn) => {
      btn.addEventListener('click', () => sendGift(btn.dataset.gift, btn));
    });
    els.proposeBtn.addEventListener('click', proposeTopic);
    els.topicProposalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') proposeTopic();
    });
  }

  async function sendGift(giftId, btn) {
    if (!giftId || btn.disabled) return;
    btn.disabled = true;
    try {
      const res = await fetch('/api/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: viewerId, giftId })
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

  // ---------- 启动 ----------
  function init() {
    renderSettings();
    bindSettings();
    bindEvents();
    syncControls();
    updateModeBadge();
    fetch('/api/personas/manual', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        window.__manualDefaults = { base: d.base, rules: d.rules, full: d.full };
      })
      .catch(() => {});
    fetch('/api/canon', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        window.__canonDefaults = d;
      })
      .catch(() => {});
    pollTimer = setInterval(fetchState, 3000);
    updateBeijingClock();
    clockTimer = setInterval(updateBeijingClock, 30000);
    fetchState().then(() => {
      initialized = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
      } else if (!pollTimer) {
        fetchState();
        pollTimer = setInterval(fetchState, 3000);
        updateBeijingClock();
        clockTimer = setInterval(updateBeijingClock, 30000);
      }
    });
  }

  init();
})();
