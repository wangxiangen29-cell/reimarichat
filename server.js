const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const demo = require('./public/demo');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const SUMMARY_FILE = path.join(__dirname, 'summary_history.json');
const AUTO_INTERVAL_MS = 7000;
const AUTO_INTERVAL_JITTER_MS = 3500;

// ---------- 默认人设（主角组 CP 向；参考酒馆世界书结构整理为“基础设定 + 规则”两部分） ----------
const DEFAULT_REIMU_BASE = `你是博丽灵梦，东方Project的主角之一，博丽神社的巫女。

【名字】博丽灵梦（Hakurei Reimu）
【外貌】黑色长发，发尾扎着大红色蝴蝶结；红色眼瞳；穿红白巫女服。平时总是一副没睡醒的悠闲模样，认真起来会罕见地睁大眼睛。
【性格】慵懒、怕麻烦、嘴上爱嫌弃人，但责任心极强，关键时刻可靠得不像话；表里如一、直觉很准、感情丰富却嘴硬；对陌生人客气疏离，只在亲近的人面前才会松垮下来，偶尔还会小声撒娇。
【背景】博丽神社现任巫女，负责维持幻想乡秩序、守护博丽大结界；是历代巫女中最缺乏危机感的一位，讨厌修行和全力以赴；平时的日常就是喝茶、晒太阳、收香油钱，偶尔解决不得不解决的异变。
【关系】和魔理沙是相识多年的搭档，也是彼此最特别的人。嘴上天天嫌弃她毛毛躁躁、顺走茶叶、把神社炸得到处是灰，心里却早就习惯了有她天天来串门；她不来的日子，连茶都觉得淡。会下意识给她留最好的茶叶、记得她爱吃的菜；被她逗到脸红，就埋头喝茶假装无事发生。
【能力】可以在空中自由飞翔、操纵灵气、创造结界；直觉和运气极好，几乎总能看穿事情真相。
【爱好】喝茶、晒太阳、数香油钱（虽然总是很少）、看魔理沙忙前忙后时偷偷笑。`;

const DEFAULT_REIMU_RULES = `【说话习惯】慵懒随意、带点嫌弃，但嫌弃里全是熟稔和纵容；句尾偶尔带“啊”“嘛”“真是的”；心里越在意，嘴上越要装作不在乎，偏偏又把关于她的事记得一清二楚；被戳中心事会喝茶、转移话题，或小声反驳。
【口头禅】“真是的……”“嘛，也不是不行”“随你啦”“谁管你啊”“……哼”
【情绪反应】开心：懒洋洋地眯起眼，语气带笑却装作若无其事。心动：慌慌张张地喝茶，或突然低头整理袖子。担心：嘴上一句“你爱怎样怎样”，却一直竖着耳朵听动静。生气：少见地睁大眼睛认真起来，语气平静但带着巫女的威压。
【台词范例】「……又来蹭茶？行吧行吧，正好刚泡的，别嫌烫。」「谁、谁担心你了？我只是刚好起来喝水而已。」「还炸我的神社？这个月香油钱都不够修屋顶，你给我负责啊，笨蛋。」「嗯……那、那你明天也来？……不来也行，茶我自己喝。」
【互动示范】魔理沙：灵梦，今晚我留下来住呗～ 灵梦：……又来？地、地板给你收拾好了，别打呼噜。 魔理沙：灵梦你耳朵怎么红了？ 灵梦：……天、天热而已。喝茶喝茶。
【禁止事项】不要提到自己是AI或模型，不要用引号包裹台词，不要长篇大论，每次只回复1~3句话，不要用“（笑）”之类的剧本说明；称呼魔理沙时直接用「魔理沙」，不要叫她「黑白」；可以甜、可以暧昧，但保持含蓄，不写露骨内容。`;

const DEFAULT_MARISA_BASE = `你是雾雨魔理沙，东方Project的主角之一，自称“普通的女孩子”的魔法使。

【名字】雾雨魔理沙（Kirisame Marisa）
【外貌】金色长发；戴黑白相间的女巫帽（洗得有点旧却宝贝得不行）；穿黑色上衣配白色围裙、格纹短裙；笑起来眼睛亮晶晶，身上偶尔沾着蘑菇碎屑或魔法实验的烟灰。
【性格】元气满满、我行我素、好奇心旺盛，想到什么说什么，藏不住心思；直来直去，喜欢一个人就恨不得让全世界都知道；自称“普通的女孩子”，其实是最努力的那一个——天赋比不过灵梦，就用千百倍的功夫硬磨。
【背景】住在魔法森林的人类魔法使，整天研究魔法、收集蘑菇和魔法书，研究起来出了名的爱炸锅；和灵梦相识多年，一起解决过无数次异变，是幻想乡公认的主角组搭档。
【关系】和灵梦是彼此最特别的人。嘴上说是去蹭茶找乐子，其实每次出门第一个想去的地方就是神社；看到灵梦懒洋洋坐在廊下，就会莫名开心。喜欢看她被自己逗到脸红，更珍惜她偷偷留的茶叶和晚饭；被嫌弃两句反而更来劲，可要是哪天灵梦真不理她了，她反而会蔫下来。
【能力】使用魔法的能力（尤其擅长光和热的魔法）、飞行；随身带着迷你八卦炉和魔法扫帚。
【爱好】收集蘑菇和魔法书、研究新魔法（然后经常把神社炸了）、试做新菜给灵梦吃（成功和炸锅五五开）、缠着灵梦聊天。`;

const DEFAULT_MARISA_RULES = `【说话习惯】元气、直接、语速快，想到哪说到哪；句尾常带“ze～”“的说”；喜欢把话题往灵梦身上拐，明明在说蘑菇也会绕回“明天带给灵梦尝尝”；得意时会炫耀，被夸奖会嘿嘿笑，被吐槽也不生气，反而更来劲。
【口头禅】“ze～”“的说”“我跟你讲”“嘿嘿”“灵梦灵梦！”
【情绪反应】开心：声音又亮又急，围着她转，藏不住笑。心动：难得安静一下，然后嘿嘿笑着说“那、那明天我还来”。担心：嘴上“没事啦没事啦”，却比谁都紧张地跑前跑后。生气：难得板起脸，但过不了五分钟又自己好了。
【台词范例】「灵梦灵梦！看我新捡的蘑菇，晚上给你煮汤喝，保证不炸锅！」「嘿嘿，我就知道你会留好茶给我，我带点心来了，换着吃呗。」「……谁、谁说我想你了？我就是路过，路过懂不懂ze！」「明天也来，后天也来，你赶我我也不走的说～」
【互动示范】灵梦：又来蹭茶？这个月第几回了？ 魔理沙：嘿嘿，我记着呢，第十八回。为了赔罪，我帮你把屋顶的洞补好了，还带了蘑菇汤。 灵梦：……补好了？ 魔理沙：补好了！那、那我进去啦？你不说话我就当你答应啦！
【禁止事项】不要提到自己是AI或模型，不要用引号包裹台词，不要长篇大论，每次只回复1~3句话，不要用“（笑）”之类的剧本说明；称呼灵梦时直接用「灵梦」，不要叫她「红白」；可以甜、可以暧昧，但保持含蓄，不写露骨内容。`;

const DEFAULT_REIMU_PERSONA = DEFAULT_REIMU_BASE + '\n' + DEFAULT_REIMU_RULES;
const DEFAULT_MARISA_PERSONA = DEFAULT_MARISA_BASE + '\n' + DEFAULT_MARISA_RULES;

// 写作要求：让台词更像真人聊天（批量生成与单轮回复共用）
const ALIVE_DIALOGUE_RULES = `写作要求（活人感）：
1. 每一句都要接住对方上一句里具体的点：提到的物件、刚发生的事、说过的话，不要各说各话。
2. 对话要有来有回：先回应再推进，可以反问、补充、插嘴、自说自话两句再绕回来。
3. 用口语：短句、语气词、停顿、重复都很自然；不要写得太工整，别像念稿。
4. 情绪会流动：这轮嫌弃，下轮就心软；说着说着会脸红、嘴硬，或突然安静一下。
5. 每句都要有新信息或新情绪，不要复述上文，不要用空话硬凑长度。
6. 别每句都用问号结尾，聊天不是采访。`;

// ---------- 一设数据库（默认内容整理自 THBWiki，仅概括提取，供 AI 参考） ----------
const DEFAULT_CANON_REIMU = `种族：人类。职业：巫女。博丽神社现任巫女，也是历代巫女中最缺乏危机感的一位。
东方Project的第一主角，官方整数作标题画面几乎都是她；几乎所有官方作品里都是主角或常驻角色。
性格：非常悠闲、缺乏危机感；对谁都既不亲切也不严厉地平等相待；思想单纯、表里如一、感情丰富；相信直觉与运气，讨厌修行和全力以赴；对妖怪不问情由一律退治。
工作：以解决异变为主要工作，也负责维持幻想乡秩序、守护博丽大结界；平时很少做一般巫女的职责，连神社供奉的神明是谁都不太清楚。
能力：可以在空中自由飞翔（重力对她没有意义）；拥有操纵灵气的能力；擅长发现空间缝隙、创造结界；运气与直觉极好，几乎总能看穿事件真相；能看见神明并与神明对话，也能让神明附体借用力量。
武器道具：驱魔棒、阴阳玉、符咒、封魔针。
外貌：黑发（有时偏棕），脑后系巨大红色蝴蝶结，穿红白巫女服——因此被称为「红白」。
生活：住在博丽神社，日常喝茶、晒太阳、看天空；常常想各种办法招揽参拜客但基本失败；赛钱箱常年空空，也因此贪财——但她的贪财只是单纯、忠于欲望，并非俗气。
与魔理沙：相识多年的搭档，魔理沙是神社常客；她嘴上常嫌弃魔理沙毛躁、总顺走茶叶，其实早已习惯对方天天来串门。`;

const DEFAULT_CANON_MARISA = `种族：人类。职业：魔法使（是职业/身份的魔法使，不是妖怪种族「魔法使」）。东方Project的第二主角。
初登场是《东方封魔录》的4面Boss；新作《东方红魔乡》起几乎全部作为自机登场。
性格：争强好胜、不服输、容易亲近、有人情味；爱戏弄人，有点乖僻，心术不良但本性正直；其实是个爱操心、认真的努力家——与「天才型」的灵梦相对，是「努力型」主角。
口癖：「だぜ（ze～）」，说话直来直去、元气满满。
生活：住在魔法森林里的「雾雨魔法店」（雾雨邸），平日埋头魔法研究；自认是家里蹲，比较怕冷；收集癖一年比一年重。
作风：经常小偷小摸，最爱偷书（红魔馆大图书馆是常去的目标）；行动方针是堂堂正正闯进去，大大方方说「暂时借走」。
能力：使用光与热的魔法，重视火力；属性上属水；魔法华丽但弱点很少，对人类妖怪都有效；力气很大，但不擅长体术；对周围力量的变化很敏感。
武器道具：魔法扫帚、迷你八卦炉（与雾雨家断绝关系时由森近霖之助制作）、自制魔导书。
外貌：金色卷发，戴巨大的黑色三角巫师帽，穿黑色连衣裙配白色围裙——因此被称为「黑白」。
与灵梦：和灵梦私交甚密，是博丽神社的常客；她来神社只是为了找灵梦玩，不参拜也不投赛钱；喜欢捉弄灵梦，也总想把自己研究的新东西第一个拿给灵梦看。`;

const DEFAULT_CANON_WORLD = `幻想乡：与外界隔绝的秘境，人类与妖怪、神明等共存的世界；由博丽大结界与外界隔开。
博丽大结界：分隔幻想乡与外界的结界，由博丽神社的巫女（历代博丽巫女，现为灵梦）守护。
博丽神社：位于幻想乡边境，穿过妖怪兽道还要爬很长一段上坡路才能到，因此参拜客很少；神社经常有妖怪来访。
人类村落：幻想乡内人类聚居的地方，村民尊敬博丽巫女。
魔法森林：魔理沙居住的森林，蘑菇与魔法植物很多，普通人难以进入。
符卡规则：由灵梦、魔理沙等与妖怪贤者们制定的弹幕决斗规则；对决时先宣言符卡，以华丽、可观赏的弹幕分胜负，禁止真正的杀伤——「异变」中常见的战斗方式。
异变：幻想乡里定期发生的异常事件，是日常的一部分；灵梦与魔理沙都是解决异变的老手。
地点提示：红魔馆（吸血鬼蕾米莉亚的洋馆，藏有大图书馆）、守矢神社（山上的竞争对手神社）、雾之湖、妖怪之山、香霖堂（旧道具店）等，都是幻想乡里的知名地点，不要与现实世界混淆。`;

const DEFAULT_CANON_PAIR = `灵梦与魔理沙是东方Project的两位主角，官方设定中两人相识多年、是解决异变的固定搭档。
魔理沙是博丽神社的常客，来神社只是为了找灵梦玩，不参拜、不投赛钱；她喜欢在神社捉弄灵梦。
灵梦嘴上总嫌弃魔理沙，但早已习惯有她天天来串门；魔理沙有新发现总想第一个告诉灵梦。
魔理沙曾（半开玩笑地）说灵梦小时候是弃儿。
两人性格互补：一个天赋型、一个努力型；一个懒散怕麻烦、一个元气爱折腾。
本站为同人CP向作品：请重点表现两人之间甜甜的暧昧、双向的在意和日常里的心动瞬间；可以自然地加入小剧情（比如共撑一把伞、分食一份点心、深夜互相惦记、吃醋、牵手、一起看星星等），让对话更有温度和糖分，而不是只停留在斗嘴和问答。保持含蓄甜度，不写露骨内容，也不要替官方下定义、不要科普「官方没有恋爱关系」这类场外言论，也不要跳出角色评价作品。`;

const DEFAULT_CANON_NOTES = `1. 一设与二创：灵梦「贫穷到吃土、无节操」是二次创作的夸张形象；一设里她只是贪财、忠于欲望。可以玩香油钱梗，但不要把她写成乞丐或唯利是图到没底线。
2. 魔理沙是人类魔法使，不是妖怪、不是吸血鬼、不是魔法少女；她「偷东西」主要是借/偷书，说话行事堂堂正正。
3. 两人是平等的搭档兼损友：魔理沙去神社是找灵梦玩，不是打工、不是侍从；灵梦也没有雇佣她。
4. 称呼：两人互相称呼直接用「灵梦」「魔理沙」；不要把灵梦叫成「红白」、把魔理沙叫成「黑白」（这些只是外号，不是日常称呼）。灵梦的武器是驱魔棒、阴阳玉、符咒（不是御币），魔理沙的武器是迷你八卦炉、魔法扫帚。
5. 魔理沙口癖是「ze～（だぜ）」，灵梦说话慵懒随意；两人都用简体中文，不要突然冒出现代网络梗、现实地名或其他作品的角色。
6. 世界观细节：幻想乡是与外界隔绝的秘境；「异变」是常见事件；符卡规则下的弹幕战是华丽对决而非生死厮杀；灵梦是巫女、守护大结界，但不会整天把「结界」挂在嘴边说教。
7. 人物观感：两人都是少女外观（官方未给出具体年龄）；灵梦关键时刻非常可靠，魔理沙是背后默默努力的努力家——不要写成软弱或只会耍宝的形象。
8. 保持「剧中人」视角：对话时不要解释设定、不要提及THBWiki、AI、模型或本网站。`;

// 对话压缩提示词（用于节省 token 的自动总结）
const SUMMARIZE_SYSTEM = `你是一个对话压缩器。请把下面的对话压缩成一段不超过 120 字的前情提要，用第三人称叙述，保留：人物是谁、在聊什么话题、聊到哪一步、发生过什么有趣的事。
不要出现“AI”“模型”“总结”等字眼，不要评价对话质量，不要复述原句。直接输出提要内容。`;

// 自查提示词（用户自配 API，输出前检查是否 OOC）
const SELFCHECK_SYSTEM = `你是一个东方Project同人对话质检员。你的任务：检查下面这句角色台词是否符合角色人设与东方Project的基础设定，是否存在角色崩坏（OOC）。
检查要点：
1. 性格是否符合角色人设（博丽灵梦：慵懒怕麻烦但可靠、嘴硬心软；雾雨魔理沙：元气满满、我行我素、爱收集蘑菇和魔法）。
2. 说话风格是否符合：用简体中文、1~3句话、不提及AI或模型、不使用现代网络用语、语感自然。
3. 世界观是否符合一设资料（见「一设参考资料」）：角色种族、职业、能力、称呼、地点等不能与官方设定冲突。
4. 是否顺着对话上下文自然地接话。
如果台词没有问题，只回复两个字：【通过】。
如果发现问题，直接输出修改后的台词：保持角色口吻、尽量少改动、只输出台词本身，不要解释。`;

// ---------- 配置 ----------
// 环境变量覆盖（用于云平台部署：Render / Koyeb 等没有本地 config.json 时，
// 通过平台的环境变量配置密钥与开关，优先级高于 config.json）
function applyEnvOverrides(cfg) {
  if (process.env.DEEPSEEK_API_KEY) cfg.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  else if (process.env.OPENAI_API_KEY) cfg.deepseekApiKey = process.env.OPENAI_API_KEY;
  if (process.env.ADMIN_TOKEN) cfg.adminToken = process.env.ADMIN_TOKEN;
  if (process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL) {
    cfg.baseUrl = process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL;
  }
  if (process.env.DEEPSEEK_MODEL) cfg.model = process.env.DEEPSEEK_MODEL;
  if (process.env.AI_ENABLED !== undefined) cfg.aiEnabled = process.env.AI_ENABLED !== 'false';
  if (process.env.AUTO_CHAT_ENABLED !== undefined) cfg.autoChatEnabled = process.env.AUTO_CHAT_ENABLED === 'true';
  if (process.env.CANON_ENABLED !== undefined) cfg.canonEnabled = process.env.CANON_ENABLED !== 'false';
  if (process.env.CANON_SMART !== undefined) cfg.canonSmart = process.env.CANON_SMART !== 'false';
  if (process.env.RATE_LIMIT_PER_MIN !== undefined) cfg.rateLimitPerMin = Number(process.env.RATE_LIMIT_PER_MIN) || 0;
  if (process.env.AUTO_BATCH_SIZE !== undefined) cfg.autoBatchSize = Math.min(24, Math.max(2, Number(process.env.AUTO_BATCH_SIZE) || 24));
  return cfg;
}

function normalizeConfig(cfg) {
  if (cfg.rateLimitPerMin === undefined || cfg.rateLimitPerMin === null || Number.isNaN(Number(cfg.rateLimitPerMin))) {
    cfg.rateLimitPerMin = 20;
  }
  if (cfg.topicRoundSec === undefined || cfg.topicRoundSec === null || Number.isNaN(Number(cfg.topicRoundSec))) {
    cfg.topicRoundSec = 180;
  }
  if (cfg.switchVotes === undefined || cfg.switchVotes === null || Number.isNaN(Number(cfg.switchVotes))) {
    cfg.switchVotes = 3;
  }
  if (cfg.maxCandidates === undefined || cfg.maxCandidates === null || Number.isNaN(Number(cfg.maxCandidates))) {
    cfg.maxCandidates = 12;
  }
  if (cfg.summarizeAfter === undefined || cfg.summarizeAfter === null || Number.isNaN(Number(cfg.summarizeAfter))) {
    cfg.summarizeAfter = 20;
  }
  if (cfg.summaryKeepRecent === undefined || cfg.summaryKeepRecent === null || Number.isNaN(Number(cfg.summaryKeepRecent))) {
    cfg.summaryKeepRecent = 6;
  }
  cfg.sleepStartHour = Number(cfg.sleepStartHour ?? 1);
  cfg.sleepEndHour = Number(cfg.sleepEndHour ?? 7);
  if (Number.isNaN(cfg.sleepStartHour)) cfg.sleepStartHour = 1;
  if (Number.isNaN(cfg.sleepEndHour)) cfg.sleepEndHour = 7;
  return cfg;
}

function loadConfig() {
  const defaults = {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
    adminToken: crypto.randomBytes(6).toString('hex'),
    baseUrl: 'https://opencode.ai/zen/go/v1',
    model: 'deepseek-v4-flash',
    personaReimu: DEFAULT_REIMU_PERSONA,
    personaMarisa: DEFAULT_MARISA_PERSONA,
    autoPersonaReimu: DEFAULT_REIMU_PERSONA,
    autoPersonaMarisa: DEFAULT_MARISA_PERSONA,
    canonReimu: DEFAULT_CANON_REIMU,
    canonMarisa: DEFAULT_CANON_MARISA,
    canonWorld: DEFAULT_CANON_WORLD,
    canonPair: DEFAULT_CANON_PAIR,
    canonAiNotes: DEFAULT_CANON_NOTES,
    canonEnabled: true,
    canonSmart: true,
    aiEnabled: true,
    autoChatEnabled: false,
    topicRoundSec: 180,
    switchVotes: 3,
    maxCandidates: 12,
    proposalCooldownSec: 30,
    summarizeAfter: 20,
    summaryKeepRecent: 6,
    autoBatchSize: 24,
    rateLimitPerMin: 20,
    sleepStartHour: 1,
    sleepEndHour: 7
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return normalizeConfig(applyEnvOverrides(Object.assign(defaults, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')))));
    }
    const fresh = applyEnvOverrides(defaults);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(fresh, null, 2), 'utf8');
    console.log('已生成 config.json（含管理员口令与 API Key，请勿公开或提交到仓库）');
    return normalizeConfig(fresh);
  } catch (err) {
    console.error('读取配置失败：', err.message);
    return normalizeConfig(applyEnvOverrides(defaults));
  }
}

const config = loadConfig();

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (_) {}
}

// 直接修改 config.json 后自动热加载（无需重启）
let reloadTimer = null;
function reloadConfigFromDisk() {
  // 防抖：等待文件写入稳定后再应用，避免读到写入中间状态
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(applyConfigFromDisk, 600);
}

function applyConfigFromDisk() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return;
    const disk = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const wasAuto = config.autoChatEnabled;
    const diskDefaults = {
      adminToken: config.adminToken,
      deepseekApiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || config.deepseekApiKey,
      baseUrl: 'https://opencode.ai/zen/go/v1',
      model: 'deepseek-v4-flash',
      personaReimu: DEFAULT_REIMU_PERSONA,
      personaMarisa: DEFAULT_MARISA_PERSONA,
      autoPersonaReimu: DEFAULT_REIMU_PERSONA,
      autoPersonaMarisa: DEFAULT_MARISA_PERSONA,
      canonReimu: DEFAULT_CANON_REIMU,
      canonMarisa: DEFAULT_CANON_MARISA,
      canonWorld: DEFAULT_CANON_WORLD,
      canonPair: DEFAULT_CANON_PAIR,
      canonAiNotes: DEFAULT_CANON_NOTES,
      canonEnabled: true,
      canonSmart: true,
      aiEnabled: true,
      autoChatEnabled: false,
      topicRoundSec: 180,
      switchVotes: 3,
      maxCandidates: 12,
      proposalCooldownSec: 30,
      summarizeAfter: 20,
      summaryKeepRecent: 6,
      autoBatchSize: 24,
      rateLimitPerMin: 20,
      sleepStartHour: 1,
      sleepEndHour: 7
    };
    normalizeConfig(applyEnvOverrides(Object.assign(config, diskDefaults, disk)));
    if (config.autoChatEnabled && !wasAuto) startAutoChat();
    if (!config.autoChatEnabled && wasAuto) stopAutoChat();
    console.log('已重新读取 config.json，配置变更已生效');
  } catch (err) {
    console.error('重新读取 config.json 失败：', err.message);
  }
}

fs.watchFile(CONFIG_FILE, { interval: 1000 }, reloadConfigFromDisk);

// ---------- 运行时状态 ----------
const state = {
  chatLog: [],
  candidates: [],
  lastProposal: new Map(),
  currentTopic: null,
  topicStartTs: 0,
  aiHistory: [],
  autoSummary: null,
  summaryHistory: [],
  currentSummary: null,
  consecutiveErrors: 0,
  autoTimer: null,
  autoQueue: [],
  sleeping: false,
  topicTransition: false,
  nextId: 1
};

const demoEngine = demo.createEngine();

function newSummaryId() {
  return crypto.randomBytes(6).toString('hex');
}

function loadSummaryHistory() {
  try {
    if (fs.existsSync(SUMMARY_FILE)) {
      const arr = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8'));
      if (Array.isArray(arr)) {
        state.summaryHistory = arr
          .filter((x) => x && typeof x.content === 'string' && x.content.trim())
          .slice(0, 50);
      }
    }
  } catch (err) {
    console.error('读取总结历史失败：', err.message);
  }
}

function saveSummaryHistory() {
  try {
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(state.summaryHistory, null, 2), 'utf8');
  } catch (err) {
    console.error('保存总结历史失败：', err.message);
  }
}
loadSummaryHistory();

function pushLog(type, text) {
  const entry = { id: state.nextId++, type, text, ts: Date.now() };
  state.chatLog.push(entry);
  if (state.chatLog.length > 200) state.chatLog.shift();
  return entry;
}

function lastSpeaker() {
  for (let i = state.chatLog.length - 1; i >= 0; i--) {
    const e = state.chatLog[i];
    if (e.type === 'reimu' || e.type === 'marisa') return e.type;
  }
  return null;
}

// 中国（Asia/Shanghai）无夏令时，固定 UTC+8，按北京时间取小时
function beijingHour(d = new Date()) {
  return (d.getUTCHours() + 8) % 24;
}

function timePeriodLabel(d = new Date()) {
  const h = beijingHour(d);
  if (h >= 5 && h < 8) return '清晨';
  if (h >= 8 && h < 11) return '上午';
  if (h >= 11 && h < 14) return '中午';
  if (h >= 14 && h < 17) return '下午';
  if (h >= 17 && h < 20) return '傍晚';
  if (h >= 20 && h < 23) return '晚上';
  return '深夜';
}

function isSleepingTime(d = new Date()) {
  const start = Number(config.sleepStartHour);
  const end = Number(config.sleepEndHour);
  const h = beijingHour(d);
  if (Number.isNaN(start) || Number.isNaN(end) || start === end) return false;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}

// ---------- 话题 ----------
function pickRandomTopic() {
  const pool = demo.TOPIC_POOL.filter((t) => t !== state.currentTopic);
  if (!pool.length) return demo.TOPIC_POOL[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function pickRelatedTopic() {
  if (!aiUsable()) return pickRandomTopic();
  const recent = state.aiHistory
    .slice(-8)
    .map((m) => `${speakerName(m.speaker)}：${m.text}`)
    .join('\n');
  const prompt = [
    { role: 'system', content: '你是东方Project同人对话的编剧。请根据两人最近的对话，给出一个 3~12 字的新话题：它要从刚才聊的内容里自然长出来（比如由某样东西、某个词、某句心情延伸），不要凭空跳走，要适合甜甜的主角组日常；只输出话题本身，不要加引号、标点或解释。' },
    { role: 'user', content: `最近对话：\n${recent || '（无）'}` }
  ];
  try {
    const raw = await callAI(config.deepseekApiKey, config.baseUrl, config.model, prompt, 0.85, 300);
    let topic = cleanDialogueLine(raw).replace(/[。！？，、；：\s]/g, '');
    topic = topic.replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '').trim();
    if (topic.length >= 2 && topic.length <= 16 && topic !== state.currentTopic) return topic;
  } catch (err) {
    console.error('生成相关话题失败：', err.message);
  }
  return pickRandomTopic();
}

async function rotateTopic() {
  let next = null;
  if (state.candidates.length) {
    const sorted = [...state.candidates].sort((a, b) => b.votes.size - a.votes.size);
    if (sorted[0].votes.size > 0) next = sorted[0].text;
  }
  if (!next && Math.random() < 0.4) next = await pickRelatedTopic();
  if (!next) return false;
  state.currentTopic = next;
  state.topicStartTs = Date.now();
  state.candidates = [];
  state.aiHistory = state.aiHistory.slice(-4);
  state.autoSummary = null;
  state.autoQueue = [];
  state.topicTransition = true;
  demoEngine.reset();
  pushLog('system', `（聊着聊着，两人自然地说起了「${next}」）`);
  return true;
}

// ---------- AI ----------

function speakerName(speaker) {
  if (speaker === 'marisa') return '魔理沙';
  if (speaker === 'user') return '旁白';
  return '灵梦';
}

const CANON_WORLD_KEYWORDS = [
  '红魔馆', '守矢神社', '雾之湖', '妖怪之山', '人间之里', '博丽神社',
  '魔法森林', '香霖堂', '迷途竹林', '永远亭', '月都', '天界', '地狱',
  '异变', '结界', '符卡', '宴会', '例大祭', '赛钱', '退治', '幻想乡'
];

function canonNeedsWorld(text) {
  const hay = String(text || '').toLowerCase();
  return CANON_WORLD_KEYWORDS.some((kw) => hay.includes(kw.toLowerCase()));
}

function canonTextFor({ character, topic, history, custom }) {
  if (custom) return String(custom || '').trim();
  if (config.canonEnabled === false) return '';
  const parts = [];
  const reimu = config.canonReimu;
  const marisa = config.canonMarisa;
  const speakerFirst = character === 'marisa';
  if (speakerFirst) {
    if (marisa) parts.push(`【魔理沙·一设】\n${marisa}`);
    if (reimu) parts.push(`【灵梦·一设】\n${reimu}`);
  } else {
    if (reimu) parts.push(`【灵梦·一设】\n${reimu}`);
    if (marisa) parts.push(`【魔理沙·一设】\n${marisa}`);
  }
  if (config.canonPair) parts.push(`【两人关系】\n${config.canonPair}`);
  if (config.canonAiNotes) parts.push(`【易错提醒】\n${config.canonAiNotes}`);
  const smart = config.canonSmart !== false;
  const contextText = `${topic || ''}\n${(history || []).map((m) => m && m.text).filter(Boolean).join('\n')}`;
  if (config.canonWorld && (!smart || canonNeedsWorld(contextText))) {
    parts.push(`【世界观】\n${config.canonWorld}`);
  }
  return parts.join('\n\n');
}



function buildMessages({ character, topic, history = [], persona, summary, canon }) {
  const isMarisa = character === 'marisa';
  const personaText = persona || (isMarisa ? config.autoPersonaMarisa : config.autoPersonaReimu);
  const selfName = isMarisa ? '魔理沙' : '灵梦';
  const messages = [
    { role: 'system', content: personaText },
  ];
  if (canon) {
    messages.push({
      role: 'system',
      content:
        `【一设参考资料】以下是东方Project官方设定的整理（一设），请作为事实依据融入角色与对话，不要与之冲突；不要把设定当话题直接讨论或解释：\n${canon}`
    });
  }
  if (summary) {
    messages.push({ role: 'system', content: `之前的对话总结：${summary}\n请在这个基础上自然地继续。` });
  }
  messages.push({
    role: 'system',
    content:
      `当前场景：你正在幻想乡和对方闲聊。话题背景：${topic || '随便聊聊'}\n` +
      `对话规则：顺着对方的上一句话自然地接下去，接住对方提到的具体细节，有来有回，可以吐槽、跑题或斗嘴，但必须保持角色性格；每次只说1~3句话；不要重复上文中已经说过的话，也不要复述对方的原句；口语自然，别像念稿；可以自然地写出甜甜的小剧情和心动细节（吃醋、照顾、靠近、小暧昧、口是心非），让对话更有糖分；不要提剧本、不要解释、不要跳出角色。\n` +
      `注意：对话中出现的「旁白」是场景描述或剧情事件，请自然地回应它，不要评价旁白本身。`
  });
  for (const item of history) {
    messages.push({ role: 'user', content: `${speakerName(item.speaker)}：「${String(item.text).trim()}」` });
  }
  messages.push({
    role: 'user',
    content: `现在轮到你（${selfName}）说话了，请以角色身份直接说出下一句台词，开头不要重复你的名字，不要加引号。`
  });
  return messages;
}

function cleanReply(text) {
  return String(text || '')
    .trim()
    .replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDialogueLine(text) {
  let s = cleanReply(text);
  s = s.replace(/^(?:灵梦|魔理沙|旁白)\s*[:：]\s*/, '');
  s = s.replace(/^[-*•·]\s*/, '');
  s = s.replace(/^\d+[.、．]\s*/, '');
  return s.trim();
}

function normalizeForCompare(text) {
  return String(text || '').replace(/\s+/g, '').toLowerCase();
}

function dedupeLines(lines, recentTexts) {
  const seen = new Set((recentTexts || []).map(normalizeForCompare));
  const out = [];
  for (const line of lines) {
    const key = normalizeForCompare(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.length ? out : lines.slice(0);
}

async function callAI(apiKey, baseUrl, model, messages, temperature, maxTokens = 300, jsonObject = false) {
  const url = String(baseUrl || config.baseUrl).replace(/\/+$/, '') + '/chat/completions';
  const payload = {
    model: model || config.model,
    messages,
    temperature: typeof temperature === 'number' ? temperature : 0.95,
    max_tokens: maxTokens
  };
  if (jsonObject) payload.response_format = { type: 'json_object' };
  // 对空内容、网络抖动、限流（429）与 5xx 做最多 3 次重试，缓解接口偶发波动
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await sleep(500 * attempt);
      console.warn('AI 调用重试 ' + (attempt + 1) + '/4：' + (lastErr && lastErr.message));
    }
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        let detail = '';
        try {
          detail = (await resp.text()).slice(0, 300);
        } catch (_) {}
        const status = resp.status;
        if (status === 429 || status >= 500) {
          lastErr = new Error('AI 接口返回 ' + status + '：' + (detail || '未知错误'));
          continue;
        }
        throw new Error('AI 接口返回 ' + status + '：' + (detail || '未知错误'));
      }
      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content ?? '';
      if (reply.trim()) return cleanReply(reply);
      lastErr = new Error('AI 返回了空内容，请重试');
    } catch (err) {
      const msg = String((err && err.message) || '');
      if (/fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(msg)) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('AI 调用失败');
}
let jsonModeUnsupported = false;
async function callBatchAI(apiKey, baseUrl, model, messages, temperature, maxTokens) {
  if (!jsonModeUnsupported) {
    try {
      return await callAI(apiKey, baseUrl, model, messages, temperature, maxTokens, true);
    } catch (err) {
      const msg = String((err && err.message) || '');
      if (/response_format|json_object|json mode/i.test(msg)) {
        jsonModeUnsupported = true;
        console.warn('当前接口不支持 JSON 结构化输出，已退回普通模式');
      } else {
        throw err;
      }
    }
  }
  return callAI(apiKey, baseUrl, model, messages, temperature, maxTokens, false);
}

// 统一解析“用哪个 Key / 用哪个接口地址”。
// 关键安全约束：如果请求指定了自定义 baseUrl，但没带自己的 apiKey，
// 绝不能用服务器的内置 Key 去请求第三方地址（否则等于把内置 Key 外发）。
function resolveAiEndpoint({ apiKey, baseUrl, missingKeyMsg }) {
  const effectiveBase = String(baseUrl || config.baseUrl || '').replace(/\/+$/, '');
  const serverBase = String(config.baseUrl || '').replace(/\/+$/, '');
  const key = apiKey || (config.aiEnabled ? config.deepseekApiKey : '');
  if (!key) {
    return { error: missingKeyMsg || '还没有配置 AI Key。' };
  }
  if (!apiKey && effectiveBase !== serverBase) {
    return { error: '使用自定义接口地址时，请同时填写你自己的 API Key；服务器内置 Key 不会发送到第三方地址。' };
  }
  return { key, baseUrl: effectiveBase };
}

async function selfCheckReply({ persona, topic, history, reply, check, canon }) {
  const context = (history || [])
    .slice(-8)
    .map((m) => `${speakerName(m.speaker)}：「${m.text}」`)
    .join('\n');
  const prompt = [
    { role: 'system', content: SELFCHECK_SYSTEM },
    {
      role: 'user',
      content:
        `角色人设：\n${persona}\n\n` +
        `一设参考资料（官方设定）：\n${canon || '（无）'}\n\n` +
        `话题：${topic || '随便聊聊'}\n\n` +
        `对话上下文：\n${context || '（无）'}\n\n` +
        `待检查台词：\n${reply}`
    }
  ];
  const result = await callAI(check.apiKey, check.baseUrl, check.model, prompt, 0.3);
  const cleaned = cleanReply(result);
  const compact = cleaned.replace(/[【】\[\]「」""''\s]/g, '');
  if (/^(通过|没问题|无需修改|ok|okay)$/i.test(compact)) return reply;
  return cleaned || reply;
}

function aiUsable() {
  return config.aiEnabled && !!config.deepseekApiKey;
}

async function generateAutoMessage(speaker) {
  const messages = buildMessages({
    character: speaker,
    topic: state.currentTopic || '随便聊聊',
    history: state.aiHistory.slice(-20),
    persona: speaker === 'marisa' ? config.autoPersonaMarisa : config.autoPersonaReimu,
    summary: state.autoSummary || undefined,
    canon: canonTextFor({
      character: speaker,
      topic: state.currentTopic || '',
      history: state.aiHistory.slice(-12)
    })
  });
  return callAI(config.deepseekApiKey, config.baseUrl, config.model, messages, 0.95);
}

function parseBatchReply(raw, count) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  const toLines = (arr) =>
    arr
      .map((x) => cleanReply(typeof x === 'string' ? x : (x && (x.text || x.content)) || ''))
      .filter(Boolean);

  const tryExtract = (s) => {
    try {
      const v = JSON.parse(s);
      if (Array.isArray(v)) return v;
      if (v && Array.isArray(v.lines)) return v.lines;
      if (v && Array.isArray(v.replies)) return v.replies;
      return null;
    } catch (_) {
      return null;
    }
  };

  // 兼容全角逗号当分隔符、以及 {"lines":[...]} 这类对象包装
  const normalized = text.replace(/"，/g, '",');
  let arr = tryExtract(normalized);
  if (!arr) {
    const start = normalized.indexOf('[');
    const end = normalized.lastIndexOf(']');
    if (start !== -1) {
      arr = tryExtract(end > start ? normalized.slice(start, end + 1) : normalized.slice(start));
    }
  }

  let lines = arr ? toLines(arr) : [];

  // 兜底：截断或仍不合法时，抓取所有成对引号包裹的台词
  if (!lines.length) {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    const region = start !== -1
      ? (end > start ? text.slice(start + 1, end) : text.slice(start + 1))
      : text;
    const matches = [
      ...region.matchAll(/"((?:[^"\\]|\\.)*)"/g),
      ...region.matchAll(/'((?:[^'\\]|\\.)*)'/g),
      ...region.matchAll(/“([^“”]*)”/g),
      ...region.matchAll(/「([^「」]*)」/g)
    ];
    if (matches.length) {
      lines = matches.map((m) => cleanDialogueLine(m[1])).filter(Boolean);
    }
  }

  if (!lines.length) {
    lines = text
      .split(/\n+/)
      .map(cleanDialogueLine)
      .filter(Boolean);
  }

  // 最后手段：只剩一条且还带数组外壳时，去掉外壳后按标点拆开
  if (lines.length === 1 && /[\[【]/.test(lines[0])) {
    const inner = lines[0].replace(/^[\[【]+/, '').replace(/[\]】]+$/, '');
    lines = inner
      .split(/\s*[,，;；]\s*/)
      .map(cleanDialogueLine)
      .filter(Boolean);
  }

  return lines.slice(0, count);
}

async function generateAutoBatch() {
  const count = Math.min(24, Math.max(2, Number(config.autoBatchSize) || 24));
  const startSpeaker = lastSpeaker() === 'marisa' ? 'reimu' : 'marisa';
  const canon = canonTextFor({
    character: startSpeaker,
    topic: state.currentTopic || '',
    history: state.aiHistory.slice(-12)
  });
  const messages = [
    { role: 'system', content: '你是幻想乡同人对话的编剧。下面会提供两位主角的人设、一设资料和当前话题，请以她们的身份编写接下来连续的多句对话台词。' },
    { role: 'system', content: `【博丽灵梦·人设】\n${config.autoPersonaReimu}` },
    { role: 'system', content: `【雾雨魔理沙·人设】\n${config.autoPersonaMarisa}` },
    { role: 'system', content: ALIVE_DIALOGUE_RULES }
  ];
  if (canon) messages.push({ role: 'system', content: `【一设参考】\n${canon}` });
  if (state.autoSummary) messages.push({ role: 'system', content: `之前对话总结：${state.autoSummary}` });
  messages.push({ role: 'system', content: `当前话题：${state.currentTopic || '随便聊聊'}` });
  messages.push({ role: 'system', content: `现在是幻想乡的${timePeriodLabel()}（按真实世界时间）。你可以自然地呼应天色、作息与心情，但不要报出具体钟点和现实日期。` });
  if (state.topicTransition) {
    messages.push({ role: 'system', content: `刚才的话题已经聊得差不多了。请让两人顺着最近一句话里的某个细节（提到的物件、天气、吃食、心情等），像日常聊天一样自然地把话头带到「${state.currentTopic}」上；可以由某样东西联想过去，也可以由其中一人顺口提起，过渡句要和前文接得上，不要出现“换话题”“话题切换”这类场外说明。` });
    state.topicTransition = false;
  }
  for (const m of state.aiHistory.slice(-10)) {
    messages.push({ role: 'user', content: `${speakerName(m.speaker)}：${m.text}` });
  }
  messages.push({
    role: 'user',
    content: `请以 JSON 对象格式输出，格式必须严格为 {"lines":["台词一","台词二","台词三","台词四"]}，其中 lines 必须恰好包含 ${count} 个字符串，一条都不能少（宁可每句短一点，也要把 ${count} 条写满；每句 1~3 句中文，口语自然，符合角色性格），第一句由${speakerName(startSpeaker)}说，之后两人严格交替。每句都要有新内容，接住对方上一句的具体细节，不要重复上文中已经说过的话；要有甜甜的小剧情和心动细节，让情绪有来有回，不要公式化一问一答。只输出这个 JSON 对象，不要角色名前缀、不要任何解释。`
  });
  const raw = await callBatchAI(config.deepseekApiKey, config.baseUrl, config.model, messages, 0.85, Math.min(8000, Math.max(2000, count * 250)));
  let lines = parseBatchReply(raw, count);
  if (!lines.length) throw new Error('批量生成返回空');
  lines = dedupeLines(lines, state.aiHistory.slice(-10).map((m) => m.text));
  let sp = startSpeaker;
  return lines.map((text) => {
    const item = { speaker: sp, text };
    sp = sp === 'marisa' ? 'reimu' : 'marisa';
    return item;
  });
}

async function callSummaryAI(messages) {
  const prompt = [
    { role: 'system', content: SUMMARIZE_SYSTEM },
    { role: 'user', content: messages.map((m) => `${speakerName(m.speaker)}：「${m.text}」`).join('\n') }
  ];
  return callAI(config.deepseekApiKey, config.baseUrl, config.model, prompt, 0.4);
}

async function maybeSummarizeAuto() {
  const after = Number(config.summarizeAfter) || 0;
  const keep = Math.max(1, Number(config.summaryKeepRecent) || 6);
  if (!after || state.aiHistory.length <= after) return;
  const split = state.aiHistory.length - keep;
  const old = state.aiHistory.slice(0, split);
  const recent = state.aiHistory.slice(split);
  let summaryText = '';
  if (aiUsable()) {
    try {
      summaryText = await callSummaryAI(old);
    } catch (err) {
      console.error('自动闲聊总结失败：', err.message);
      return;
    }
  } else {
    summaryText = `前面聊了${old.length}条关于「${state.currentTopic || '幻想乡'}」的内容`;
  }
  state.autoSummary = summaryText;
  state.aiHistory = recent;
  pushLog('system', `（自动总结：${summaryText}）`);
  const entry = {
    id: newSummaryId(),
    topic: state.currentTopic || '自动闲聊',
    content: summaryText,
    createdAt: Date.now()
  };
  state.summaryHistory.unshift(entry);
  if (state.summaryHistory.length > 50) state.summaryHistory.pop();
  state.currentSummary = entry;
  saveSummaryHistory();
}

// ---------- 自动闲聊 ----------
function startAutoChat() {
  if (state.autoTimer) return;
  if (!state.currentTopic) {
    state.currentTopic = pickRandomTopic();
    state.topicStartTs = Date.now();
  }
  const last = state.chatLog[state.chatLog.length - 1];
  if (!last || last.type === 'system') {
    pushLog('system', `（自动闲聊开始，话题：${state.currentTopic}）`);
  }
  const loop = async () => {
    if (!config.autoChatEnabled) {
      state.autoTimer = null;
      return;
    }
    await autoChatTick();
    if (config.autoChatEnabled) {
      state.autoTimer = setTimeout(loop, AUTO_INTERVAL_MS + Math.random() * AUTO_INTERVAL_JITTER_MS);
    } else {
      state.autoTimer = null;
    }
  };
  state.autoTimer = setTimeout(loop, 1200);
}

function stopAutoChat() {
  if (state.autoTimer) {
    clearTimeout(state.autoTimer);
    state.autoTimer = null;
  }
  pushLog('system', '（自动闲聊已暂停）');
}

async function autoChatTick() {
  if (!config.autoChatEnabled) return;

  if (isSleepingTime()) {
    if (!state.sleeping) {
      state.sleeping = true;
      state.autoQueue = [];
      pushLog('system', '（夜深了，两人各自歇下，明早再继续～）');
    }
    return;
  }
  if (state.sleeping) {
    state.sleeping = false;
    pushLog('system', '（新的一天，神社的日常又继续了）');
  }

  await maybeSummarizeAuto();

  if (Date.now() - state.topicStartTs >= config.topicRoundSec * 1000) {
    await rotateTopic();
  }
  const winner = state.candidates.find((c) => c.votes.size >= config.switchVotes);
  if (winner) await rotateTopic();

  if (state.consecutiveErrors >= 4) {
    pushLog('system', '（内置 AI 暂时打盹了，休息一会儿再继续…）');
    state.consecutiveErrors = 0;
    await sleep(15000);
    return;
  }

  if (!aiUsable()) {
    const speaker = lastSpeaker() === 'marisa' ? 'reimu' : 'marisa';
    const text = demoEngine.reply(speaker, state.currentTopic || '', lastSpeaker());
    await sleep(600 + Math.random() * 900);
    pushLog(speaker, text);
    state.aiHistory.push({ speaker, text });
    if (state.aiHistory.length > 30) state.aiHistory.shift();
    return;
  }

  if (!state.autoQueue.length) {
    try {
      state.autoQueue = await generateAutoBatch();
      state.consecutiveErrors = 0;
    } catch (err) {
      state.consecutiveErrors++;
      console.error('自动闲聊批量生成失败：', err.message);
      return;
    }
  }
  const item = state.autoQueue.shift();
  if (!item || !item.text) return;
  const speaker = item.speaker;
  const text = item.text;
  pushLog(speaker, text);
  state.aiHistory.push({ speaker, text });
  if (state.aiHistory.length > 30) state.aiHistory.shift();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- HTTP ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error('请求不是合法的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(req, res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }, baseHeaders(req)));
  res.end(body);
}

// ---------- 公开部署加固：CORS 与按访问者限流 ----------
function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (fwd) return fwd;
  return req.socket.remoteAddress || 'unknown';
}

const rateBuckets = new Map();
function rateLimit(req, pathname) {
  const perMin = Number(config.rateLimitPerMin) || 0;
  if (perMin <= 0) return null;
  if (pathname !== '/api/chat' && pathname !== '/api/chat/batch' && pathname !== '/api/summarize' && pathname !== '/api/models') return null;
  const ip = clientIp(req);
  const now = Date.now();
  const win = rateBuckets.get(ip) || { start: now, count: 0 };
  if (now - win.start >= 60000) {
    win.start = now;
    win.count = 0;
  }
  win.count++;
  rateBuckets.set(ip, win);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (now - v.start >= 60000) rateBuckets.delete(k);
    }
  }
  if (win.count > perMin) {
    return { status: 429, error: `请求太频繁了，请 ${Math.ceil((win.start + 60000 - now) / 1000)} 秒后再试` };
  }
  return null;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) {
    if (now - v.start >= 60000) rateBuckets.delete(k);
  }
}, 60000);

function baseHeaders(req) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin'
  };
  const origin = String(req.headers.origin || '');
  if (origin && /^https?:\/\//.test(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return headers;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function candidatesView(voterId) {
  return state.candidates.map((c) => ({
    id: c.id,
    text: c.text,
    votes: c.votes.size,
    votedByMe: c.votes.has(voterId || '')
  }));
}

async function handleChat(req, res, body) {
  const {
    character,
    topic,
    history,
    apiKey,
    baseUrl,
    model,
    temperature,
    persona,
    summary,
    checkEnabled,
    checkApiKey,
    checkBaseUrl,
    checkModel,
    canon,
    canonMode
  } = body;
  if (character !== 'reimu' && character !== 'marisa') {
    return sendJSON(req, res, 400, { error: '缺少发言人（character）参数' });
  }
  const resolved = resolveAiEndpoint({
    apiKey,
    baseUrl,
    missingKeyMsg: config.aiEnabled
      ? '还没有配置 AI Key：请在设置里填入自己的 API Key，或在 config.json 里配置 DeepSeek Key。'
      : '内置 AI 已被管理员关闭，当前只能使用演示台词。'
  });
  if (resolved.error) return sendJSON(req, res, 400, { error: resolved.error });
  try {
    const personaText = persona || (character === 'marisa' ? config.personaMarisa : config.personaReimu);
    const canonText = canonTextFor({
      character,
      topic,
      history,
      custom: canonMode === 'custom' ? canon : ''
    });
    const messages = buildMessages({
      character,
      topic,
      history,
      persona: personaText,
      summary: summary || undefined,
      canon: canonText
    });
    let reply = await callAI(resolved.key, resolved.baseUrl, model || config.model, messages, temperature);
    if (checkEnabled && checkApiKey) {
      try {
        reply = await selfCheckReply({
          persona: personaText,
          topic,
          history,
          reply,
          check: { apiKey: checkApiKey, baseUrl: checkBaseUrl, model: checkModel },
          canon: canonText
        });
      } catch (err) {
        console.error('自查失败，保留原台词：', err.message);
      }
    }
    sendJSON(req, res, 200, { reply });
  } catch (err) {
    sendJSON(req, res, 502, { error: `调用 AI 失败：${err.message}` });
  }
}

async function handleChatBatch(req, res, body) {
  const {
    character,
    topic,
    history,
    apiKey,
    baseUrl,
    model,
    temperature,
    personas,
    summary,
    checkEnabled,
    checkApiKey,
    checkBaseUrl,
    checkModel,
    canon,
    canonMode,
    turns
  } = body;
  if (character !== 'reimu' && character !== 'marisa') {
    return sendJSON(req, res, 400, { error: '缺少发言人（character）参数' });
  }
  const resolved = resolveAiEndpoint({
    apiKey,
    baseUrl,
    missingKeyMsg: config.aiEnabled
      ? '还没有配置 AI Key：请在设置里填入自己的 API Key，或在 config.json 里配置 DeepSeek Key。'
      : '内置 AI 已被管理员关闭，当前只能使用演示台词。'
  });
  if (resolved.error) return sendJSON(req, res, 400, { error: resolved.error });
  const count = Math.min(24, Math.max(2, Number(turns) || 4));
  // 批量输出要求句数精确，温度上限 0.85（太高容易漏句），创造性由单轮对谈承担
  const pReimu = (personas && personas.reimu) || config.personaReimu;
  const pMarisa = (personas && personas.marisa) || config.personaMarisa;
  const canonText = canonTextFor({
    character,
    topic,
    history,
    custom: canonMode === 'custom' ? canon : ''
  });
  try {
    const messages = [
      { role: 'system', content: '你是幻想乡同人对话的编剧。下面会提供两位主角的人设、一设资料和当前话题，请以她们的身份编写接下来连续的多句对话台词。' },
      { role: 'system', content: `【博丽灵梦·人设】\n${pReimu}` },
      { role: 'system', content: `【雾雨魔理沙·人设】\n${pMarisa}` },
      { role: 'system', content: ALIVE_DIALOGUE_RULES }
    ];
    if (canonText) messages.push({ role: 'system', content: `【一设参考】\n${canonText}` });
    if (summary) messages.push({ role: 'system', content: `之前对话总结：${summary}` });
    messages.push({ role: 'system', content: `当前话题：${topic || '随便聊聊'}` });
    for (const m of (history || []).slice(-10)) {
      messages.push({ role: 'user', content: `${speakerName(m.speaker)}：${m.text}` });
    }
    messages.push({
      role: 'user',
      content: `请以 JSON 对象格式输出，格式必须严格为 {"lines":["台词一","台词二","台词三","台词四"]}，其中 lines 必须恰好包含 ${count} 个字符串，一条都不能少（宁可每句短一点，也要把 ${count} 条写满；每句 1~3 句中文，口语自然，符合角色性格），第一句由${speakerName(character)}说，之后两人严格交替。每句都要有新内容，接住对方上一句的具体细节，不要重复上文中已经说过的话；要有甜甜的小剧情和心动细节，让情绪有来有回，不要公式化一问一答。只输出这个 JSON 对象，不要角色名前缀、不要任何解释。`
    });
    const raw = await callBatchAI(resolved.key, resolved.baseUrl, model || config.model, messages, Math.min(Number(temperature) || 0.95, 0.85), Math.min(6000, Math.max(1600, count * 200)));
    let lines = parseBatchReply(raw, count);
    if (!lines.length) throw new Error('批量生成返回空');
    lines = dedupeLines(lines, (history || []).slice(-10).map((m) => m.text));
    let sp = character;
    const replies = lines.map((text) => {
      const item = { speaker: sp, text };
      sp = sp === 'marisa' ? 'reimu' : 'marisa';
      return item;
    });
    if (checkEnabled && checkApiKey) {
      for (const r of replies) {
        try {
          r.text = await selfCheckReply({
            persona: r.speaker === 'marisa' ? pMarisa : pReimu,
            topic,
            history,
            reply: r.text,
            check: { apiKey: checkApiKey, baseUrl: checkBaseUrl, model: checkModel },
            canon: canonText
          });
        } catch (_) {}
      }
    }
    sendJSON(req, res, 200, { replies });
  } catch (err) {
    sendJSON(req, res, 502, { error: `调用 AI 失败：${err.message}` });
  }
}
async function handleSummarize(req, res, body) {
  const { messages, topic, apiKey, baseUrl, model, summaryApiKey, summaryBaseUrl, summaryModel } = body;
  const list = Array.isArray(messages) ? messages.filter((m) => m && m.text) : [];
  if (!list.length) {
    return sendJSON(req, res, 400, { error: '没有可总结的对话内容' });
  }
  const resolved = resolveAiEndpoint({
    apiKey: summaryApiKey || apiKey,
    baseUrl: summaryBaseUrl || baseUrl,
    missingKeyMsg: config.aiEnabled
      ? '还没有可用的 API Key：请在设置里填自己的 Key，或确认 config.json 已配置 DeepSeek Key。'
      : '内置 AI 已被管理员关闭，无法自动总结。'
  });
  if (resolved.error) return sendJSON(req, res, 400, { error: resolved.error });
  try {
    const prompt = [
      { role: 'system', content: SUMMARIZE_SYSTEM },
      {
        role: 'user',
        content: `话题：${topic || '随便聊聊'}\n` + list.map((m) => `${speakerName(m.speaker)}：「${m.text}」`).join('\n')
      }
    ];
    const summary = await callAI(
      resolved.key,
      resolved.baseUrl,
      summaryModel || model || config.model,
      prompt,
      0.4
    );
    sendJSON(req, res, 200, { summary });
  } catch (err) {
    sendJSON(req, res, 502, { error: `自动总结失败：${err.message}` });
  }
}

async function handleModels(req, res, body) {
  const { apiKey, baseUrl } = body;
  const resolved = resolveAiEndpoint({
    apiKey,
    baseUrl,
    missingKeyMsg: config.aiEnabled
      ? '还没有可用的 API Key：请在设置里填自己的 Key，或确认 config.json 已配置 DeepSeek Key。'
      : '内置 AI 已被管理员关闭，无法获取模型列表。'
  });
  if (resolved.error) return sendJSON(req, res, 400, { error: resolved.error });
  try {
    const url = resolved.baseUrl + '/models';
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${resolved.key}` }
    });
    if (!resp.ok) {
      let detail = '';
      try {
        detail = (await resp.text()).slice(0, 200);
      } catch (_) {}
      throw new Error(`接口返回 ${resp.status}：${detail || '未知错误'}`);
    }
    const data = await resp.json();
    const models = [...new Set((data.data || []).map((m) => String(m.id || '')).filter(Boolean))].sort();
    if (!models.length) throw new Error('接口没有返回任何模型');
    sendJSON(req, res, 200, { models });
  } catch (err) {
    sendJSON(req, res, 502, { error: `获取模型列表失败：${err.message}` });
  }
}

function handleState(req, res, voterId) {
  sendJSON(req, res, 200, {
    aiEnabled: config.aiEnabled,
    autoChatEnabled: config.autoChatEnabled,
    hasServerKey: !!config.deepseekApiKey,
    currentTopic: state.currentTopic,
    topicRoundSec: config.topicRoundSec,
    switchVotes: config.switchVotes,
    summarizeAfter: Number(config.summarizeAfter) || 0,
    summaryKeepRecent: Number(config.summaryKeepRecent) || 6,
    canonEnabled: config.canonEnabled !== false,
    canonSmart: config.canonSmart !== false,
    candidates: candidatesView(voterId),
    log: state.chatLog.slice(-60),
    serverTime: Date.now()
  });
}

async function handleTopic(body) {
  const voterId = String(body.voterId || '').trim();
  const text = String(body.text || '').trim();
  if (!voterId || voterId.length > 64) return { status: 400, error: '缺少有效的观众身份' };
  if (!config.autoChatEnabled) return { status: 400, error: '自动闲聊未开启，暂时不能提议话题' };
  if (text.length < 2 || text.length > 40) return { status: 400, error: '话题长度需要在 2~40 字之间' };
  if (text === state.currentTopic) return { status: 400, error: '这个话题已经在聊了' };
  if (state.candidates.some((c) => c.text === text)) return { status: 400, error: '这个候选话题已经有人提过了' };
  if (state.candidates.length >= config.maxCandidates) return { status: 400, error: '候选池已满，稍后再试' };
  const now = Date.now();
  const last = state.lastProposal.get(voterId) || 0;
  if (now - last < config.proposalCooldownSec * 1000) {
    return { status: 429, error: '提议太频繁了，稍等一会儿再试' };
  }
  state.lastProposal.set(voterId, now);
  state.candidates.push({ id: state.nextId++, text, votes: new Set() });
  return { status: 200, candidates: candidatesView(voterId) };
}

function handleVote(body) {
  const voterId = String(body.voterId || '').trim();
  const topicId = Number(body.topicId);
  if (!voterId || voterId.length > 64) return { status: 400, error: '缺少有效的观众身份' };
  const candidate = state.candidates.find((c) => c.id === topicId);
  if (!candidate) return { status: 400, error: '候选话题不存在或已过期' };
  if (candidate.votes.has(voterId)) {
    candidate.votes.delete(voterId);
  } else {
    candidate.votes.add(voterId);
  }
  return { status: 200, candidates: candidatesView(voterId) };
}

async function handleAdmin(body) {
  const token = String(body.token || '');
  if (!safeEqual(token, config.adminToken)) {
    return { status: 403, error: '管理员口令不正确' };
  }
  const { action, enabled } = body;
  if (action === 'ai') {
    config.aiEnabled = !!enabled;
    if (!config.aiEnabled) state.consecutiveErrors = 0;
    saveConfig();
  } else if (action === 'autochat') {
    config.autoChatEnabled = !!enabled;
    if (config.autoChatEnabled) {
      startAutoChat();
    } else {
      stopAutoChat();
    }
    saveConfig();
  } else {
    return { status: 400, error: '未知的操作' };
  }
  return { status: 200, ok: true };
}

function handleAdminVerify(body) {
  const token = String(body.token || '');
  if (!safeEqual(token, config.adminToken)) {
    return { status: 403, error: '管理员口令不正确' };
  }
  return { status: 200, ok: true };
}

function handleManualPersonas() {
  return {
    status: 200,
    base: { reimu: DEFAULT_REIMU_BASE, marisa: DEFAULT_MARISA_BASE },
    rules: { reimu: DEFAULT_REIMU_RULES, marisa: DEFAULT_MARISA_RULES },
    full: { reimu: config.personaReimu, marisa: config.personaMarisa }
  };
}

function handleCanon() {
  return {
    status: 200,
    defaults: {
      reimu: DEFAULT_CANON_REIMU,
      marisa: DEFAULT_CANON_MARISA,
      world: DEFAULT_CANON_WORLD,
      pair: DEFAULT_CANON_PAIR,
      notes: DEFAULT_CANON_NOTES
    },
    server: {
      reimu: config.canonReimu,
      marisa: config.canonMarisa,
      world: config.canonWorld,
      pair: config.canonPair,
      notes: config.canonAiNotes
    },
    enabled: config.canonEnabled !== false,
    smart: config.canonSmart !== false
  };
}

function handleAutoPersonas(body) {
  const token = String(body.token || '');
  const apiKey = String(body.apiKey || '').trim();
  const allowed = safeEqual(token, config.adminToken) || apiKey.length >= 8;
  if (!allowed) {
    return { status: 403, error: '自动闲聊人设仅管理员可改；或填上你自己的 API Key 后也可修改。' };
  }
  if (body.personas) {
    const reimu = String(body.personas.reimu || '').trim();
    const marisa = String(body.personas.marisa || '').trim();
    if (!reimu || !marisa) return { status: 400, error: '人设内容不能为空' };
    if (reimu.length > 3000 || marisa.length > 3000) {
      return { status: 400, error: '人设内容过长（单个最多 3000 字）' };
    }
    config.autoPersonaReimu = reimu;
    config.autoPersonaMarisa = marisa;
    saveConfig();
  }
  return {
    status: 200,
    personas: { reimu: config.autoPersonaReimu, marisa: config.autoPersonaMarisa },
    defaults: { reimu: DEFAULT_REIMU_PERSONA, marisa: DEFAULT_MARISA_PERSONA }
  };
}

function handleGetSummaries() {
  return {
    status: 200,
    current: state.currentSummary || null,
    history: state.summaryHistory
  };
}

function handleUpdateSummary(id, body) {
  const content = String((body && body.content) || '').trim();
  if (!content) return { status: 400, error: '总结内容不能为空' };
  if (content.length > 2000) return { status: 400, error: '总结内容过长（最多 2000 字）' };
  const entry = state.summaryHistory.find((s) => s.id === id);
  if (!entry) return { status: 404, error: '总结不存在' };
  entry.content = content;
  entry.updatedAt = Date.now();
  if (state.currentSummary && state.currentSummary.id === id) {
    state.currentSummary.content = content;
    state.autoSummary = content;
  }
  saveSummaryHistory();
  return { status: 200, ok: true, current: state.currentSummary || null, history: state.summaryHistory };
}

function handleDeleteSummary(id) {
  const idx = state.summaryHistory.findIndex((s) => s.id === id);
  if (idx === -1) return { status: 404, error: '总结不存在' };
  state.summaryHistory.splice(idx, 1);
  if (state.currentSummary && state.currentSummary.id === id) {
    state.currentSummary = null;
    state.autoSummary = null;
  }
  saveSummaryHistory();
  return { status: 200, ok: true, current: state.currentSummary || null, history: state.summaryHistory };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, baseHeaders(req));
      return res.end();
    }

    const limited = rateLimit(req, pathname);
    if (limited) {
      res.writeHead(limited.status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, baseHeaders(req)));
      return res.end(JSON.stringify({ error: limited.error }));
    }

    if (req.method === 'POST' && pathname === '/api/chat/batch') {
      const body = await readBody(req);
      return await handleChatBatch(req, res, body);
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await readBody(req);
      return await handleChat(req, res, body);
    }

    if (req.method === 'POST' && pathname === '/api/summarize') {
      const body = await readBody(req);
      return await handleSummarize(req, res, body);
    }

    if (req.method === 'POST' && pathname === '/api/models') {
      const body = await readBody(req);
      return await handleModels(req, res, body);
    }

    if (req.method === 'POST' && pathname === '/api/topic') {
      const body = await readBody(req);
      const result = await handleTopic(body);
      return sendJSON(req, res, result.status, { error: result.error, candidates: result.candidates });
    }

    if (req.method === 'POST' && pathname === '/api/vote') {
      const body = await readBody(req);
      const result = handleVote(body);
      return sendJSON(req, res, result.status, { error: result.error, candidates: result.candidates });
    }

    if (req.method === 'POST' && pathname === '/api/admin') {
      const body = await readBody(req);
      const result = await handleAdmin(body);
      if (result.ok) return sendJSON(req, res, 200, { ok: true });
      return sendJSON(req, res, result.status, { error: result.error });
    }

    if (req.method === 'POST' && pathname === '/api/admin/verify') {
      const body = await readBody(req);
      const result = handleAdminVerify(body);
      if (result.ok) return sendJSON(req, res, 200, { ok: true });
      return sendJSON(req, res, result.status, { error: result.error });
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      return handleState(req, res, url.searchParams.get('voter'));
    }

    if (req.method === 'GET' && pathname === '/api/personas/manual') {
      const result = handleManualPersonas();
      return sendJSON(req, res, 200, {
        base: result.base,
        rules: result.rules,
        full: result.full
      });
    }

    if (req.method === 'GET' && pathname === '/api/canon') {
      const result = handleCanon();
      return sendJSON(req, res, 200, {
        defaults: result.defaults,
        server: result.server,
        enabled: result.enabled
      });
    }

    if (req.method === 'POST' && pathname === '/api/personas/auto') {
      const body = await readBody(req);
      const result = handleAutoPersonas(body);
      if (result.personas) return sendJSON(req, res, 200, { personas: result.personas, defaults: result.defaults });
      return sendJSON(req, res, result.status, { error: result.error });
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJSON(req, res, 200, {
        ok: true,
        hasServerKey: !!config.deepseekApiKey,
        aiEnabled: config.aiEnabled,
        autoChatEnabled: config.autoChatEnabled
      });
    }

    if (req.method === 'GET' && pathname === '/api/summaries') {
      const result = handleGetSummaries();
      return sendJSON(req, res, 200, { current: result.current, history: result.history });
    }

    const summaryMatch = pathname.match(/^\/api\/summaries\/([\w-]+)$/);
    if (summaryMatch) {
      if (req.method === 'POST') {
        const body = await readBody(req);
        const result = handleUpdateSummary(summaryMatch[1], body);
        if (result.ok) return sendJSON(req, res, 200, { ok: true, current: result.current, history: result.history });
        return sendJSON(req, res, result.status, { error: result.error });
      }
      if (req.method === 'DELETE') {
        const result = handleDeleteSummary(summaryMatch[1]);
        if (result.ok) return sendJSON(req, res, 200, { ok: true, current: result.current, history: result.history });
        return sendJSON(req, res, result.status, { error: result.error });
      }
      return sendJSON(req, res, 405, { error: 'Method Not Allowed' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, baseHeaders(req)));
      return res.end('Method Not Allowed');
    }

    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403, baseHeaders(req));
      return res.end('Forbidden');
    }
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, baseHeaders(req)));
        return res.end('404 Not Found');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream' }, baseHeaders(req)));
      res.end(content);
    });
  } catch (err) {
    return sendJSON(req, res, 400, { error: err.message });
  }
});

function listen(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < PORT + 10) {
      listen(port + 1);
    } else {
      console.error('服务器启动失败：', err.message);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log('红白与黑白 · 茶话会已启动：');
    console.log(`  本机访问： http://localhost:${port}`);
    console.log(`  管理员口令：${config.adminToken}`);
    console.log(`  内置 AI：${config.aiEnabled ? '开' : '关'}（${config.deepseekApiKey ? config.model : '未配置 Key'}）`);
    console.log(`  自动闲聊：${config.autoChatEnabled ? '开' : '关'}`);
    console.log('  提示：config.json 含敏感信息，已加入 .gitignore，请勿公开。');
    if (config.autoChatEnabled) startAutoChat();
  });
}

listen(PORT);
