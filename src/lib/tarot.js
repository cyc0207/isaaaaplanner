import { addDays } from './date.js';

// 偉特塔羅 78 張：[英文名, 中文名, 正位, 逆位]
const MAJOR = [
  ['The Fool', '愚者', '新的開始、放手去試、保持好奇', '衝動、沒想清楚就跳、逃避責任'],
  ['The Magician', '魔術師', '手上的資源夠用、主動出擊、把想法做出來', '能力沒用在對的地方、拖延、話多做少'],
  ['The High Priestess', '女祭司', '相信直覺、安靜觀察、先別急著表態', '忽略內在聲音、資訊不完整、想太多'],
  ['The Empress', '皇后', '照顧自己、豐盛、創作力旺盛', '過度付出、懶散、忽略自己的需要'],
  ['The Emperor', '皇帝', '建立秩序、定規則、負起責任', '控制太多、僵化、跟權威硬碰硬'],
  ['The Hierophant', '教皇', '照規矩來、向前輩學習、傳統方法', '想打破框架、不想被說教、另闢蹊徑'],
  ['The Lovers', '戀人', '重要的選擇、價值一致、真誠的連結', '猶豫不決、價值衝突、關係失衡'],
  ['The Chariot', '戰車', '意志力、往目標衝、控制方向', '失去方向、分心、硬撐'],
  ['Strength', '力量', '溫柔的堅持、耐心、駕馭情緒', '自我懷疑、沒耐心、壓抑情緒'],
  ['The Hermit', '隱士', '獨處沉澱、向內找答案、慢下來', '孤立自己、鑽牛角尖、逃避人群'],
  ['Wheel of Fortune', '命運之輪', '轉機、順勢而為、週期改變', '時機不對、抗拒改變、運氣低潮'],
  ['Justice', '正義', '公平、理性判斷、為選擇負責', '不公平、逃避後果、判斷失準'],
  ['The Hanged Man', '吊人', '換個角度看、暫停、主動等待', '白白犧牲、卡住、不願放手'],
  ['Death', '死神', '結束與轉化、斷捨離、迎接新階段', '抗拒結束、拖著不放、停滯'],
  ['Temperance', '節制', '平衡、調和、慢慢來剛剛好', '失衡、過度、急躁'],
  ['The Devil', '惡魔', '看見讓你上癮或被綁住的東西', '掙脫束縛、重新拿回主導權'],
  ['The Tower', '高塔', '突然的改變、打破假象、重建的機會', '害怕改變、延後必要的崩解'],
  ['The Star', '星星', '希望、療癒、對未來有信心', '失去信心、灰心、需要重新充電'],
  ['The Moon', '月亮', '不確定、想像、情緒起伏、看不清全貌', '迷霧散去、恐懼減輕、真相浮現'],
  ['The Sun', '太陽', '開心、成功、能量充足、清楚明白', '暫時的低落、過度樂觀、熱情減退'],
  ['Judgement', '審判', '覺醒、反省、回應內心的召喚', '自我批判、錯過機會、不願面對過去'],
  ['The World', '世界', '完成、圓滿、一個階段的成果', '差一點完成、收尾不了、還有缺口'],
];

const SUITS = [
  ['wands', '權杖', '行動、熱情、創造'],
  ['cups', '聖杯', '情感、關係、直覺'],
  ['swords', '寶劍', '思考、溝通、衝突'],
  ['pentacles', '錢幣', '金錢、工作、身體與實際的事'],
];

const RANKS = [
  ['Ace', '王牌'], ['Two', '二'], ['Three', '三'], ['Four', '四'], ['Five', '五'], ['Six', '六'], ['Seven', '七'],
  ['Eight', '八'], ['Nine', '九'], ['Ten', '十'], ['Page', '侍者'], ['Knight', '騎士'], ['Queen', '皇后'], ['King', '國王'],
];

// 每個花色 14 張的 [正位, 逆位]
const MINOR = {
  wands: [
    ['新點子、靈感來了、開始一件事', '點子卡住、動力不足、起步延後'],
    ['規劃未來、做決定、看遠一點', '害怕走出舒適圈、計畫不清'],
    ['擴展、等待成果、眼光放遠', '進度延誤、期望落空'],
    ['慶祝、穩定、小小的里程碑', '不安定、團體裡有摩擦'],
    ['競爭、意見衝突、良性較勁', '避免衝突、內耗'],
    ['被肯定、小勝利、自信', '沒被看見、在意別人評價'],
    ['堅守立場、面對挑戰', '疲憊、想放棄、壓力太大'],
    ['事情進展很快、訊息來了', '節奏被打亂、等待、延遲'],
    ['堅持到底、雖然累但快到了', '筋疲力盡、防衛心太重'],
    ['負擔太重、事情攬太多', '學會放下、分工'],
    ['好奇、想學新東西、熱情的消息', '三分鐘熱度、方向不明'],
    ['衝勁、冒險、說走就走', '急躁、衝過頭、半途而廢'],
    ['自信、有魅力、熱情又獨立', '自我懷疑、嫉妒、脾氣上來'],
    ['有遠見的領導、帶頭做', '專斷、期望太高、不聽人'],
  ],
  cups: [
    ['新的感情、內心滿滿、被感動', '情緒壓抑、心空空的'],
    ['互相吸引、合作、好的連結', '關係失衡、溝通不良'],
    ['朋友、慶祝、一起開心', '過度玩樂、小圈圈'],
    ['無聊、提不起勁、忽略眼前的機會', '重新打起精神、看見新機會'],
    ['失落、只看見失去的', '接受、放下、往前看'],
    ['懷舊、單純的快樂、童年回憶', '活在過去、需要長大'],
    ['選項太多、幻想、看不清楚', '做出選擇、回到現實'],
    ['離開不再滿足你的事、往更深處找', '想走又不敢走、逃避'],
    ['願望實現、滿足', '物質滿足但心裡不夠'],
    ['和樂、家庭、情感圓滿', '期待落差、家裡有摩擦'],
    ['溫柔的訊息、創意、敏感', '情緒化、不成熟'],
    ['浪漫、追隨內心、提出邀請', '不切實際、情緒起伏'],
    ['同理、照顧人、直覺強', '情緒耗竭、界線不清'],
    ['情緒穩定、包容、成熟', '壓抑情緒、情緒勒索'],
  ],
  swords: [
    ['想通了、清楚的判斷、說實話', '思緒混亂、判斷錯誤'],
    ['兩難、暫時不決定', '資訊太多、終於要選'],
    ['心痛、失望、難過的事實', '慢慢復原、放下傷痛'],
    ['休息、暫停、恢復元氣', '休息不夠、焦躁、急著回去'],
    ['爭贏了卻失去更多、衝突', '和解、放下輸贏'],
    ['離開困境、慢慢變好', '還放不下、卡在原地'],
    ['取巧、偷偷來、策略', '被看穿、坦白、良心不安'],
    ['被自己的想法困住、覺得沒選擇', '鬆綁、看見出路'],
    ['焦慮、失眠、想太多', '最糟的已經過去、求助'],
    ['結束、谷底、痛但會過去', '慢慢復原、重新站起來'],
    ['好奇、觀察、想知道真相', '說話不經大腦、八卦'],
    ['直接、行動快、衝向目標', '衝動、說話傷人'],
    ['清楚、獨立、說話直接', '冷漠、太尖銳'],
    ['理性、權威、公正判斷', '濫用權力、太冷酷'],
  ],
  pentacles: [
    ['新的機會、實際的開始、收入', '錯過機會、計畫不實際'],
    ['平衡多件事、調度、彈性', '顧此失彼、太忙亂'],
    ['團隊合作、技術被看見', '合作不順、品質不夠'],
    ['存錢、守住、穩定', '太小氣、抓太緊'],
    ['手頭緊、覺得被冷落', '慢慢好轉、找到幫助'],
    ['給予與接受、互相幫忙', '付出不對等、欠人情'],
    ['耐心等成果、長期投資', '沒耐心、努力看不到成效'],
    ['專心練功、一步一步累積', '敷衍、不想重複練習'],
    ['靠自己、享受成果、自律', '過度工作、花太多'],
    ['長期穩定、家庭、財務安全', '財務問題、家裡的壓力'],
    ['認真學習、新的實際計畫', '拖延、不切實際的目標'],
    ['穩紮穩打、負責、可靠', '太保守、停滯、無聊'],
    ['照顧生活、務實又溫暖', '忽略自己、太操心'],
    ['成就、富足、有能力照顧人', '太重物質、固執'],
  ],
};

export const CARDS = [
  ...MAJOR.map(([en, zh, up, rev], i) => ({ id: `major-${i}`, en, zh, up, rev, arcana: 'major', num: i })),
  ...SUITS.flatMap(([suit, suitZh, theme]) =>
    RANKS.map(([rEn, rZh], i) => ({
      id: `${suit}-${i + 1}`,
      en: `${rEn} of ${suit[0].toUpperCase()}${suit.slice(1)}`,
      zh: `${suitZh}${rZh}`,
      up: MINOR[suit][i][0],
      rev: MINOR[suit][i][1],
      arcana: 'minor',
      suit,
      suitZh,
      theme,
      num: i + 1,
    })),
  ),
];

export const cardById = (id) => CARDS.find((c) => c.id === id) || null;

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
export const cardNumeral = (c) => (c.arcana === 'major' ? ROMAN[c.num] : c.num === 1 ? 'A' : c.num <= 10 ? String(c.num) : ['P', 'N', 'Q', 'K'][c.num - 11]);

export function meaningOf(draw) {
  const c = cardById(draw.cardId);
  return c ? (draw.reversed ? c.rev : c.up) : '';
}

export const POSITIONS = ['過去', '現在', '未來'];

// 三張牌陣：不重複，各自正逆位。rnd 是回傳 [0, 1) 的函式
export function drawSpread(rnd = Math.random) {
  const pool = CARDS.map((c) => c.id);
  return POSITIONS.map(() => {
    const i = Math.floor(rnd() * pool.length) % pool.length;
    const [cardId] = pool.splice(i, 1);
    return { cardId, reversed: rnd() < 0.5 };
  });
}

// 舊紀錄只有一張牌；新紀錄是 cards 陣列
export const spreadOf = (entry) => (!entry ? [] : Array.isArray(entry.cards) ? entry.cards : entry.cardId ? [entry] : []);
export const isFullSpread = (entry) => spreadOf(entry).length === POSITIONS.length;

// 連續抽了幾天：今天還沒抽不算斷
export function tarotStreak(log, day) {
  let d = log[day] ? day : addDays(day, -1);
  let n = 0;
  while (log[d]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// 把「現在」那張牌轉成今天做得到的小行動（10～15 分鐘）。這是反思的提示，不是預測。
const ACTIONS = {
  wands: [(t) => `先動手做「${t}」的第一步，計時 10 分鐘`, (t) => `把「${t}」拆成 3 個小步驟，今天只做第一個`],
  cups: [(t) => `做「${t}」之前，先寫一句現在的心情`, () => '今天主動傳一則訊息關心一個人'],
  swords: [(t) => `把「${t}」卡住的地方寫成 3 點，挑一點先解決`, () => '今天有一件想說的話，用一句話清楚講出來'],
  pentacles: [(t) => `整理「${t}」需要的資料或工具，放在同一個地方`, () => '今天記完每一筆帳，睡前看一次本週花費'],
  major: [(t) => `今天只專心把「${t}」做完，其他先放著`, () => '睡前寫三行：今天做到什麼、卡在哪、明天第一步'],
};
const SOFT = {
  wands: () => '能量不夠時先休息 10 分鐘，再決定要不要做',
  cups: () => '今天留 15 分鐘給自己，不排任何事',
  swords: () => '想太多時把念頭寫下來，寫完就先放著',
  pentacles: () => '今天不買計畫外的東西，想買的先寫下來',
  major: () => '今天少做一件事，把最重要的那件做好',
};

export const MAX_ACTIONS = 3;

// 貼上的文字拆成行動：一行一個，去掉「- [ ]」「1.」之類的開頭
export function parseActions(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]\s*)?(?:\[[ xX]?\]\s*)?(?:\d+[.、)]\s*)?/, '').trim())
    .filter((l) => l && !/^【.*】$/.test(l))
    .slice(0, MAX_ACTIONS);
}

export function suggestActions(cards, tasks = []) {
  const now = cards[1] || cards[0];
  const c = now && cardById(now.cardId);
  if (!c) return [];
  const key = c.arcana === 'major' ? 'major' : c.suit;
  const first = tasks[0] || '今天最重要的事';
  const task = first.length > 14 ? `${first.slice(0, 13)}…` : first;
  const out = ACTIONS[key].map((f) => f(task));
  if (now.reversed) out.unshift(SOFT[key]());
  return [...new Set(out)].slice(0, 3);
}

// 複製給 AI 的 prompt
export function tarotPrompt({ day, cards, tasks = [], habitsDone = [], energy = null }) {
  const list = cards.map((d, i) => ({ d, c: cardById(d.cardId), pos: POSITIONS[i] })).filter((x) => x.c);
  if (!list.length) return '';
  const lines = [`我今天（${day}）用「過去・現在・未來」三張牌陣抽了偉特塔羅牌，請幫我解讀。`, ''];
  list.forEach(({ d, c, pos }, i) => {
    lines.push(
      `${i + 1}. ${pos}：${c.zh}（${c.en}）・${d.reversed ? '逆位' : '正位'}`,
      `   類別：${c.arcana === 'major' ? '大阿爾克那' : `小阿爾克那・${c.suitZh}（${c.theme}）`}`,
      `   關鍵字：${d.reversed ? c.rev : c.up}`,
    );
  });
  if (tasks.length || energy || habitsDone.length) {
    lines.push('', '我今天的狀況：');
    if (tasks.length) lines.push(`- 今天要做的事：${tasks.join('、')}`);
    if (habitsDone.length) lines.push(`- 已經完成的每日習慣：${habitsDone.join('、')}`);
    if (energy) lines.push(`- 精力（1～5）：${energy}`);
  }
  lines.push(
    '',
    '請用繁體中文，分成兩段回答，兩段不要混在一起：',
    '',
    '【牌義解讀】',
    '- 三張牌各自在這個位置的意思（每張 2～3 句），再把三張連起來看。',
    '- 把它當成今天反思的提示，不要說成一定會發生的預測。',
    '',
    '【今天的行動建議】',
    '- 對照我今天要做的事和精力，給 1～3 個今天做得到的具體行動，每個 15 分鐘內可以完成。',
    '- 用「- [ ] 行動」的格式列出來，方便我複製回 App 打勾。',
    '- 最後一句今天可以對自己說的話。',
    '',
    '不用太玄，像朋友聊天一樣就好。',
  );
  return lines.join('\n');
}
