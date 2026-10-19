import { addDays, weekday, diffDays } from './date.js';
import { PART2, PART34, FREE_TALK_PROMPTS, INTERVIEW_QUESTIONS } from '../data/listeningBank.js';

// 每日英文任務：依每週課表，一天只派一個主任務，題目在第一次打開時挑好並存進 englishMission/{台灣日期}，
// 之後重整、換手機都讀同一份。不呼叫任何 AI；挑題只看日期和自己的作答紀錄。
// 星期五、六接「12 週 TOEIC 閱讀計畫」（src/lib/toeic.js），星期日休息，這三天不建任務文件。

export const KINDS = {
  freetalk: { label: 'Free Talk 英文自由口說', short: 'Free Talk', minutes: 10, doc: true },
  part2: { label: 'TOEIC Part 2 聽力', short: 'Part 2', minutes: 15, doc: true },
  part34: { label: 'TOEIC Part 3／4 聽力', short: 'Part 3/4', minutes: 25, doc: true },
  interview: { label: 'BA／PM 英文模擬面試', short: '面試', minutes: 10, doc: true },
  toeic_read: { label: '紙本多益閱讀（12 週計畫）', short: '紙本多益', minutes: 75, doc: false },
  toeic_review: { label: '檢討錯題、挑下週弱點', short: '檢討', minutes: 40, doc: false },
  rest: { label: '休息', short: '休息', minutes: 0, doc: false },
};

// 0 = 星期日 … 6 = 星期六
export const DEFAULT_SCHEDULE = {
  1: { kind: 'freetalk', time: '21:30' },
  2: { kind: 'part2', time: '21:30' },
  3: { kind: 'part34', time: '21:30' },
  4: { kind: 'interview', time: '21:30' },
  5: { kind: 'toeic_read', time: '21:00' },
  6: { kind: 'toeic_review', time: '10:00' },
  0: { kind: 'rest', time: '' },
};

export const SCHEDULE_KINDS = ['freetalk', 'part2', 'part34', 'interview', 'toeic_read', 'toeic_review', 'rest'];

// settings/englishSchedule 只存改過的天；沒有文件就是預設課表
export function getSchedule(saved) {
  const out = {};
  for (let wd = 0; wd < 7; wd++) {
    const s = saved?.days?.[wd];
    const base = DEFAULT_SCHEDULE[wd];
    out[wd] = KINDS[s?.kind] ? { kind: s.kind, time: s.kind === 'rest' ? '' : s.time || base.time || '21:30' } : { ...base };
  }
  return out;
}

export function slotFor(date, schedule) {
  const wd = weekday(date);
  const s = schedule[wd];
  return { ...s, wd, ...KINDS[s.kind], kindLabel: KINDS[s.kind].label };
}

// ---- 固定的亂數：同一天、同一份紀錄一定挑到同樣的題目 ----

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- 從紀錄算弱點 ----

// history：之前的任務文件（新的在前或後都可以）。回傳 { tag: { c, t } }，只算做完的
export function tagStats(history, kind) {
  const out = {};
  for (const m of history || []) {
    if (m.status !== 'done' || (kind && m.kind !== kind)) continue;
    for (const [tag, v] of Object.entries(m.result?.byTag || {})) {
      out[tag] = out[tag] || { c: 0, t: 0 };
      out[tag].c += v.c;
      out[tag].t += v.t;
    }
  }
  return out;
}

// 最近 4 次同類任務的正確率；沒有紀錄回 null（不假設程度）
export function recentAccuracy(history, kind, n = 4) {
  const done = (history || []).filter((m) => m.kind === kind && m.status === 'done' && m.result?.total).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  if (!done.length) return null;
  const c = done.reduce((s, m) => s + m.result.correct, 0);
  const t = done.reduce((s, m) => s + m.result.total, 0);
  return c / t;
}

// 正確率越低的題型越常被抽到；作答不到 3 題的題型當作沒有資料（權重 1）
export function tagWeights(stats) {
  const w = {};
  for (const [tag, v] of Object.entries(stats)) {
    if (v.t < 3) continue;
    const acc = v.c / v.t;
    w[tag] = acc < 0.6 ? 3 : acc < 0.8 ? 2 : 1;
  }
  return w;
}

const usedIds = (history) => new Set((history || []).flatMap((m) => m.resourceIds || []));

// 難度：最近正確率 85% 以上往難一點，60% 以下往簡單一點，沒有紀錄就用 2
export function targetLevel(acc) {
  if (acc === null) return 2;
  if (acc >= 0.85) return 3;
  if (acc < 0.6) return 1;
  return 2;
}

// 從題庫挑 n 題：先挑沒做過的；弱點題型加權；同難度優先；最後打亂順序
export function pickItems(pool, n, { seed, history, kind }) {
  const rand = rng(seed);
  const used = usedIds(history);
  const fresh = pool.filter((x) => !used.has(x.id));
  // 題庫用完一輪就從最久以前做過的開始重複
  let candidates = fresh;
  if (fresh.length < n) {
    const order = (history || []).slice().sort((a, b) => a.date.localeCompare(b.date)).flatMap((m) => m.resourceIds || []);
    const oldest = pool.filter((x) => used.has(x.id)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    candidates = [...fresh, ...oldest.slice(0, n - fresh.length)];
  }
  const weights = tagWeights(tagStats(history, kind));
  const level = targetLevel(recentAccuracy(history, kind));
  const scored = candidates.map((x) => {
    const tags = x.tags || [x.tag];
    const w = Math.max(1, ...tags.map((t) => weights[t] || 1));
    const lv = x.level === level ? 1.5 : Math.abs((x.level || 2) - level) === 1 ? 1 : 0.6;
    return { x, key: rand() ** (1 / (w * lv)) };
  });
  scored.sort((a, b) => b.key - a.key);
  return shuffle(scored.slice(0, n).map((s) => s.x), rand);
}

export const PART2_COUNT = 12;
export const PART34_SETS = { conversation: 2, talk: 1 };

// 星期一、四的題目輪流：照日期排，最近用過的不重複
function pickPrompt(pool, date, history, kind) {
  const used = new Set((history || []).filter((m) => m.kind === kind).map((m) => m.prompt?.id));
  const fresh = pool.filter((p) => !used.has(p.id));
  const list = fresh.length ? fresh : pool;
  return list[hashStr(date + kind) % list.length];
}

// 建立當天的任務（純資料，不寫資料庫）
export function buildMission(date, schedule, history = []) {
  const slot = slotFor(date, schedule);
  if (!slot.doc) return null;
  const seed = hashStr(`${date}|${slot.kind}`);
  const base = {
    date, weekday: slot.wd, kind: slot.kind, title: slot.label, minutes: slot.minutes, scheduledTime: slot.time,
    status: 'ready', source: 'bank', answers: {}, createdAtMs: Date.now(),
  };
  if (slot.kind === 'part2') {
    const items = pickItems(PART2, PART2_COUNT, { seed, history, kind: 'part2' });
    return { ...base, resourceIds: items.map((x) => x.id), items };
  }
  if (slot.kind === 'part34') {
    const convs = pickItems(PART34.filter((s) => s.type === 'conversation'), PART34_SETS.conversation, { seed, history, kind: 'part34' });
    const talks = pickItems(PART34.filter((s) => s.type === 'talk'), PART34_SETS.talk, { seed: seed + 1, history, kind: 'part34' });
    const items = [...convs, ...talks];
    return { ...base, resourceIds: items.map((x) => x.id), items };
  }
  const pool = slot.kind === 'interview' ? INTERVIEW_QUESTIONS : FREE_TALK_PROMPTS;
  const prompt = pickPrompt(pool, date, history, slot.kind);
  return { ...base, resourceIds: [prompt.id], prompt };
}

// ---- 作答與計分 ----

// 每一題的 key：Part 2 是題目 id；Part 3/4 是「組 id#第幾題」
export function questionList(mission) {
  if (mission.kind === 'part2') return mission.items.map((x) => ({ key: x.id, answer: x.answer, tag: x.tag }));
  if (mission.kind === 'part34') {
    return mission.items.flatMap((set) => set.questions.map((q, i) => ({ key: `${set.id}#${i}`, answer: q.answer, tag: q.tag })));
  }
  return [];
}

export function grade(mission, answers) {
  const qs = questionList(mission);
  const byTag = {};
  const wrong = [];
  let correct = 0;
  for (const q of qs) {
    const ok = answers[q.key] === q.answer;
    byTag[q.tag] = byTag[q.tag] || { c: 0, t: 0 };
    byTag[q.tag].t += 1;
    if (ok) {
      correct += 1;
      byTag[q.tag].c += 1;
    } else wrong.push({ key: q.key, tag: q.tag, chosen: answers[q.key] ?? null, answer: q.answer });
  }
  return { correct, total: qs.length, byTag, wrong };
}

export const answeredAll = (mission, answers) => questionList(mission).every((q) => answers[q.key] !== undefined);

// ---- 狀態：延後、跳過、補做 ----

export const STATUS_LABEL = { ready: '還沒開始', in_progress: '做到一半', done: '完成', skipped: '跳過' };

// 最近 7 天還沒做完、也沒跳過的任務（今天的不算），可以補做
export function pendingMissions(history, t) {
  return (history || [])
    .filter((m) => m.date < t && diffDays(m.date, t) <= 7 && !['done', 'skipped'].includes(m.status))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// 延後到明天：原本那天的任務保留（題目不變），標 postponedTo，明天首頁會一起顯示
export const postponeTo = (t) => addDays(t, 1);

// 本週（週一到週日）做完幾個、花幾分鐘
export function weekSummary(history, monday) {
  const end = addDays(monday, 6);
  const list = (history || []).filter((m) => m.date >= monday && m.date <= end);
  const done = list.filter((m) => m.status === 'done');
  return { done: done.length, total: list.length, minutes: done.reduce((s, m) => s + (m.result?.minutes || m.minutes || 0), 0) };
}

// 題型的中文名稱
export const TAG_LABEL = {
  wh: 'Wh 問句', yesno: 'Yes/No 問句', indirect: '間接問句', request: '請求／建議', statement: '直述句', choice: '選擇疑問句', tag: '附加問句',
  main: '主旨', detail: '細節', inference: '推論', next: '下一步', intent: '說話者意圖', graphic: '圖表',
};
