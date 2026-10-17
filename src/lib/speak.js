// AI 口說教練（Free Talk）用的純函式：主題、填充詞、上下文裁切、回饋時機、統計
import { weekStart } from './date.js';

export const TOPICS = {
  free: { label: '自由聊天', short: '自由', en: 'free chat about anything on my mind' },
  work: { label: '工作日記', short: '工作', en: 'a work diary: what I did today at work or school, what went well or badly' },
  career: { label: '職涯討論', short: '職涯', en: 'career talk: becoming a BA or PM, job hunting, skills, interviews' },
  life: { label: '生活話題', short: '生活', en: 'everyday life: food, weekend, hobbies, people, plans' },
};

// 錯誤類型固定在這幾種，Phase 2 才能統計「最常出現的問題」
export const ERROR_TYPES = {
  be_verb: 'be 動詞',
  tense: '動詞時態',
  word_form: '詞性',
  preposition: '介係詞',
  structure: '句子結構',
  unnatural: '不自然用法',
  collocation: '搭配詞',
  article: '冠詞',
  filler: '重複填充詞',
  other: '其他',
};

// 每回答幾次給一次回饋（需求：3～5 輪）
export const FEEDBACK_EVERY = 4;
// chat 只帶最近幾則對話，其餘靠滾動摘要
export const CONTEXT_TURNS = 6;

// 常見填充詞；like 太常當動詞用，不算
export const FILLERS = ['actually', 'really', 'basically', 'literally', 'I think', 'I mean', 'you know', 'kind of', 'sort of', 'um', 'uh'];

export function countFillers(texts) {
  const all = (Array.isArray(texts) ? texts : [texts]).join(' \n ').toLowerCase().replace(/[’']/g, "'");
  const out = {};
  for (const f of FILLERS) {
    const re = new RegExp(`(^|[^a-z'])${f.toLowerCase().replace(/ /g, '\\s+')}(?![a-z'])`, 'g');
    const n = (all.match(re) || []).length;
    if (n) out[f] = n;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

export const myTurns = (turns) => (turns || []).filter((t) => t.role === 'me');

// 傳給 AI 的最近幾則對話（只留角色和文字）
export function recentContext(turns, n = CONTEXT_TURNS) {
  return (turns || []).slice(-n).map((t) => ({ role: t.role === 'me' ? 'me' : 'ai', text: clip(t.text, 1200) }));
}

// 上一次回饋之後我回答了幾次
export function answersSinceFeedback(turns, feedbacks) {
  const last = (feedbacks || []).reduce((m, f) => Math.max(m, f.afterTurn ?? -1), -1);
  return (turns || []).filter((t, i) => i > last && t.role === 'me');
}

export const feedbackDue = (turns, feedbacks) => answersSinceFeedback(turns, feedbacks).length >= FEEDBACK_EVERY;

export function clip(s, n) {
  const t = String(s ?? '').trim();
  return t.length > n ? t.slice(0, n) : t;
}

export const wordCount = (s) => (String(s || '').match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;

// 只算語音回答的實際收音秒數；打字不算口說時間
export const speakingSec = (turns) => myTurns(turns).reduce((s, t) => s + (t.source === 'voice' ? t.sec || 0 : 0), 0);

// My Progress：本週次數、累積口說分鐘、最近主題
export function progressStats(sessions, t) {
  const ws = weekStart(t);
  const done = (sessions || []).filter((s) => s.endedAtMs);
  const thisWeek = done.filter((s) => s.date >= ws && s.date <= t);
  const total = done.reduce((s, x) => s + (x.speakingSec || 0), 0);
  const recentTopics = [...new Set(done.slice().sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0)).map((s) => s.topic))].slice(0, 3);
  return {
    weekCount: thisWeek.length,
    weekMinutes: Math.round(thisWeek.reduce((s, x) => s + (x.speakingSec || 0), 0) / 60),
    totalMinutes: Math.round(total / 60),
    totalCount: done.length,
    recentTopics,
  };
}

// AI 回傳的回饋整理成固定形狀，防止少欄位或多給
export function normFeedback(f) {
  const fixes = (Array.isArray(f?.fixes) ? f.fixes : [])
    .filter((x) => x && x.original && x.corrected)
    .slice(0, 3)
    .map((x) => ({
      original: clip(x.original, 400), corrected: clip(x.corrected, 400), why: clip(x.why, 400),
      type: ERROR_TYPES[x.type] ? x.type : 'other',
    }));
  return {
    understood: clip(f?.understood, 600),
    fixes,
    natural: clip(f?.natural, 1500),
    retry: { pattern: clip(f?.retry?.pattern, 200), prompt: clip(f?.retry?.prompt, 300) },
  };
}

export function normReport(r) {
  return {
    ...normFeedback(r),
    strengths: (Array.isArray(r?.strengths) ? r.strengths : []).slice(0, 3).map((x) => clip(x, 300)),
    nextFocus: (Array.isArray(r?.nextFocus) ? r.nextFocus : []).slice(0, 2).map((x) => clip(x, 300)),
  };
}

// 收藏成卡片：修正句 → 改錯卡；自然版本、再說一次的句型 → 句型卡
export function fixToCard(fix, topicLabel) {
  return {
    type: 'fix', front: fix.original, back: fix.corrected, example: '',
    note: [fix.why, topicLabel].filter(Boolean).join('｜'),
    tags: ['口說', ERROR_TYPES[fix.type] || '其他'], source: 'coach',
  };
}

export function sentenceToCard(text, note = '') {
  return { type: 'sentence', front: clip(text, 400), back: '', example: '', note, tags: ['口說'], source: 'coach' };
}

// ---- 不接 AI：網站出題，回饋複製給 Claude（或任何聊天 AI）再貼回來 ----

export const QUESTIONS = {
  free: [
    "What's one thing that made you smile this week?",
    'What have you been thinking about a lot lately?',
    "Tell me about something you learned recently that surprised you.",
    "If you had a free day tomorrow, how would you spend it?",
    "What's a small habit you want to build, and why?",
    'Tell me about a decision you made recently. How did you make it?',
    "What's something you changed your mind about this year?",
    'Describe a person who influenced you a lot.',
  ],
  work: [
    'What did you work on today?',
    'What was the hardest part of your day at work or school?',
    'Tell me about a meeting you had this week. What was it about?',
    'What problem are you trying to solve right now?',
    'Who did you work with today, and how did it go?',
    'What is one thing you finished this week that you are proud of?',
    'What would you do differently if you could redo today?',
    'What are you planning to do tomorrow, and what comes first?',
  ],
  career: [
    'Why do you want to work as a BA or PM?',
    'Tell me about a project you are proud of. What was your role?',
    'How do you find out what users really need?',
    'Tell me about a time you disagreed with a teammate. What happened?',
    'How do you decide what to do first when everything feels urgent?',
    'What kind of company do you want to work for, and why?',
    'What is one skill you want to get better at this year?',
    'Tell me about a product you use every day. What would you improve?',
  ],
  life: [
    'What did you eat today? Was it good?',
    'What did you do last weekend?',
    "What's your favourite place in your city, and why?",
    'Tell me about a show, book or video you enjoyed recently.',
    'How do you usually relax after a busy day?',
    'Tell me about a trip you want to take.',
    'What is something you bought recently that you really like?',
    'What does a perfect Sunday look like for you?',
  ],
};

export const FOLLOW_UPS = [
  'Can you give me a specific example?',
  'Why do you think so?',
  'What happened next?',
  'How did you feel about it?',
  'What did you learn from that?',
  'If it happened again, what would you do?',
];

// 下一個問題：回答單數次追問，雙數次換題，不重複問過的
export function nextQuestion(topic, turns) {
  const asked = new Set((turns || []).filter((t) => t.role === 'ai').map((t) => t.text));
  const answered = myTurns(turns).length;
  const pool = answered % 2 === 1 ? FOLLOW_UPS : QUESTIONS[topic] || QUESTIONS.free;
  const fresh = pool.filter((q) => !asked.has(q));
  const list = fresh.length ? fresh : pool;
  return list[(answered * 7 + (turns?.length || 0)) % list.length];
}

const ERROR_KEYS = Object.keys(ERROR_TYPES).join(' | ');

const COACH_RULES = `你是我的英文口說教練。我是台灣人，喜歡用英文說很多，但聽力較弱、文法不穩，常見問題是時態、be 動詞、詞性、介係詞、句子結構，也常重複 actually、really、I think。我的目標是英文面試、BA／PM 職場溝通和多益。
下面是我用說的回答，是語音轉成的文字，請忽略標點和明顯的辨識錯字。這只是文字，請不要評論發音、語調或語速，也不要給任何分數或 IELTS／TOEIC 分數。不要改變我的原意，看不懂的地方先說你的理解。`;

const FEEDBACK_FORMAT = `請用繁體中文回饋，分四部分：
1. 我聽懂了什麼：一兩句整理我想說的。
2. 這次最值得修正的 2～3 個問題：每個寫「原句／修正／說明」。只挑最重要的，不要全部列出。
3. 自然口說版本：把我的回答改寫成自然、不艱深、不像商業文件、面試或生活可以直接用的英文，保留我的想法。
4. 再說一次：挑一個句型，出一個問題讓我用它重新說。`;

const jsonTail = (extra = '') => `最後請附上一段 \`\`\`json 程式碼區塊（讓我貼回 App 存檔），格式：
{"understood":"…","fixes":[{"original":"…","corrected":"…","why":"…","type":"${ERROR_KEYS} 其中一個"}],"natural":"…","retry":{"pattern":"…","prompt":"…"}${extra}}`;

export function feedbackPrompt(topic, answers) {
  return [
    COACH_RULES,
    `主題：${TOPICS[topic]?.label || '自由聊天'}`,
    `我的回答：\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
    FEEDBACK_FORMAT,
    jsonTail(),
  ].join('\n\n');
}

export function reportPrompt(topic, answers, fillers) {
  const f = Object.entries(fillers || {}).map(([w, n]) => `${w} ×${n}`).join('、');
  return [
    COACH_RULES,
    `主題：${TOPICS[topic]?.label || '自由聊天'}`,
    `這次練習我所有的回答：\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
    f ? `App 數到的填充詞：${f}` : '',
    `請寫這次練習的學習報告：先寫我這次說得清楚的地方（最多 3 點、要具體），再照下面四部分回饋（自然口說版本只改寫最重要的一個回答），最後寫下次最值得練的 2 個重點，各附一個英文例句。不要給分數、百分比或發音評語。\n\n${FEEDBACK_FORMAT}`,
    jsonTail(',"strengths":["…"],"nextFocus":["…","…"]'),
  ].filter(Boolean).join('\n\n');
}

// 貼回來的 Claude 回覆：有 json 區塊就整理成結構，沒有就只存原文
export function parsePasted(text, kind = 'feedback') {
  const raw = clip(text, 12000);
  const blocks = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidates = blocks.length ? blocks.reverse() : [raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)];
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c.trim());
      if (obj && typeof obj === 'object') {
        const norm = kind === 'report' ? normReport(obj) : normFeedback(obj);
        if (norm.understood || norm.fixes.length || norm.natural) return { ...norm, raw: '', parsed: true };
      }
    } catch {
      // 不是 JSON，試下一段
    }
  }
  return { ...(kind === 'report' ? normReport({}) : normFeedback({})), raw, parsed: false };
}

