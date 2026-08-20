// ---------- 共享状态与 DOM 引用（前端各模块的地基） ----------
export const $ = (id) => document.getElementById(id);

export const els = {
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
  thinkingModeSlider: $('thinkingModeSlider'),
  thinkingModeValue: $('thinkingModeValue'),
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
  autoWelcome: $('autoWelcome'),
  adminTokenInput: $('adminTokenInput'),
  autoChatToggle: $('autoChatToggle'),
  twoAgentToggle: $('twoAgentToggle'),
  summaryStrengthSlider: $('summaryStrengthSlider'),
  summaryStrengthValue: $('summaryStrengthValue')
};

// 滑块档位映射（滑块位置 ↔ 档位名）
export const THINKING_MODES = ['none', 'low', 'high', 'max'];
export const SUMMARY_STRENGTHS = ['short', 'normal', 'long'];
export const THINKING_MODE_LABELS = ['无（none）', '低（low）', '高（high）', '最高（max）'];
export const SUMMARY_STRENGTH_LABELS = ['短（short · 120字提要）', '中（normal · 约300字）', '长（long · 约600字）'];

export const CHARACTERS = {
  reimu: { name: '灵梦', full: '博丽灵梦', avatar: 'avatars/reimu_head.png' },
  marisa: { name: '魔理沙', full: '雾雨魔理沙', avatar: 'avatars/marisa_head.png' }
};
export const STORE_KEY = 'gensokyo-chat-settings-v1';
export const VIEWER_KEY = 'gensokyo-viewer-id';
export const demoEngine = window.GensokyoDemo.createEngine();

// ---------- 本地存储 ----------
function loadSettings() {
  try {
    return Object.assign(
      {
        apiKey: '',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        temperature: 0.85,
        thinkingMode: 'none',
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
        canonNotes: '',
        adminToken: ''
      },
      JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    );
  } catch (_) {
    return {
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      temperature: 0.85,
      thinkingMode: 'none',
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
    localStorage.setItem(STORE_KEY, JSON.stringify(state.settings));
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

// ---------- 状态 ----------
export const state = {
  settings: loadSettings(),
  serverInfo: {
    hasServerKey: false,
    aiEnabled: true,
    autoChatEnabled: false,
    currentTopic: null,
    summarizeAfter: 20,
    summaryKeepRecent: 6
  },
  viewerId: getViewerId(),
  mode: 'demo',
  history: [],
  pendingTurns: 0,
  running: false,
  busy: false,
  stopRequested: false,
  interjectQueue: [],
  manualTopic: '',
  manualSummary: '',
  summaryData: { current: null, history: [] },
  editingSummaryId: null,
  autoActive: false,
  pollTimer: null,
  clockTimer: null,
  lastAutoMsgId: 0,
  initialized: false,
  lastStatusOk: false,
  settingsWasVisible: false,
  suppressScroll: false,
  manualDefaults: null,
  canonDefaults: null
};

export { loadSettings, saveSettings, getViewerId };

export function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
