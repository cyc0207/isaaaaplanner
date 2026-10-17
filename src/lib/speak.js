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
