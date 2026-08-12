(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GensokyoDemo = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCENARIOS = [
    {
      id: '异变调查',
      match: ['异变', '妖怪', '出事', '调查', '敌人', '红魔馆', '异常'],
      lines: [
        ['marisa', '灵梦！不好了ze～！红魔馆那边好像又出事了，天空都变颜色了！'],
        ['reimu', '（端着茶杯头也不抬）哦……又是异变啊。等我把这杯茶喝完再说。'],
        ['marisa', '还喝什么茶！这种时候就该冲出去大闹一场，这才叫主角ze！'],
        ['reimu', '你也知道自己是主角？我还以为你只会冲进别人家里顺东西呢。'],
        ['marisa', '喂！我那叫搜集情报！……总之，这次说不定又有什么稀奇的宝物，你不去我可一个人去了。'],
        ['reimu', '……好吧好吧。等我五分钟，我去拿符纸和御币。你先把我的茶续上。'],
        ['marisa', '没问题ze～！……等等，你家茶壶呢？怎么是空的？'],
        ['reimu', '魔理沙！你是不是又趁我不注意把茶叶顺走了！'],
        ['marisa', '才没有！……好吧，就一点点。就当是委托费嘛，走啦走啦！'],
        ['reimu', '唉……你欠我的纳奉，我记小本本上了。这次异变解决完，你请客。']
      ]
    },
    {
      id: '蘑菇与魔法',
      match: ['蘑菇', '魔法', '研究', '收集', '新魔法', '法术', '星尘', '魔炮'],
      lines: [
        ['marisa', '灵梦灵梦！快看我新研究出来的魔法——「星尘幻想」！超厉害的吧！'],
        ['reimu', '啊……嗯，挺闪的。就是差点把我晾在院子里的衣服点着了。'],
        ['marisa', '诶？衣服？……那个，黑乎乎的一团难道不是新式稻草人吗？'],
        ['reimu', '那是我刚洗好的巫女服！赔钱！'],
        ['marisa', '赔、赔钱没有，不过我这里有刚采的魔法蘑菇，超新鲜，要不要？'],
        ['reimu', '我拿你的蘑菇做什么，煮汤吗？万一吃出幻觉来，谁来看神社。'],
        ['marisa', '放心放心，这种蘑菇吃了只会看到星星，不会看到妖怪的！大概。'],
        ['reimu', '……你的“大概”比异变本身还让人不安。'],
        ['marisa', '嘿嘿，实践出真知嘛。要不要现在就来一发试试？我保证不会炸到神社！'],
        ['reimu', '你给我住手。我的神社经不起你折腾……不过，星星倒是挺好看的。']
      ]
    },
    {
      id: '喝茶与纳奉',
      match: ['纳奉', '香油钱', '钱', '穷', '喝茶', '茶叶', '茶壶', '香火'],
      lines: [
        ['marisa', '哟灵梦，我又来玩了！今天有没有什么好吃的？'],
        ['reimu', '有啊。想喝茶，先纳奉。香油钱箱就在门口，看在你我交情的份上，扔个五百块意思意思。'],
        ['marisa', '诶～？怎么一开口就要钱啊，你不是应该温柔地接待客人吗！'],
        ['reimu', '温柔的巫女早就饿死了。我是靠香客和你的良心过活的。'],
        ['marisa', '那……那个，我带了刚烤好的蘑菇串，用这个抵债行不行？'],
        ['reimu', '……你上次带的那筐蘑菇，我吃了三天三夜的蘑菇宴。能不能换点正常的？'],
        ['marisa', '正常人哪会半夜往神社跑啊！咱们关系都这么铁了，就别计较这些了ze～'],
        ['reimu', '就是因为熟才宰你。……算了，进来吧，茶是今天新泡的，别又顺走我的茶叶罐。'],
        ['marisa', '知道啦知道啦。那、那茶壶借我用一下，我研究个新法术……'],
        ['reimu', '……我刚说别顺东西！你给我放下！']
      ]
    },
    {
      id: '赏花',
      match: ['赏花', '春天', '樱花', '团子', '白玉楼', '散步', '放假'],
      lines: [
        ['marisa', '灵梦！春天到了，我们去看樱花吧！听说白玉楼那边的樱花都开了！'],
        ['reimu', '赏花……听起来是不错。不过神社的香油钱还没有着落，我哪儿有闲情逸致。'],
        ['marisa', '放心，我带了团子和酒！酒是偷——啊不，是借幽幽子大人珍藏的。'],
        ['reimu', '你那个“借”字让我很不安。到时候幽幽子追过来，你负责挡住她。'],
        ['marisa', '没问题，包在我身上！我正好想试试新魔法「星光冲击」的实战效果呢！'],
        ['reimu', '……你这算盘打得比我还响。算了，就当是难得的休假，我关一下神社的门。'],
        ['marisa', '诶，神社还能关门？那香客怎么办？'],
        ['reimu', '香客？今天一整天连个人影都没有。再不开门营业，我就要去你家蹭饭了。'],
        ['marisa', '欢迎欢迎！我家正好囤了一堆蘑菇，管够！'],
        ['reimu', '……我忽然觉得，还是留在神社看门比较安全。']
      ]
    }
  ];

  const REACTIONS = {
    reimu: [
      '（抬头看了看天）唔……刚才好像有阵奇怪的风吹过。',
      '啊……这种时候突然冒出个旁白，总觉得不会有什么好事。',
      '（叹气）连老天都在替魔理沙催我干活了是吧。',
      '（歪了歪头）……嗯，我什么都没听到。'
    ],
    marisa: [
      '诶诶？刚才谁在说话？……算了，反正气氛都到这里了，继续继续ze～',
      '（四处张望）嗯？有旁白？哈哈，那正好，帮本天才记一下伟大实验的经过！',
      '哦哦，剧情展开了！灵梦，准备好大闹一场了吗？',
      '（竖起耳朵）嗯？好像有人在旁边解说？有意思，说下去说下去！'
    ]
  };

  const BANTER = {
    reimu: [
      '唉……和你待在一起，总觉得平静的日子离我越来越远。',
      '话说回来，你也老大不小了，什么时候找个正经工作？',
      '今天的风真不错。要是没你在这吵，就更不错了。'
    ],
    marisa: [
      '灵梦，你说咱们这么闲聊，算不算在偷懒啊？',
      '对了，博丽神社的赛钱箱今天进账多少？要不要我帮你“宣传宣传”？',
      '嘿嘿，跟你聊天果然最开心了ze～！'
    ]
  };

  const TOPIC_POOL = [
    '神社后山的异变又出现了',
    '今天的蘑菇收成怎么样',
    '香油钱箱又空了呢',
    '新魔法的实验成功了吗',
    '白玉楼的樱花开了',
    '红魔馆的茶会邀请函',
    '妖怪山的新鲜事',
    '雾之湖的天气变化',
    '人里的祭典准备',
    '竹林里的迷路经历',
    '守矢神社的传闻',
    '春天适合做什么',
    '关于符卡规则的讨论',
    '谁才是幻想乡最强',
    '今天的晚饭吃什么',
    '灵梦的茶和魔理沙的蘑菇'
  ];

  function createEngine() {
    let scenario = null;
    let index = 0;
    let lastReaction = -1;
    let lastBanter = -1;

    function pickScenario(topic) {
      const t = topic || '';
      for (const s of SCENARIOS) {
        if (s.match.some((kw) => t.includes(kw))) return s;
      }
      return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    }

    return {
      reset() {
        scenario = null;
        index = 0;
      },
      reply(speaker, topic, lastSpeaker) {
        if (lastSpeaker === 'user') {
          const pool = REACTIONS[speaker];
          let idx = Math.floor(Math.random() * pool.length);
          if (idx === lastReaction) idx = (idx + 1) % pool.length;
          lastReaction = idx;
          return pool[idx];
        }
        if (!scenario) {
          scenario = pickScenario(topic);
          index = 0;
        }
        while (index < scenario.lines.length && scenario.lines[index][0] !== speaker) {
          index++;
        }
        if (index < scenario.lines.length) {
          return scenario.lines[index++][1];
        }
        const banter = BANTER[speaker];
        let idx = Math.floor(Math.random() * banter.length);
        if (idx === lastBanter) idx = (idx + 1) % banter.length;
        lastBanter = idx;
        return banter[idx];
      }
    };
  }

  return { createEngine, SCENARIOS, REACTIONS, BANTER, TOPIC_POOL };
});
