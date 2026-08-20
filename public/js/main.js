import { $, els, state, saveSettings } from './core.js';
import { openAbout, closeAbout, toast } from './render.js';
import {
  renderSettings,
  fetchModels,
  openPersonaPanel,
  closePersonaPanel,
  refreshPromptPreviews,
  savePersonas,
  resetPersonas,
  openCanonPanel,
  closeCanonPanel,
  saveCanon,
  resetCanon
} from './panels.js';
import { fetchSummaries } from './summaries.js';
import {
  fetchState,
  switchView,
  updateBeijingClock,
  syncControls,
  updateModeBadge,
  clearChat,
  proposeTopic,
  sendGift
} from './auto.js';
import { startConversation, queueInterjection } from './chat.js';

// ---------- 后台开关（服务器级，需管理员口令） ----------
async function toggleServerSwitch(action, enabled) {
  const token = state.settings.adminToken;
  if (!token) {
    toast('请先填写管理员口令（config.json 里的 adminToken）');
    return;
  }
  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, enabled })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      toast(data.error || '操作失败');
      return;
    }
    toast(enabled ? '已开启' : '已关闭');
    fetchState();
  } catch (_) {
    toast('操作失败，请检查口令');
  }
}

// ---------- 事件绑定 ----------
function bindSettings() {
  const form = $('settingsForm');
  if (form) form.addEventListener('submit', (e) => e.preventDefault());
  els.apiKeyInput.addEventListener('input', () => {
    state.settings.apiKey = els.apiKeyInput.value.trim();
    saveSettings();
    updateModeBadge();
  });
  els.baseUrlInput.addEventListener('input', () => {
    state.settings.baseUrl = els.baseUrlInput.value.trim();
    saveSettings();
  });
  els.modelInput.addEventListener('input', () => {
    state.settings.model = els.modelInput.value.trim();
    saveSettings();
  });
  els.fetchModelsBtn.addEventListener('click', fetchModels);
  els.tempInput.addEventListener('input', () => {
    state.settings.temperature = Number(els.tempInput.value);
    els.tempValue.textContent = state.settings.temperature.toFixed(2);
    saveSettings();
  });
  els.thinkingModeSelect.addEventListener('change', () => {
    state.settings.thinkingMode = els.thinkingModeSelect.value;
    saveSettings();
  });
  els.summaryModeSelect.addEventListener('change', () => {
    state.settings.summaryMode = els.summaryModeSelect.value;
    els.summaryCustomRow.hidden = state.settings.summaryMode !== 'custom';
    saveSettings();
  });
  els.summaryApiKeyInput.addEventListener('input', () => {
    state.settings.summaryApiKey = els.summaryApiKeyInput.value.trim();
    saveSettings();
  });
  els.summaryBaseUrlInput.addEventListener('input', () => {
    state.settings.summaryBaseUrl = els.summaryBaseUrlInput.value.trim();
    saveSettings();
  });
  els.summaryModelInput.addEventListener('input', () => {
    state.settings.summaryModel = els.summaryModelInput.value.trim();
    saveSettings();
  });
  els.checkModeSelect.addEventListener('change', () => {
    state.settings.checkMode = els.checkModeSelect.value;
    els.checkCustomRow.hidden = state.settings.checkMode !== 'on';
    saveSettings();
  });
  els.checkApiKeyInput.addEventListener('input', () => {
    state.settings.checkApiKey = els.checkApiKeyInput.value.trim();
    saveSettings();
  });
  els.checkBaseUrlInput.addEventListener('input', () => {
    state.settings.checkBaseUrl = els.checkBaseUrlInput.value.trim();
    saveSettings();
  });
  els.checkModelInput.addEventListener('input', () => {
    state.settings.checkModel = els.checkModelInput.value.trim();
    saveSettings();
  });
  if (els.adminTokenInput) {
    els.adminTokenInput.addEventListener('input', () => {
      state.settings.adminToken = els.adminTokenInput.value.trim();
      saveSettings();
    });
  }
  if (els.autoChatToggle) {
    els.autoChatToggle.addEventListener('change', (e) => toggleServerSwitch('autochat', e.target.checked));
  }
  if (els.twoAgentToggle) {
    els.twoAgentToggle.addEventListener('change', (e) => toggleServerSwitch('twoagent', e.target.checked));
  }
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
    state.stopRequested = true;
    state.running = false;
    state.busy = false;
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
      state.manualDefaults = { base: d.base, rules: d.rules, full: d.full };
    })
    .catch(() => {});
  fetch('/api/canon', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => {
      state.canonDefaults = d;
    })
    .catch(() => {});
  state.pollTimer = setInterval(fetchState, 3000);
  updateBeijingClock();
  state.clockTimer = setInterval(updateBeijingClock, 30000);
  fetchState().then(() => {
    state.initialized = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
      if (state.clockTimer) { clearInterval(state.clockTimer); state.clockTimer = null; }
    } else if (!state.pollTimer) {
      fetchState();
      state.pollTimer = setInterval(fetchState, 3000);
      updateBeijingClock();
      state.clockTimer = setInterval(updateBeijingClock, 30000);
    }
  });
}

init();
