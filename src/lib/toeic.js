import { addDays, diffDays, weekday, weekStart, shortLabel } from './date.js';

// 12 週 TOEIC 閱讀計畫：紙本《全新制 TOEIC 多益閱讀 1,200 題》12 回，每週五寫一回、週六檢討、週日休息。
// 資料在 users/{uid}/toeic（plan、r01～r12、d-日期）和 users/{uid}/toeicMistakes（r01-p5-q112）。
// 只存題號、成績、錯誤類型和自己的筆記，不存題目原文；不換算、不預測官方分數。

export const PLAN = {
  title: '12 週 TOEIC 閱讀 1,200 題',
  book: '全新制 TOEIC 多益閱讀 1,200 題',
  createdOn: '2026-10-18',
  start: '2026-10-23',
  end: '2027-01-09',
  rounds: 12,
  perRound: 100,
  minutes: 75,
};

export const PARTS = {
  p5: { label: 'Part 5', n: 5, total: 30, from: 101, to: 130 },
  p6: { label: 'Part 6', n: 6, total: 16, from: 131, to: 146 },
  p7: { label: 'Part 7', n: 7, total: 54, from: 147, to: 200 },
};
export const PART_KEYS = ['p5', 'p6', 'p7'];
export const TOTAL_QUESTIONS = PLAN.rounds * PLAN.perRound;

export const ERROR_TYPES = {
  vocab: '單字不熟',
  long_sentence: '長句結構',
  word_form: '詞性',
  tense: '動詞時態',
  clause: '關係子句／其他子句',
  preposition: '介係詞',
  inference: '文意推論',
  locate: '資訊定位',
  time: '時間不足',
  careless: '粗心',
  other: '其他',
};

// 錯題加入複習時建的卡片都帶這個主題，卡片庫搜得到、週一複習從這裡挑
export const CARD_TAG = 'TOEIC閱讀';

export const roundId = (n) => `r${String(n).padStart(2, '0')}`;
export const dayId = (date) => `d-${date}`;

// 第 n 回：週五寫、隔天週六檢討
export function schedule() {
  return Array.from({ length: PLAN.rounds }, (_, i) => ({
    round: i + 1,
    id: roundId(i + 1),
    plannedDate: addDays(PLAN.start, 7 * i),
    reviewDate: addDays(PLAN.start, 7 * i + 1),
  }));
}

// 第一次打開時要寫進去的計畫；固定 ID、只有日期欄位，重複寫也不會蓋掉成績
export function planDocs() {
  return [
    { path: 'toeic/plan', data: { ...PLAN } },
    ...schedule().map((s) => ({ path: `toeic/${s.id}`, data: { round: s.round, plannedDate: s.plannedDate, reviewDate: s.reviewDate } })),
  ];
}

// ---- 每回成績：沒填的 Part 是 null，不是 0 ----

export function partScore(r, k) {
  const v = r?.[k];
  return Number.isInteger(v) && v >= 0 && v <= PARTS[k].total ? v : null;
}

// 寫完但還沒對答案：done.p5 = true
export const partDone = (r, k) => partScore(r, k) !== null || !!r?.done?.[k];
export const answeredCount = (r) => PART_KEYS.reduce((n, k) => n + (partDone(r, k) ? PARTS[k].total : 0), 0);
export const isAnswered = (r) => PART_KEYS.every((k) => partDone(r, k));
export const hasStarted = (r) => PART_KEYS.some((k) => partDone(r, k));

export function accuracy(r) {
  const parts = {};
  let score = 0;
  let total = 0;
  const keys = [];
  for (const k of PART_KEYS) {
    const s = partScore(r, k);
    if (s === null) {
      parts[k] = null;
      continue;
    }
    parts[k] = { score: s, total: PARTS[k].total, pct: s / PARTS[k].total };
    score += s;
    total += PARTS[k].total;
    keys.push(k);
  }
  return { ...parts, all: total ? { score, total, pct: score / total, parts: keys } : null };
}

export const pctText = (x) => (x ? `${Math.round(x.pct * 100)}%` : '—');

export function roundStatus(r) {
  if (isAnswered(r)) return r?.reviewed ? 'reviewed' : 'answered';
  return hasStarted(r) ? 'partial' : 'todo';
}

export const STATUS_LABEL = { todo: '還沒寫', partial: '寫一部分', answered: '待檢討', reviewed: '檢討完' };

// 表單送出的值 → 存進 Firestore 的欄位（空白就是 null；超出範圍的擋下來）
export function cleanRecord(f) {
  const errors = [];
  const out = { done: {} };
  for (const k of PART_KEYS) {
    const raw = String(f[k] ?? '').trim();
    if (raw === '') out[k] = null;
    else {
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 0 || v > PARTS[k].total) {
        errors.push(`${PARTS[k].label} 答對題數要是 0～${PARTS[k].total}`);
        out[k] = null;
      } else out[k] = v;
    }
    out.done[k] = out[k] !== null || !!f.done?.[k];
  }
  const m = String(f.minutes ?? '').trim();
  if (m === '') out.minutes = null;
  else if (!/^\d+$/.test(m) || Number(m) > 600) errors.push('作答分鐘數要是 0～600 的整數');
  else out.minutes = Number(m);
  out.answeredDate = f.answeredDate || '';
  out.timed = f.timed === true ? true : f.timed === false ? false : null;
  out.checked = !!f.checked;
  // 「完成錯題檢討」由週六檢討的最後一步存，這裡不寫，免得舊表單蓋掉
  out.note = (f.note || '').trim();
  return { data: out, errors };
}

export function summary(rounds) {
  const list = schedule().map((s) => ({ ...s, ...(rounds[s.id] || {}) }));
  const answered = list.filter(isAnswered);
  const scored = list.filter((r) => accuracy(r).all);
  const latest = scored.sort((a, b) => (b.answeredDate || '').localeCompare(a.answeredDate || '') || b.round - a.round)[0] || null;
  return {
    completed: answered.length,
    questions: list.reduce((n, r) => n + answeredCount(r), 0),
    latest: latest ? { round: latest.round, acc: accuracy(latest).all } : null,
    pendingReview: answered.filter((r) => !r.reviewed).length,
    reviewed: answered.filter((r) => r.reviewed).length,
  };
}

// ---- 今天要做什麼 ----

export const WEEKDAY_TASKS = {
  1: { kind: 'cards', title: '複習 2～3 張閱讀錯誤卡', time: '5～10 分鐘' },
  2: { kind: 'sentence', title: '拆解一個長句', time: '5～10 分鐘' },
  3: { kind: 'grammar', title: '複習詞性、時態或子句', time: '5～10 分鐘' },
  4: { kind: 'recap', title: '回顧本週最常犯的錯', time: '5～10 分鐘' },
};

const FIRST_WEEK = weekStart(PLAN.start);

// 第幾週（1～12）；計畫開始那週之前是 0，結束之後大於 12
export function weekOf(t) {
  if (t < FIRST_WEEK) return 0;
  return Math.floor(diffDays(FIRST_WEEK, t) / 7) + 1;
}

// t：台灣日期；rounds：{ r01: {...} }。回傳 { phase, week, kind, round, catchUp, title, detail }
export function todayPlan(t, rounds) {
  const sch = schedule().map((s) => ({ ...s, ...(rounds[s.id] || {}) }));
  const wd = weekday(t);
  const week = weekOf(t);
  const firstOpen = sch.find((r) => !isAnswered(r)) || null;
  const thisRound = week >= 1 && week <= PLAN.rounds ? sch[week - 1] : null;
  const base = { week, wd, firstOpen, thisRound };

  if (t < PLAN.start) {
    return {
      ...base, phase: 'before', kind: wd === 0 ? 'rest' : 'before', round: sch[0],
      title: wd === 0 ? '計畫已建立，今天休息' : '計畫已建立，還沒開始',
      detail: `${shortLabel(PLAN.start)} 寫第 1 回，還有 ${diffDays(t, PLAN.start)} 天。`,
    };
  }
  if (t > PLAN.end) {
    if (firstOpen) {
      return {
        ...base, phase: 'after', kind: 'test', round: firstOpen, catchUp: true,
        title: `補寫第 ${firstOpen.round} 回`,
        detail: `原定 ${shortLabel(firstOpen.plannedDate)}，12 週已經過了，寫完再補登就好。`,
      };
    }
    return { ...base, phase: 'after', kind: 'finished', round: null, title: '12 回都寫完了', detail: '可以看趨勢，回頭複習錯題卡。' };
  }

  if (wd === 0) return { ...base, phase: 'active', kind: 'rest', round: thisRound, title: '今天休息', detail: '週日不派作業。' };

  if (wd === 5) {
    if (firstOpen && firstOpen.round < thisRound.round) {
      return {
        ...base, phase: 'active', kind: 'test', round: firstOpen, catchUp: true,
        title: `先補寫第 ${firstOpen.round} 回`,
        detail: `原定 ${shortLabel(firstOpen.plannedDate)}；這週原定第 ${thisRound.round} 回，補完再寫。`,
      };
    }
    if (isAnswered(thisRound)) {
      return { ...base, phase: 'active', kind: 'test', round: thisRound, done: true, title: `第 ${thisRound.round} 回寫完了`, detail: '明天早上整理錯題。' };
    }
    return {
      ...base, phase: 'active', kind: 'test', round: thisRound,
      title: `寫第 ${thisRound.round} 回（100 題）`,
      detail: thisRound.round <= 2
        ? `目標 ${PLAN.minutes} 分鐘，前兩回可以分幾次寫完。時間自己排。`
        : thisRound.round === 3
          ? `目標 ${PLAN.minutes} 分鐘，試著一次寫完。時間自己排。`
          : `一次寫完、計時 ${PLAN.minutes} 分鐘。時間自己排。`,
    };
  }

  if (wd === 6) {
    if (!hasStarted(thisRound)) {
      return {
        ...base, phase: 'active', kind: 'review-wait', round: thisRound,
        title: `第 ${thisRound.round} 回還沒寫`,
        detail: '還沒有錯題可以檢討。今天可以先寫或補登成績，寫完再檢討。',
      };
    }
    return {
      ...base, phase: 'active', kind: 'review', round: thisRound, done: !!thisRound.reviewed,
      title: thisRound.reviewed ? `第 ${thisRound.round} 回檢討完了` : `檢討第 ${thisRound.round} 回`,
      detail: thisRound.reviewed ? '這週的事都做完了。' : '30～45 分鐘：挑 3～5 題記下錯誤原因，1～3 個句型加入複習。',
    };
  }

  const task = WEEKDAY_TASKS[wd];
  return { ...base, phase: 'active', kind: 'weekday', task, round: thisRound, title: task.title, detail: task.time };
}

// ---- 錯題 ----

export function partOf(q) {
  const n = Number(q);
  return PART_KEYS.find((k) => n >= PARTS[k].from && n <= PARTS[k].to) || '';
}

export const mistakeId = (round, part, q) => `${roundId(round)}-${part}-q${q}`;

export function errorTypeCounts(mistakes) {
  const c = {};
  for (const m of mistakes) if (ERROR_TYPES[m.errorType]) c[m.errorType] = (c[m.errorType] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// 平日 5～10 分鐘的材料：只用之前回數真的錯過的題目和自己的卡片，沒有就回空的
export function weekdayMaterial(wd, { mistakes, cards, beforeRound, t }) {
  const past = mistakes.filter((m) => m.round < beforeRound).sort((a, b) => b.round - a.round || (a.q || 0) - (b.q || 0));
  const latestRound = past[0]?.round;
  if (wd === 1) {
    const mine = cards.filter((c) => (c.tags || []).includes(CARD_TAG));
    const due = mine.filter((c) => (c.due || '') <= t).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    const rest = mine.filter((c) => !due.includes(c)).sort((a, b) => (a.box || 0) - (b.box || 0));
    return { cards: [...due, ...rest].slice(0, 3), dueIds: due.map((c) => c.id) };
  }
  if (wd === 2) {
    const pick = past.filter((m) => m.errorType === 'long_sentence' && (m.reviewSentence || m.note));
    return { mistakes: pick.slice(0, 1).length ? pick.slice(0, 1) : past.filter((m) => m.reviewSentence).slice(0, 1) };
  }
  if (wd === 3) {
    return { mistakes: past.filter((m) => ['word_form', 'tense', 'clause'].includes(m.errorType)).slice(0, 3) };
  }
  if (wd === 4) {
    const recent = past.filter((m) => m.round === latestRound);
    const top = errorTypeCounts(recent)[0];
    return { top, round: latestRound, mistakes: top ? recent.filter((m) => m.errorType === top[0]).slice(0, 5) : [] };
  }
  return {};
}

// ---- 請 AI 解釋錯題：複製 prompt、貼回有版本號的 JSON ----

export const AI_VERSION = 1;
const REVIEW_KINDS = ['grammar', 'fix', 'sentence', 'word'];

export function mistakePrompt(items) {
  const lines = items.map((m) => {
    const head = `- 第 ${m.round} 回 Part ${PARTS[m.part]?.n} 第 ${m.q} 題，我認為的錯誤類型：${ERROR_TYPES[m.errorType] || '不確定'}`;
    const ask = (m.ask || '').trim();
    const note = (m.note || '').trim();
    return [head, note && `  我的筆記：${note}`, ask && `  我有疑問的地方：${ask}`].filter(Boolean).join('\n');
  });
  return `我在寫紙本《全新制 TOEIC 多益閱讀 1,200 題》，目前多益約 800 分、目標 850。我的弱點是長句結構、子句、時態、詞性和介係詞。
下面是我錯的題目和我的理解（題目原文我只貼了有疑問的部分）：

${lines.join('\n')}

請用繁體中文解釋我為什麼會錯、該抓哪個文法點。不要重寫或引用整題題目；reviewSentence 請你自己造一個新的英文句子（20 字以內），讓我練同一個文法點。

最後只輸出一個 json code block，格式如下，不要加其他欄位：
\`\`\`json
{
  "version": ${AI_VERSION},
  "items": [
    {
      "sourceRound": 1,
      "part": 5,
      "questionNumber": 112,
      "errorType": "word_form",
      "explanationZh": "空格前是冠詞、後面是名詞，要填形容詞……",
      "grammarPoint": "冠詞＋形容詞＋名詞",
      "suggestedReview": "grammar",
      "reviewSentence": "The company announced a significant increase in sales."
    }
  ]
}
\`\`\`
errorType 只能是：${Object.entries(ERROR_TYPES).map(([k, v]) => `${k}（${v}）`).join('、')}。
suggestedReview 只能是：grammar（文法卡）、fix（改錯卡）、sentence（句型卡）、word（單字卡）。`;
}

function extractJSON(text) {
  const t = (text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1];
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

const LABEL_TO_TYPE = Object.fromEntries(Object.entries(ERROR_TYPES).map(([k, v]) => [v, k]));

// 貼回來的 AI 回覆：先驗證，有錯的列出原因，不會動到原本的成績
export function parseAiReply(text) {
  let obj;
  try {
    obj = JSON.parse(extractJSON(text));
  } catch {
    return { error: '找不到 JSON。請把 AI 回覆裡的 json code block 整段貼上。', items: [] };
  }
  if (!obj || typeof obj !== 'object') return { error: '格式不對：要是一個 { "version": 1, "items": [...] } 物件。', items: [] };
  if (obj.version !== AI_VERSION) return { error: `version 要是 ${AI_VERSION}（貼上的是 ${JSON.stringify(obj.version ?? null)}）。`, items: [] };
  if (!Array.isArray(obj.items) || !obj.items.length) return { error: 'items 是空的。', items: [] };
  const items = obj.items.map((it, i) => {
    const errors = [];
    const round = Number(it?.sourceRound);
    if (!Number.isInteger(round) || round < 1 || round > PLAN.rounds) errors.push('sourceRound 要是 1～12');
    const pn = Number(String(it?.part ?? '').replace(/\D/g, ''));
    const part = [5, 6, 7].includes(pn) ? `p${pn}` : '';
    if (!part) errors.push('part 要是 5、6 或 7');
    const q = Number(it?.questionNumber);
    if (!Number.isInteger(q) || q < 1 || q > 200) errors.push('questionNumber 要是題號');
    else if (part && partOf(q) && partOf(q) !== part) errors.push(`第 ${q} 題不在 Part ${pn}`);
    const et = ERROR_TYPES[it?.errorType] ? it.errorType : LABEL_TO_TYPE[it?.errorType] || '';
    if (!et) errors.push(`不認得的 errorType「${it?.errorType ?? ''}」`);
    const str = (k) => (typeof it?.[k] === 'string' ? it[k].trim() : '');
    const explanationZh = str('explanationZh');
    if (!explanationZh) errors.push('explanationZh 是空的');
    const sr = str('suggestedReview').toLowerCase();
    return {
      i,
      round, part, q, errorType: et,
      explanationZh, grammarPoint: str('grammarPoint'),
      suggestedReview: REVIEW_KINDS.includes(sr) ? sr : 'grammar',
      reviewSentence: str('reviewSentence').slice(0, 400),
      errors,
      ok: !errors.length,
    };
  });
  return { error: null, items };
}

// 錯題 → 卡片庫的一張卡（照原本的 Leitner 間隔複習）
export function cardFromMistake(m, type = 'grammar') {
  const where = `第 ${m.round} 回 ${PARTS[m.part]?.label || ''} 第 ${m.q} 題・${ERROR_TYPES[m.errorType] || ''}`;
  const tags = [CARD_TAG, `第${m.round}回`];
  const explain = m.explanationZh || m.note || '';
  if (type === 'fix' || type === 'sentence') {
    return { type, front: m.reviewSentence || m.grammarPoint || m.note || where, back: explain, example: '', tags, source: 'toeic', note: where };
  }
  if (type === 'word') {
    return { type: 'word', front: m.grammarPoint || m.note || where, back: explain, example: m.reviewSentence || '', tags, source: 'toeic', note: where };
  }
  return { type: 'grammar', front: m.grammarPoint || m.note || ERROR_TYPES[m.errorType] || where, back: explain, example: m.reviewSentence || '', tags, source: 'toeic', note: where };
}

// ---- 趨勢 ----

export function trendRows(rounds) {
  return schedule().map((s) => {
    const r = { ...s, ...(rounds[s.id] || {}) };
    return { round: s.round, status: roundStatus(r), acc: accuracy(r), minutes: Number.isInteger(r.minutes) ? r.minutes : null, timed: r.timed };
  });
}
