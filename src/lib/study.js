import { THEMES, THEME_ORDER, ALL_THEMES } from '../data/decks.js';
import { weekStart, diffDays } from './date.js';
import { itemKey, newItem } from './english.js';

// 兩種每日模式：忙的時候 5 分鐘，一般 15 分鐘
export const MODES = {
  5: { label: '5 分鐘', newWords: 3, reviewCap: 10, sentence: false },
  15: { label: '15 分鐘', newWords: 5, reviewCap: 30, sentence: true },
  20: { label: '每天 20 字', newWords: 20, reviewCap: 60, sentence: true },
};
export const modeOf = (es) => (MODES[es?.mode] ? Number(es.mode) : 15);

// 每週主題輪替：生活 → 職場 → 金融，從 2026-10-12（週一）那週開始算
const ANCHOR = '2026-10-12';

export function weekTheme(settings, t) {
  if (THEMES[settings?.fixedTheme]) return settings.fixedTheme;
  const ws = weekStart(t);
  if (settings?.themeWeek === ws && THEMES[settings.theme]) return settings.theme;
  const n = Math.floor(diffDays(ANCHOR, ws) / 7);
  return THEME_ORDER[((n % 3) + 3) % 3];
}

// 今天要學的新字：先從本週主題拿，拿完了再從其他主題補
// 本週主題的內建字用完，接著用 ChatGPT 補進來的待學字（pending），最後才從其他主題補
export function pickNewWords(theme, items, n) {
  const known = new Set(items.map((it) => itemKey(it.type, it.front)));
  const out = [];
  const take = (list) => {
    for (const w of list) {
      if (out.length >= n) return;
      if (w.pendingId || !known.has(itemKey(w.type, w.front))) out.push(w);
    }
  };
  const pending = (k) =>
    items
      .filter((it) => it.pending && it.deck === k)
      .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0))
      .map((it) => ({ ...it, pendingId: it.id }));
  take(THEMES[theme].words);
  take(pending(theme));
  const rest = THEMES[theme].exam ? ALL_THEMES.filter((k) => k !== theme && THEMES[k].exam) : THEME_ORDER.filter((k) => k !== theme);
  for (const k of rest) {
    take(THEMES[k].words);
    take(pending(k));
  }
  return out;
}

// 本週主題還剩幾個沒學（內建＋待學）
export function remainingIn(theme, items) {
  const known = new Set(items.map((it) => itemKey(it.type, it.front)));
  return THEMES[theme].words.filter((w) => !known.has(itemKey(w.type, w.front))).length + items.filter((it) => it.pending && it.deck === theme).length;
}

export function deckToItem(w, t) {
  return {
    ...newItem(
      { type: w.type, front: w.front, back: w.back, example: w.example, tags: [THEMES[w.deck].label], source: 'deck', note: '' },
      t,
    ),
    pos: w.pos, collocation: w.collocation, root: w.root, deck: w.deck, introducedOn: t,
  };
}

export function deckProgress(items) {
  const known = new Set(items.map((it) => itemKey(it.type, it.front)));
  return Object.fromEntries(ALL_THEMES.map((k) => [k, { learned: THEMES[k].words.filter((w) => known.has(itemKey(w.type, w.front))).length, total: THEMES[k].words.length }]));
}

// ---- 複習的三種方式 ----

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 例句挖空：片語整段比對，單字允許加字尾（decide → decided）
export function cloze(example, front) {
  if (!example || !front) return null;
  const re = /\s/.test(front.trim()) ? new RegExp(esc(front.trim()), 'i') : new RegExp(`\\b${esc(front.trim())}[a-z]*\\b`, 'i');
  const m = re.exec(example);
  if (!m) return null;
  return { before: example.slice(0, m.index), answer: m[0], after: example.slice(m.index + m[0].length) };
}

export const normAnswer = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,!?;:"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const isCorrect = (input, answers) => answers.some((a) => a && normAnswer(input) === normAnswer(a));

export function reviewModes(card) {
  const modes = ['flip'];
  if (card.type === 'fix' || card.type === 'grammar' || card.type === 'link') return modes;
  if (cloze(card.example, card.front)) modes.push('cloze');
  if (card.back && card.front.length <= 30) modes.push('spell');
  return modes;
}

// 第一次先翻卡認識，之後輪流填空、拼字
export function pickMode(card) {
  const modes = reviewModes(card);
  if (!card.reps) return 'flip';
  return modes[(card.reps + (card.front.length % 2)) % modes.length];
}

export const MODE_LABEL = { flip: '翻卡', cloze: '情境填空', spell: '看中文拼字' };

// ---- 每日一句 ----

export function sentencePrompt(words, text) {
  return `我在練英文，請幫我修改下面我寫的句子。我想練習用這些字：${words.join(', ')}。

我寫的：
${text.trim()}

請照下面做：
1. 先用繁體中文簡短說明每一句哪裡可以改（文法、用字、搭配詞、語氣），寫得好的也告訴我。
2. 再只輸出一個 code block，第一行固定是表頭：
type,front,back,example,tags,source,note
- 每一句有錯或可以更自然的，輸出一列：type 寫 fix，front 放我原本的句子，back 放改好的句子，note 用中文寫重點（例如「make a decision 不說 do a decision」）
- 如果有值得學的搭配詞或說法，另外輸出 type 寫 phrase 的列：front 放英文、back 放中文、example 放例句
- tags 寫 每日一句，source 寫 gpt
- 欄位裡有逗號或雙引號時，整格用雙引號包起來，裡面的雙引號寫成兩個
3. 句子完全正確就不用輸出那一列。`;
}

// 題庫快用完：請 ChatGPT 再給一批，貼回來變成待學新字
export function refillPrompt(theme, items, n = 100) {
  const label = THEMES[theme].label;
  const have = [...new Set([...THEMES[theme].words.map((w) => w.front), ...items.filter((it) => it.deck === theme || (it.tags || []).includes(label)).map((it) => it.front)])];
  const exam = { ielts: '雅思（IELTS）', toeic: '多益（TOEIC）', toefl: '托福（TOEFL）' }[theme];
  return `請給我 ${n} 個${exam ? `${exam}常考` : `${label}主題`}的英文單字或片語，從簡單到難排列。
下面這些我已經有了，不要重複：
${have.join(', ')}

只輸出一個 code block，第一行固定是表頭：
type,front,back,example,tags,source,note,collocation,root,pos
- type：單字寫 word，片語寫 phrase
- front：英文；back：繁體中文意思；example：一個自然的英文例句
- tags 寫 ${label}；source 寫 gpt；note 留空
- collocation：常見搭配詞，用分號分隔，例如 make a decision; a tough decision
- root：字首、字根、字尾提示，例如 pre-（之前）+ dict（說）；沒有就留空
- pos：詞性，例如 n.、v.、adj.、phr.
欄位裡有逗號或雙引號時，整格用雙引號包起來，裡面的雙引號寫成兩個。`;
}
