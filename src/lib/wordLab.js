// 單字實驗室（Word Lab）：一步一步做題、答錯看原因再重答、自己造句、最後進入原本的 englishItems 間隔複習。
// 排程只有一套：學完的字變成 englishItems 的卡，複習結果一律用 english.js 的 review()。
// 資料：
//   wordLab/{字}          每個核心字的進度（第幾步、每項能力、每題作答、解鎖的例句）
//   wordLabLog/{自動 id}  每一次作答（只寫不訂閱，看單字紀錄時才查）
//   wordLabSentences/{id} 每一句造句：每一版原文、貼回的外部 AI 回饋
//   wordLabDays/{日期}    當天的快速辨識字、TOEIC 小測
//   settings/wordLab      { mode, newPerDay }
import { addDays } from './date.js';
import { itemKey, newItem } from './english.js';
import { CORE_WORDS, QUICK_WORDS } from '../data/wordLab.js';

export const LAB_TAG = '單字實驗室';

export const STEPS = [
  { n: 1, key: 'meaning', label: '猜意思', hint: '先看句子猜，猜錯沒關係', kinds: ['meaning'] },
  { n: 2, key: 'collocation', label: '搭配詞', hint: '常跟哪些字、哪個介係詞一起出現', kinds: ['collocation', 'preposition'] },
  { n: 3, key: 'form', label: '詞性和相似字', hint: '名詞、動詞、形容詞，和長得像的字', kinds: ['pos', 'confusable', 'errorFix'] },
  { n: 4, key: 'scenario', label: '情境', hint: '生活、BA、PM、UAT 裡怎麼用', kinds: ['scenario'] },
  { n: 5, key: 'write', label: '自己造句', hint: '中翻英＋寫一句自己的話' },
  { n: 6, key: 'feedback', label: '批改和修改', hint: '複製給外部 AI，貼回來再改' },
  { n: 7, key: 'srs', label: '進入複習', hint: '之後照間隔複習' },
];
export const DONE_STEP = 8;

export const SKILLS = {
  meaning: '意思辨識',
  collocation: '搭配詞',
  pos: '詞性',
  sentence: '自主造句',
  srs: '間隔複習',
  toeic: 'TOEIC 題',
};

// 答錯時記下的錯誤類型（Smart Review 依這個出題）
export const ERROR_TYPES = {
  meaning: '意思不熟',
  collocation: '搭配詞錯誤',
  pos: '詞性錯誤',
  sentence: '造句錯誤',
  toeic: 'TOEIC 題答錯',
};

export const KIND_LABEL = {
  meaning: '意思辨識',
  collocation: '搭配詞選擇',
  preposition: '介係詞填空',
  pos: '詞性辨識',
  confusable: '相似字辨識',
  errorFix: '找錯',
  scenario: '情境任務',
  part5: 'TOEIC Part 5（非官方）',
  translate: '中翻英',
  own: '自己造句',
  rewrite: '改寫',
};

export const MODES = {
  15: { label: '15 分鐘', core: 1, quick: 0, toeic: 3, desc: '1 個核心字＋複習＋TOEIC 小測 3 題' },
  30: { label: '30 分鐘', core: 2, quick: 5, toeic: 5, desc: '2 個核心字＋5 個快速辨識字＋複習＋TOEIC 小測 5 題' },
  45: { label: '45 分鐘', core: 3, quick: 5, toeic: 10, desc: '3 個核心字＋5 個快速辨識字＋複習＋TOEIC 練習 10 題' },
};
export const modeOf = (s) => (MODES[s?.mode] ? Number(s.mode) : 15);
// 到期的單字卡超過這個數字：今天不給新字，先清複習
export const BACKLOG = 10;

export const wordById = Object.fromEntries(CORE_WORDS.map((w) => [w.id, w]));

// ---- 小工具 ----

// 穩定雜湊：同一天、同一題，選項順序固定；重答時換一個順序
export function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled(list, seed) {
  const a = list.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 選項重新排列；回傳畫面用的選項（帶原本的位置），重答時 attempt 不同就換順序
export function arrange(q, attempt = 0) {
  const idx = q.options.map((_, i) => i);
  let order = shuffled(idx, seedOf(`${q.id}|${attempt}`));
  // 重答時，正確答案不要剛好還在同一個位置
  if (attempt > 0) {
    const prev = shuffled(idx, seedOf(`${q.id}|${attempt - 1}`));
    if (order.indexOf(q.answer) === prev.indexOf(q.answer)) order = [...order.slice(1), order[0]];
  }
  return order.map((i) => ({ i, text: q.options[i] }));
}

const pct = (s) => (s && s.n ? s.ok / s.n : null);
export const pctText = (s) => (s && s.n ? `${Math.round((s.ok / s.n) * 100)}%（${s.ok}/${s.n}）` : '—');

// ---- 每個字的流程 ----

export const stepOf = (st) => (st?.finishedOn ? DONE_STEP : Math.min(Math.max(st?.step || 1, 1), DONE_STEP));
export const isStarted = (st) => !!st?.startedOn;
export const isFinished = (st) => !!st?.finishedOn;

export function stepQuestions(word, n) {
  const step = STEPS[n - 1];
  if (!step?.kinds) return [];
  return word.questions.filter((q) => step.kinds.includes(q.kind));
}

// 這一步的客觀題都至少答對一次（重答答對也算），才能往下
export function stepComplete(word, st, n) {
  const qs = stepQuestions(word, n);
  if (qs.length) return qs.every((q) => st?.answered?.[q.id]?.lastOk);
  if (n === 5) return word.tasks.every((t) => st?.sentences?.[t.id]);
  return false;
}

// 這一步下一題：還沒答對的第一題
export function nextQuestion(word, st, n) {
  return stepQuestions(word, n).find((q) => !st?.answered?.[q.id]?.lastOk) || null;
}

// 例句：一開始只給 unlock ≤ 目前步驟的；某一類答錯過，該類的例句提早解鎖。最多 10 句
export function visibleExamples(word, st) {
  const step = stepOf(st);
  const missed = st?.errors || {};
  return word.examples.filter((e) => e.unlock <= step || (e.focus && missed[e.focus] > 0)).slice(0, 10);
}

// 第一次開始：只寫還沒有的欄位，已經有的進度不動
export function startData(word, st, t) {
  if (isStarted(st)) return null;
  return { word: word.word, step: 1, startedOn: t, startedAtMs: Date.now() };
}

// 回答一題客觀題 → 要寫進 wordLab/{字} 的欄位（merge）＋一筆作答紀錄
// 能力統計只算每題第一次作答；看過答案後的重答會記在紀錄裡，但不灌水
// fresh：複習、TOEIC 小測時，這一輪的第一次作答也算（同一題隔幾天再考是新的一次）
export function answerUpdate(word, st, q, chosen, t, { fresh, nowMs = Date.now() } = {}) {
  const correct = chosen === q.answer;
  const prev = st?.answered?.[q.id] || { tries: 0 };
  const first = fresh ?? !prev.tries;
  const skill = q.skill;
  const skills = st?.skills || {};
  const data = {
    answered: {
      [q.id]: {
        tries: prev.tries + 1,
        firstOk: prev.tries ? !!prev.firstOk : correct,
        lastOk: correct || !!prev.lastOk,
        lastAt: nowMs,
      },
    },
  };
  if (first) {
    const cur = skills[skill] || { ok: 0, n: 0 };
    data.skills = { [skill]: { ok: (cur.ok || 0) + (correct ? 1 : 0), n: (cur.n || 0) + 1 } };
  }
  if (!correct) {
    data.lastErrorType = skill;
    data.errors = { [skill]: ((st?.errors || {})[skill] || 0) + 1 };
  }
  const log = {
    wordId: word.id, word: word.word, qid: q.id, kind: q.kind, skill,
    chosen: q.options[chosen] ?? '', answer: q.options[q.answer], correct,
    attempt: prev.tries + 1, errorType: correct ? '' : skill, date: t, atMs: nowMs,
  };
  return { correct, data, log };
}

// 這一步做完 → 下一步
export function advanceData(word, st, t) {
  const n = stepOf(st);
  if (n >= 7) return null;
  // 第 6 步（批改）可以先跳過，之後再貼回饋
  if (n !== 6 && !stepComplete(word, st, n)) return null;
  return { step: n + 1, [`stepDone${n}`]: t };
}

// 第 7 步：進入間隔複習。已經有同一個字的卡就接上它（不改盒子、到期日），沒有才新增 wl-字
export function enterSrsOps(word, items, t) {
  const have = (items || []).find((it) => it.labWord === word.id) || (items || []).find((it) => itemKey(it.type, it.front) === itemKey('word', word.word));
  const ops = [];
  let itemId;
  if (have) {
    itemId = have.id;
    const patch = { labWord: word.id };
    // ChatGPT 補進來還沒學的字：現在學了，開始排複習
    if (have.pending) Object.assign(patch, { pending: false, introducedOn: t, due: addDays(t, 1) });
    ops.push({ set: `englishItems/${have.id}`, data: patch });
  } else {
    itemId = `wl-${word.id}`;
    ops.push({
      add: 'englishItems',
      id: itemId,
      data: {
        ...newItem({
          type: 'word', front: word.word, back: word.zh, example: word.examples[0]?.en || '',
          tags: [LAB_TAG], source: 'wordLab', collocation: word.collocations.slice(0, 3).join('; '), pos: word.pos,
        }, t),
        // 今天剛練完，明天開始複習
        due: addDays(t, 1),
        introducedOn: t,
        labWord: word.id,
      },
    });
  }
  ops.push({ set: `wordLab/${word.id}`, data: { step: DONE_STEP, finishedOn: t, itemId } });
  return ops;
}

// ---- 造句：複製給外部 AI，貼回來 ----

export const sentenceId = (wordId, taskId) => `${wordId}--${taskId}`.replace(/[/:]/g, '_');

export function sentencePrompt({ word, zh, task, text, versions = [] }) {
  const hist = versions.length > 1
    ? `\n我之前的版本：\n${versions.slice(0, -1).map((v, i) => `${i + 1}. ${v.text}`).join('\n')}\n`
    : '';
  const ask = task.kind === 'translate'
    ? `題目（中翻英）：${task.zh}`
    : task.kind === 'rewrite'
      ? `題目：把這句改寫成正確、自然的英文：${task.original}`
      : `題目：${task.prompt}`;
  return `你是我的英文老師。我的目標是 TOEIC 850，也想在 BA／PM 工作上用得自然。請批改我的句子。

目標字或說法：${word}${zh ? `（${zh}）` : ''}
${ask}
${hist}
我這次寫的：
${text}

請用繁體中文說明，最後一定要附一段 json code block，格式：
\`\`\`json
{"verdict":"ok 或 fix","corrected":"改好的句子（沒問題就照抄）","issues":[{"type":"meaning|collocation|pos|grammar|natural","zh":"哪裡要改、為什麼"}],"tipZh":"一句提醒"}
\`\`\`
- verdict：句子正確又自然就寫 ok；有任何需要改的就寫 fix
- 不要幫我打分數，也不要換算 TOEIC 分數
- 如果我沒有用到目標字，請在 issues 裡提醒`;
}

const ISSUE_TYPES = ['meaning', 'collocation', 'pos', 'grammar', 'natural'];
export const ISSUE_LABEL = { meaning: '意思', collocation: '搭配詞', pos: '詞性', grammar: '文法', natural: '自然度' };

// 貼回來的回覆：找 json，找不到就存原文（標「沒讀到格式」）
export function parseFeedback(text) {
  const raw = String(text ?? '').trim().slice(0, 8000);
  if (!raw) return null;
  const blocks = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const cands = blocks.length ? blocks.reverse() : [raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)];
  for (const c of cands) {
    try {
      const o = JSON.parse(c.trim());
      if (o && typeof o === 'object' && (o.verdict || o.corrected)) {
        const issues = (Array.isArray(o.issues) ? o.issues : [])
          .map((x) => ({ type: ISSUE_TYPES.includes(x?.type) ? x.type : 'natural', zh: String(x?.zh ?? '').slice(0, 400) }))
          .filter((x) => x.zh)
          .slice(0, 8);
        const verdict = o.verdict === 'ok' && !issues.length ? 'ok' : 'fix';
        return { parsed: true, verdict, corrected: String(o.corrected ?? '').slice(0, 600), issues, tipZh: String(o.tipZh ?? '').slice(0, 300), raw: '' };
      }
    } catch {
      // 不是 JSON，試下一段
    }
  }
  return { parsed: false, verdict: '', corrected: '', issues: [], tipZh: '', raw };
}

// 交一版造句 → wordLabSentences 的整份資料（versions 一直往後加，不覆蓋舊版）
export function submitSentence(prev, { wordId, task, word, text, t, nowMs = Date.now(), source = 'lab' }) {
  const versions = [...(prev?.versions || []), { text: text.trim().slice(0, 600), date: t, atMs: nowMs }];
  return {
    wordId, word, taskId: task.id, kind: task.kind, source,
    prompt: task.zh || task.prompt || task.original || '',
    versions, feedback: prev?.feedback || [],
    status: 'submitted', updatedAtMs: nowMs,
    ...(task.original ? { original: task.original, sourceDate: task.sourceDate || '' } : {}),
  };
}

// 貼回一份回饋（對應最新一版）
export function addFeedback(prev, fb, nowMs = Date.now()) {
  const forVersion = (prev?.versions || []).length;
  const entry = { ...fb, forVersion, atMs: nowMs, by: '外部 AI' };
  return {
    feedback: [...(prev?.feedback || []), entry],
    status: fb.verdict === 'ok' ? 'ok' : fb.verdict === 'fix' ? 'needsFix' : 'submitted',
    updatedAtMs: nowMs,
  };
}

export const SENTENCE_STATUS = { submitted: '還沒批改', needsFix: '要修改', ok: '外部 AI 說可以' };

// 自主造句能力：從造句紀錄算（交了幾句、外部 AI 說 ok 幾句、改了幾次）
export function sentenceSkill(sentences, wordId) {
  const mine = (sentences || []).filter((s) => s.wordId === wordId);
  return {
    submitted: mine.length,
    ok: mine.filter((s) => s.status === 'ok').length,
    needsFix: mine.filter((s) => s.status === 'needsFix').length,
    pending: mine.filter((s) => s.status === 'submitted').length,
    revisions: mine.reduce((n, s) => n + Math.max(0, (s.versions || []).length - 1), 0),
  };
}

// ---- Smart Review：到期的卡依弱點出題 ----

export const labItems = (items) => (items || []).filter((it) => it.labWord && wordById[it.labWord]);

export function labDue(items, t) {
  return labItems(items)
    .filter((it) => it.front && !it.pending && it.srs !== false && (it.due || '') <= t)
    .sort((a, b) => (a.due || '').localeCompare(b.due || '') || (a.box || 0) - (b.box || 0));
}

// 最弱的一項（意思／搭配詞／詞性／造句）；有答錯就先看最近一次的錯誤類型
export function weakSkill(st, sent) {
  if (st?.lastErrorType && st.lastErrorType !== 'toeic') return st.lastErrorType;
  if (sent && sent.needsFix > 0) return 'sentence';
  const s = st?.skills || {};
  const rank = ['meaning', 'collocation', 'pos']
    .map((k) => ({ k, p: pct(s[k]) ?? 1 }))
    .sort((a, b) => a.p - b.p);
  return rank[0].p < 1 ? rank[0].k : 'mixed';
}

const REVIEW_KINDS = {
  meaning: ['meaning', 'scenario', 'confusable'],
  collocation: ['collocation', 'preposition', 'errorFix'],
  pos: ['pos', 'errorFix', 'part5'],
  mixed: ['meaning', 'collocation', 'preposition', 'pos', 'confusable', 'errorFix', 'scenario', 'part5'],
};

// 回傳 { kind: 'q', q, reason } 或 { kind: 'rewrite', task, reason }
export function reviewTask(word, st, item, sent) {
  const long = (item?.box || 0) >= 4;
  const weak = long ? 'mixed' : weakSkill(st, sent);
  if (weak === 'sentence') {
    const task = word.tasks.find((x) => x.kind === 'translate') || word.tasks[0];
    return { kind: 'rewrite', task, reason: '上次造句要修改：重新造一句' };
  }
  const kinds = REVIEW_KINDS[weak] || REVIEW_KINDS.mixed;
  let pool = word.questions.filter((q) => kinds.includes(q.kind) && (weak === 'mixed' || weak === 'pos' ? true : q.skill === weak || q.kind === 'scenario' || q.kind === 'confusable'));
  if (!pool.length) pool = word.questions;
  // 最久沒做的那題
  const ans = st?.answered || {};
  const q = pool.slice().sort((a, b) => (ans[a.id]?.lastAt || 0) - (ans[b.id]?.lastAt || 0) || seedOf(a.id + (item?.reps || 0)) - seedOf(b.id + (item?.reps || 0)))[0];
  const reason = long ? '長期掌握：混合題型＋TOEIC 題' : weak === 'mixed' ? '混合題型' : `${ERROR_TYPES[weak]}：${KIND_LABEL[q.kind]}`;
  return { kind: 'q', q, reason };
}

// ---- 每日計畫 ----

export function dailyPlan({ settings, states, items, t }) {
  const mode = modeOf(settings);
  const cfg = MODES[mode];
  const n = Number.isInteger(settings?.newPerDay) && settings.newPerDay >= 0 ? Math.min(settings.newPerDay, 5) : cfg.core;
  const due = labDue(items, t);
  const backlog = due.length > BACKLOG;
  const st = (id) => states[id];
  // 還沒做完的字先接著做；今天開始的也算今天的份
  const unfinished = CORE_WORDS.filter((w) => isStarted(st(w.id)) && !isFinished(st(w.id)));
  const today = CORE_WORDS.filter((w) => st(w.id)?.startedOn === t);
  const list = [...new Set([...unfinished, ...today])];
  if (!backlog) {
    for (const w of CORE_WORDS) {
      if (list.length >= Math.max(n, today.length)) break;
      if (!isStarted(st(w.id))) list.push(w);
    }
  }
  return {
    mode, cfg, newPerDay: n, due, backlog,
    core: list,
    coreLeft: list.filter((w) => !isFinished(st(w.id))).length,
    remaining: CORE_WORDS.filter((w) => !isStarted(st(w.id))).length,
  };
}

// 快速辨識字：還沒熟的排前面，今天已經答過的留在清單裡（畫面不會跳）
export function quickPicks(quick, t, n = 5) {
  if (!n) return [];
  const w = quick?.words || {};
  const doneToday = QUICK_WORDS.filter((q) => w[q.word]?.last === t);
  const rest = QUICK_WORDS.filter((q) => w[q.word]?.last !== t)
    .sort((a, b) => (w[a.word]?.streak || 0) - (w[b.word]?.streak || 0) || seedOf(a.word + t) - seedOf(b.word + t));
  return [...doneToday, ...rest].slice(0, n);
}

export function quickQuestion(qw, t) {
  const others = QUICK_WORDS.filter((x) => x.word !== qw.word && x.zh !== qw.zh)
    .sort((a, b) => seedOf(a.word + qw.word + t) - seedOf(b.word + qw.word + t))
    .slice(0, 3)
    .map((x) => x.zh);
  return {
    id: `quick-${qw.word}`, kind: 'meaning', skill: 'meaning',
    q: `${qw.ex}\n“${qw.word}” 的意思是？`,
    options: [qw.zh, ...others], answer: 0,
    explain: `${qw.word}（${qw.pos}）＝${qw.zh}`,
    why: {},
  };
}

export function quickUpdate(quick, qw, correct, t) {
  const cur = quick?.words?.[qw.word] || {};
  return { words: { [qw.word]: { n: (cur.n || 0) + 1, ok: (cur.ok || 0) + (correct ? 1 : 0), streak: correct ? (cur.streak || 0) + 1 : 0, last: t } } };
}

// TOEIC 小測：先從開始學的字出，不夠再從其他字補；同一天題目固定
export function toeicPicks(states, t, n) {
  const all = CORE_WORDS.flatMap((w) => w.questions.filter((q) => q.kind === 'part5').map((q) => ({ w, q })));
  const started = (x) => (isStarted(states[x.w.id]) ? 0 : 1);
  return all.sort((a, b) => started(a) - started(b) || seedOf(a.w.id + a.q.id + t) - seedOf(b.w.id + b.q.id + t)).slice(0, n);
}

// 今天的 Word Lab 做完了沒（首頁「英文」打勾用）
export function dayFinished(plan, states, day, quickN) {
  const coreDone = plan.core.length > 0 && plan.core.every((w) => isFinished(states[w.id]));
  const reviewDone = !plan.due.length;
  const quickDone = !quickN || (day?.quickDone || 0) >= quickN;
  const toeicDone = !!day?.toeic?.done;
  return (coreDone || plan.backlog || !plan.core.length) && reviewDone && quickDone && toeicDone;
}

// ---- 學習分析：每個字 6 項分開 ----

export function wordStats(word, st, item, sentences) {
  const s = st?.skills || {};
  return {
    step: stepOf(st),
    started: isStarted(st),
    meaning: s.meaning || null,
    collocation: s.collocation || null,
    pos: s.pos || null,
    toeic: s.toeic || null,
    sentence: sentenceSkill(sentences, word.id),
    srs: item ? { box: item.box || 0, reps: item.reps || 0, lapses: item.lapses || 0, due: item.due || '' } : null,
    lastErrorType: st?.lastErrorType || '',
  };
}

export const BOX_LABEL = (box) => (box >= 4 ? '長期記憶' : box >= 2 ? '複習中' : '剛開始');

// ---- 口說錯誤庫 → 題目 ----
// 來源一：englishItems 裡的錯誤卡（bank: 'error'，PR「個人口說錯誤庫」匯入的）
// 來源二：還沒匯入時，直接唯讀 ChatGPT 交換格式 JSON（schemaVersion "1.0.0"）；只出題、不寫錯誤卡
// 原句只用 verifiedOriginal；建議改法一律標「建議」，不當成你說過的話

const normText = (s) => String(s ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function speakingErrors(items, datasets = []) {
  const cards = (items || []).filter((it) => it.bank === 'error' && (it.originalText || it.front));
  const out = [];
  const seen = new Set();
  const push = (e) => {
    const k = `${normText(e.original)}→${normText(e.correction)}`;
    if (!e.original || !e.correction || seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };
  for (const it of cards) {
    const occ = it.occurrences || [];
    push({
      id: it.id,
      itemId: it.id,
      original: it.originalText || it.front,
      correction: it.correctedText || it.back,
      explanationZh: it.explanationZh || it.note || '',
      category: it.errorCategory || 'other',
      sourceDate: it.sourceDate || occ[0]?.date || '',
      topic: it.sourceTopic || '',
      unverified: occ.length > 0 && occ.every((o) => o.evidence === 'unverified'),
      inferred: !!it.semanticInference,
    });
  }
  for (const d of datasets) {
    if (!d || typeof d.datasetId !== 'string' || !Array.isArray(d.errors)) continue;
    for (const e of d.errors) {
      // 只收 ChatGPT 標明是逐字稿原句的
      if (!e?.verifiedOriginal || (e.sourceType && e.sourceType !== 'verifiedOriginal')) continue;
      push({
        id: `${d.datasetId}:${e.id}`,
        itemId: '',
        original: e.verifiedOriginal,
        correction: e.suggestedCorrection,
        explanationZh: e.explanationZh || '',
        category: e.errorCategory || 'other',
        sourceDate: e.sourceDate || '',
        topic: e.sourceTopic || '',
        unverified: false,
        inferred: !!e.semanticInference,
      });
    }
  }
  return out.sort((a, b) => (b.sourceDate || '').localeCompare(a.sourceDate || ''));
}

const PREPS = ['in', 'on', 'at', 'to', 'for', 'with', 'of', 'about', 'from', 'by', 'into'];
const tokens = (s) => String(s || '').replace(/[’‘]/g, "'").match(/[A-Za-z][A-Za-z'-]*/g) || [];

// 搭配詞／介係詞類的錯誤：把建議句裡「原句沒有的那個字」挖空，原句用的字當誘答
export function errorCloze(e) {
  if (!['collocation', 'preposition'].includes(e.category)) return null;
  const orig = tokens(e.original).map((x) => x.toLowerCase());
  const corr = tokens(e.correction);
  const origSet = new Set(orig);
  const idx = corr.findIndex((w) => !origSet.has(w.toLowerCase()) && (e.category !== 'preposition' || PREPS.includes(w.toLowerCase())));
  if (idx < 0) return null;
  const blank = corr[idx];
  const corrSet = new Set(corr.map((x) => x.toLowerCase()));
  let distract = orig.filter((w) => !corrSet.has(w) && w.length <= 14);
  if (e.category === 'preposition' || PREPS.includes(blank.toLowerCase())) distract = [...distract.filter((w) => PREPS.includes(w)), ...PREPS];
  const opts = [...new Set([blank.toLowerCase(), ...distract])].slice(0, 4);
  if (opts.length < 3) return null;
  const re = new RegExp(`\\b${blank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const q = e.correction.replace(re, '___');
  if (q === e.correction) return null;
  const order = shuffled(opts, seedOf(e.id));
  return {
    id: `err-${seedOf(e.id).toString(36)}`, kind: e.category === 'preposition' ? 'preposition' : 'collocation', skill: 'collocation',
    q: `${q}\n（依建議改法出題）`, options: order, answer: order.indexOf(blank.toLowerCase()),
    explain: e.explanationZh || `建議說法：${e.correction}`, why: {},
  };
}

export function errorRewriteTask(e) {
  // 建議改法不放進 model：畫面另外標「ChatGPT 的建議，不是你說過的話」
  return { id: 'rewrite', kind: 'rewrite', original: e.original, sourceDate: e.sourceDate, hint: '' };
}

export function errorOwnTask(e) {
  return { id: 'own', kind: 'own', prompt: `參考建議說法「${e.correction}」，用同樣的結構寫一句你自己的話（換主題或換細節）。`, hint: e.explanationZh };
}

export const errorWordId = (e) => `err_${seedOf(e.id).toString(36)}`;
