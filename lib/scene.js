const { state } = require('./state');
const { beijingHour, scenePeriodKey } = require('./time');

// ---------- 角色状态与此刻画面（本地生成，不消耗 token） ----------
const REIMU_ACTION_POOL = {
  dawn: ['正蹲在廊下系草鞋带', '抱着刚叠好的被褥打哈欠'],
  morning: ['抱着茶杯窝在廊下晒太阳', '有一搭没一搭地扫着石阶'],
  noon: ['躺在廊下，团扇盖在脸上打盹', '对着空空的赛钱箱叹气'],
  afternoon: ['沏了新茶，看茶叶在水里打转', '一张张整理抽屉里皱巴巴的符卡'],
  dusk: ['往灶上添了火，锅里的汤咕嘟咕嘟', '倚着门框等天色暗下来'],
  night: ['对着月亮发呆，茶已经凉了', '坐在灯下缝补巫女服的衣角'],
  deep: ['把被子裹得严严实实，眼睛却还睁着', '听见风声轻轻翻了个身']
};
const MARISA_ACTION_POOL = {
  dawn: ['顶着乱糟糟的头发爬出魔法店', '蹲在院子里看昨晚实验的蘑菇长势'],
  morning: ['抱着扫帚在神社门口晃悠', '哗啦哗啦翻着借来的魔法书'],
  noon: ['把新调的药水举到阳光下看颜色', '趴在桌上研究符卡，帽子上粘了片叶子'],
  afternoon: ['在廊下摆弄一堆瓶瓶罐罐', '拿着放大镜研究石阶缝里的蘑菇'],
  dusk: ['从灶台后探出头，脸上沾着面粉', '把采来的蘑菇摊在石阶上晾'],
  night: ['骑在扫帚上绕着鸟居转圈', '指着天上的星星兴奋地说个不停'],
  deep: ['裹着毛毯缩成一团，还念叨着魔法公式', '枕着魔法书睡着了，帽沿盖住半张脸']
};
const MOOD_POOL = [
  '心情平静，嘴角却带着一点弧度',
  '心情很好，笑意怎么都藏不住',
  '有点别扭，嘴硬但心早就软了',
  '困得直打哈欠，却还赖着不走',
  '莫名地心情雀跃',
  '有点害羞，却硬撑着不承认'
];

function advanceSceneState() {
  const p = scenePeriodKey(beijingHour());
  const prev = state.scene;
  let reimuAction;
  let marisaAction;
  if (prev && prev.period === p && Math.random() < 0.55) {
    reimuAction = prev.reimuAction;
    marisaAction = prev.marisaAction;
  } else {
    const rp = REIMU_ACTION_POOL[p] || REIMU_ACTION_POOL.morning;
    const mp = MARISA_ACTION_POOL[p] || MARISA_ACTION_POOL.morning;
    reimuAction = rp[Math.floor(Math.random() * rp.length)];
    marisaAction = mp[Math.floor(Math.random() * mp.length)];
  }
  let mood = MOOD_POOL[Math.floor(Math.random() * MOOD_POOL.length)];
  if (prev && prev.mood && Math.random() < 0.75) {
    const idx = MOOD_POOL.indexOf(prev.mood);
    if (idx >= 0) {
      const shift = Math.random() < 0.5 ? -1 : 1;
      mood = MOOD_POOL[(idx + shift + MOOD_POOL.length) % MOOD_POOL.length];
    }
  }
  state.scene = {
    period: p,
    mood,
    reimuAction,
    marisaAction,
    note: prev && prev.note ? prev.note : ''
  };
}

function sceneStateText() {
  if (!state.scene) advanceSceneState();
  const sc = state.scene;
  const note = sc.note ? '，' + sc.note : '';
  return '【此刻画面】灵梦' + sc.reimuAction + '，魔理沙' + sc.marisaAction + '。灵梦' + sc.mood + note + '。让对话自然融入这个画面（动作、表情、身边的小东西都可以被提起），但不要用括号旁白解释画面。';
}
function displaySceneText() {
  if (!state.scene) advanceSceneState();
  const sc = state.scene;
  const note = sc.note ? '，' + sc.note : '';
  return '此刻：灵梦' + sc.reimuAction + '；魔理沙' + sc.marisaAction + '。' + sc.mood + note + '。';
}

function updateSceneNote(lines) {
  const joined = (lines || []).join('');
  let note = '';
  if (/脸红|耳尖|耳朵红|发烫/.test(joined)) note = '她还有点不好意思，耳尖微红';
  else if (/偷笑|忍不住笑|抿嘴/.test(joined)) note = '她嘴上不说，眼底却带着笑意';
  else if (/哈欠|犯困|困了/.test(joined)) note = '她有点犯困，说话都懒洋洋的';
  else if (/别扭|嘴硬|哼/.test(joined)) note = '她还在嘴硬，但明显心软了';
  if (note && state.scene) state.scene.note = note;
}

module.exports = { advanceSceneState, sceneStateText, displaySceneText, updateSceneNote };
