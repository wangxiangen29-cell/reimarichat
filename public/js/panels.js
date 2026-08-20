import { els, state, saveSettings } from './core.js';
import { toast } from './render.js';

// ---------- AI 设置表单 ----------
export function renderSettings() {
  els.apiKeyInput.value = state.settings.apiKey;
  els.baseUrlInput.value = state.settings.baseUrl;
  els.modelInput.value = state.settings.model;
  els.tempInput.value = String(state.settings.temperature);
  els.tempValue.textContent = state.settings.temperature.toFixed(2);
  els.thinkingModeSelect.value = state.settings.thinkingMode || 'none';
  els.summaryModeSelect.value = state.settings.summaryMode || 'builtin';
  els.summaryApiKeyInput.value = state.settings.summaryApiKey;
  els.summaryBaseUrlInput.value = state.settings.summaryBaseUrl;
  els.summaryModelInput.value = state.settings.summaryModel;
  els.summaryCustomRow.hidden = state.settings.summaryMode !== 'custom';
  els.checkModeSelect.value = state.settings.checkMode || 'off';
  els.checkApiKeyInput.value = state.settings.checkApiKey;
  els.checkBaseUrlInput.value = state.settings.checkBaseUrl;
  els.checkModelInput.value = state.settings.checkModel;
  els.checkCustomRow.hidden = state.settings.checkMode !== 'on';
  if (els.adminTokenInput) els.adminTokenInput.value = state.settings.adminToken || '';
}

// ---------- 模型列表 ----------
export async function fetchModels() {
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
        apiKey: state.settings.apiKey || undefined,
        baseUrl: state.settings.baseUrl
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
  if (state.settings.model && !models.includes(state.settings.model)) {
    const current = document.createElement('option');
    current.value = state.settings.model;
    current.textContent = state.settings.model + '（当前）';
    current.selected = true;
    select.appendChild(current);
    hasCurrent = true;
  }
  for (const id of models) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (id === state.settings.model) {
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
      state.settings.model = value;
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
  input.value = state.settings.model || '';
  input.addEventListener('input', () => {
    state.settings.model = input.value.trim();
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

// ---------- 人设管理（手动对谈，人人可改，仅存本机） ----------
function closePersonaPanel() {
  els.personaPanel.hidden = true;
  els.settingsPanel.hidden = !state.settingsWasVisible;
}

export async function openPersonaPanel() {
  try {
    const manualRes = await fetch('/api/personas/manual', { cache: 'no-store' });
    const manual = await manualRes.json().catch(() => ({}));
    if (!manualRes.ok) {
      toast(manual.error || '读取默认人设失败');
      return;
    }
    state.manualDefaults = { base: manual.base, rules: manual.rules, full: manual.full };
    els.personaBaseReimuInput.value = state.settings.personaBaseReimu || manual.base.reimu;
    els.personaExtraReimuInput.value = state.settings.personaExtraReimu || '';
    els.personaBaseMarisaInput.value = state.settings.personaBaseMarisa || manual.base.marisa;
    els.personaExtraMarisaInput.value = state.settings.personaExtraMarisa || '';
    refreshPromptPreviews();
    state.settingsWasVisible = !els.settingsPanel.hidden;
    els.canonPanel.hidden = true;
    els.settingsPanel.hidden = true;
    els.personaPanel.hidden = false;
  } catch (_) {
    toast('无法连接服务器');
  }
}

export function assemblePersona(character) {
  const d = state.manualDefaults;
  if (!d) return undefined;
  const isMarisa = character === 'marisa';
  const cap = isMarisa ? 'Marisa' : 'Reimu';
  const key = isMarisa ? 'marisa' : 'reimu';
  const base = state.settings['personaBase' + cap] || d.base[key];
  const extra = state.settings['personaExtra' + cap] || '';
  return base + (extra ? '\n' + extra : '') + '\n' + d.rules[key];
}

export function refreshPromptPreviews() {
  const d = state.manualDefaults;
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

export function savePersonas() {
  state.settings.personaBaseReimu = els.personaBaseReimuInput.value.trim();
  state.settings.personaExtraReimu = els.personaExtraReimuInput.value.trim();
  state.settings.personaBaseMarisa = els.personaBaseMarisaInput.value.trim();
  state.settings.personaExtraMarisa = els.personaExtraMarisaInput.value.trim();
  saveSettings();
  refreshPromptPreviews();
  toast('已保存到本机，手动对谈立即生效');
}

export function resetPersonas() {
  if (!state.manualDefaults) return;
  state.settings.personaBaseReimu = '';
  state.settings.personaExtraReimu = '';
  state.settings.personaBaseMarisa = '';
  state.settings.personaExtraMarisa = '';
  saveSettings();
  els.personaBaseReimuInput.value = state.manualDefaults.base.reimu;
  els.personaExtraReimuInput.value = '';
  els.personaBaseMarisaInput.value = state.manualDefaults.base.marisa;
  els.personaExtraMarisaInput.value = '';
  refreshPromptPreviews();
  toast('已恢复默认人设（本机）');
}

// ---------- 一设数据库（手动对谈，人人可改，仅存本机；自动闲聊用服务器配置） ----------
function closeCanonPanel() {
  els.canonPanel.hidden = true;
  els.settingsPanel.hidden = !state.settingsWasVisible;
}

export async function openCanonPanel() {
  try {
    const res = await fetch('/api/canon', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error || '读取一设数据库失败');
      return;
    }
    state.canonDefaults = data;
    els.canonReimuInput.value = state.settings.canonReimu || data.defaults.reimu || '';
    els.canonMarisaInput.value = state.settings.canonMarisa || data.defaults.marisa || '';
    els.canonWorldInput.value = state.settings.canonWorld || data.defaults.world || '';
    els.canonPairInput.value = state.settings.canonPair || data.defaults.pair || '';
    els.canonNotesInput.value = state.settings.canonNotes || data.defaults.notes || '';
    state.settingsWasVisible = !els.settingsPanel.hidden;
    els.personaPanel.hidden = true;
    els.settingsPanel.hidden = true;
    els.canonPanel.hidden = false;
  } catch (_) {
    toast('无法连接服务器');
  }
}

export function canonCustomized() {
  return ['Reimu', 'Marisa', 'World', 'Pair', 'Notes'].some((k) => {
    const v = state.settings['canon' + k];
    return !!v && v.trim();
  });
}

export function assembleCanon() {
  if (!canonCustomized()) return '';
  const d = state.canonDefaults;
  if (!d || !d.defaults) return '';
  const get = (key, defKey) => {
    const v = state.settings['canon' + key];
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

export function saveCanon() {
  state.settings.canonReimu = els.canonReimuInput.value.trim();
  state.settings.canonMarisa = els.canonMarisaInput.value.trim();
  state.settings.canonWorld = els.canonWorldInput.value.trim();
  state.settings.canonPair = els.canonPairInput.value.trim();
  state.settings.canonNotes = els.canonNotesInput.value.trim();
  saveSettings();
  toast('已保存到本机，手动对谈立即生效');
}

export function resetCanon() {
  if (!state.canonDefaults) return;
  state.settings.canonReimu = '';
  state.settings.canonMarisa = '';
  state.settings.canonWorld = '';
  state.settings.canonPair = '';
  state.settings.canonNotes = '';
  saveSettings();
  const d = state.canonDefaults.defaults;
  els.canonReimuInput.value = d.reimu || '';
  els.canonMarisaInput.value = d.marisa || '';
  els.canonWorldInput.value = d.world || '';
  els.canonPairInput.value = d.pair || '';
  els.canonNotesInput.value = d.notes || '';
  toast('已恢复默认一设（本机）');
}

export { closePersonaPanel, closeCanonPanel };
