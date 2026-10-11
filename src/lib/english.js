import { parseCSVObjects, toCSV } from './csv.js';
import { addDays } from './date.js';

export const ENGLISH_HEADER = ['type', 'front', 'back', 'example', 'tags', 'source', 'note'];

export const TYPES = { word: '單字', phrase: '片語', sentence: '句型', grammar: '文法', fix: '改錯', link: '資源' };

// ChatGPT 有時會寫中文或複數，盡量認得
const TYPE_ALIASES = {
  words: 'word', vocab: 'word', vocabulary: 'word', 單字: 'word',
  phrases: 'phrase', idiom: 'phrase', 片語: 'phrase',
  sentences: 'sentence', pattern: 'sentence', 句型: 'sentence', 常用句: 'sentence',
  文法: 'grammar', correction: 'fix', mistake: 'fix', 改錯: 'fix', 錯誤: 'fix',
  url: 'link', resource: 'link', resources: 'link', 資源: 'link', 連結: 'link',
};

export function normType(t) {
  const s = (t || '').trim().toLowerCase();
  if (TYPES[s]) return s;
  return TYPE_ALIASES[s] || TYPE_ALIASES[t?.trim()] || '';
}

export const itemKey = (type, front) => `${type}|${(front || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;

export const splitTags = (s) =>
  (s || '')
    .split(/[|｜,，、]/)
    .map((x) => x.trim())
    .filter(Boolean);

// 從 ChatGPT 貼過來的文字常帶 ``` 和說明文字：只留表頭以後的 CSV
export function extractCSV(text, headerRe = /^\s*"?type"?\s*,\s*"?front"?/i) {
  let t = (text || '').replace(/^﻿/, '');
  const lines = t.split(/\r?\n/);
  const start = lines.findIndex((l) => headerRe.test(l));
  if (start < 0) return t;
  const rest = lines.slice(start);
  const end = rest.findIndex((l, i) => i > 0 && /^\s*```/.test(l));
  return (end > 0 ? rest.slice(0, end) : rest).filter((l) => !/^\s*```/.test(l)).join('\n');
}

// 匯入預覽：每一列標成 ok / duplicate / error
export function buildEnglishPreview(text, existing) {
  const { header, records } = parseCSVObjects(extractCSV(text));
  const h = header.map((x) => x.toLowerCase());
  if (!h.includes('type') || !h.includes('front')) {
    return { error: '找不到表頭 type,front,back,example,tags,source,note。請確認貼上的是 ChatGPT 給的 CSV。', rows: [] };
  }
  const seen = new Set(existing.map((e) => itemKey(e.type, e.front)));
  const rows = records.map((r0, i) => {
    const r = Object.fromEntries(Object.entries(r0).map(([k, v]) => [k.toLowerCase(), v]));
    const row = {
      line: i + 2,
      type: normType(r.type),
      rawType: r.type,
      front: r.front || '',
      back: r.back || '',
      example: r.example || '',
      tags: splitTags(r.tags),
      source: r.source || '',
      note: r.note || '',
    };
    const errors = [];
    if (!row.type) errors.push(`不認得的 type「${r.type}」`);
    if (!row.front) errors.push('front 是空的');
    if (errors.length) return { ...row, status: 'error', errors, selected: false };
    const key = itemKey(row.type, row.front);
    if (seen.has(key)) return { ...row, status: 'duplicate', errors, selected: false };
    seen.add(key);
    return { ...row, status: 'ok', errors, selected: true };
  });
  return { error: null, rows };
}

export function toEnglishCSV(items) {
  return toCSV(
    ENGLISH_HEADER,
    items.map((it) => ({ ...it, tags: (it.tags || []).join('|') })),
  );
}

export function newItem(data, t) {
  return {
    type: data.type || 'word', front: data.front || '', back: data.back || '', example: data.example || '',
    tags: data.tags || [], source: data.source || '', note: data.note || '',
    box: 0, due: t, reps: 0, lapses: 0, lastReviewed: '',
  };
}

// 間隔複習（Leitner 盒子）：記得就往後一格，忘了回到第一格
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];

export function review(item, remembered, t) {
  const box = remembered ? Math.min((item.box || 0) + 1, INTERVALS.length - 1) : 0;
  return {
    box,
    due: addDays(t, remembered ? INTERVALS[box] : 1),
    reps: (item.reps || 0) + 1,
    lapses: (item.lapses || 0) + (remembered ? 0 : 1),
    lastReviewed: t,
  };
}

export const practicable = (it) => it.type !== 'link' && it.front;

export function dueItems(items, t) {
  return items
    .filter((it) => practicable(it) && (it.due || '') <= t)
    .sort((a, b) => (a.due || '').localeCompare(b.due || '') || (a.box || 0) - (b.box || 0));
}

// 貼給 ChatGPT 的 prompt：網站「英文 → 匯入」有複製按鈕
export const GPT_PROMPT = `我想把你過去幫我記過、跟我聊過的所有英文學習資源整理出來，匯入我自己的練習網站。請照下面四步做。

第一步：先說清楚你能看到哪些來源
1. 你的「記憶」裡跟我學英文有關的內容
2. 你能參考的過去對話（如果我有開「參考聊天紀錄」）
3. 這個對話裡我貼給你的東西
請老實說哪些看得到、哪些看不到。看不到的部分，告訴我具體要怎麼補給你（例如到 設定 → 資料控管 → 匯出資料，下載後把 conversations.json 裡相關的對話貼給你）。

第二步：蒐集
把找得到的英文學習內容全部列出來，包括：單字、片語、句型、文法重點、我寫錯被你改過的句子、英文信的固定格式與常用句、比賽或報名用的英文、學習網站和資源連結。
不要編造。不確定的在 note 寫「不確定」。重複的合併成一筆。

第三步：輸出成 CSV
只輸出一個 code block，第一行固定是表頭：
type,front,back,example,tags,source,note
- type 只能是：word（單字）、phrase（片語）、sentence（句型或常用句）、grammar（文法）、fix（我的錯誤句→正確句）、link（資源連結）
- front：英文。fix 放我原本寫錯的句子；link 放資源名稱
- back：中文意思或說明。fix 放正確的句子；link 放網址
- example：一個英文例句，沒有就留空
- tags：主題，用 | 分隔，例如 email|比賽|商務
- source：memory、chat 或 我貼的
- note：補充，沒有就留空
欄位裡有逗號、換行或雙引號時，整格用雙引號包起來，裡面的雙引號寫成兩個。

第四步：統計
輸出完用三行告訴我：總共幾筆、每種 type 各幾筆、哪三個主題最多。

如果太多一次放不下就分批，每批都要有表頭，我說「繼續」再給下一批。`;
