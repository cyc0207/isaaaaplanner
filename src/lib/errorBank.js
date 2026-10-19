// 個人口說錯誤庫（Personal Speaking Error Bank）：ChatGPT 批改結果 JSON 的檢查、預覽、去重、寫入，和統計
// 錯誤卡、片語卡都存在原本的 englishItems（type fix / phrase），沿用同一套 Leitner 複習，不另做 SRS。
// 練習紀錄（原始逐字稿）存在 users/{uid}/speakImports/{imp-雜湊}，不放進全域訂閱。
import { addDays, isValidDateStr } from './date.js';
import { itemKey, newItem } from './english.js';

export const SCHEMA_VERSION = 1;

export const ERROR_CATEGORIES = {
  grammar: '文法',
  wordForm: '詞性',
  collocation: '搭配詞',
  preposition: '介係詞',
  tense: '時態',
  sentenceStructure: '句子結構',
  vocabulary: '用字',
  naturalExpression: '自然說法',
  fillerWords: '填充詞',
  other: '其他',
};

export const PHRASE_TAGS = ['Daily Conversation', 'Career', 'BA / PM', 'Technology', 'Personal Reflection', 'Interview'];

// 證據等級：只有 transcript（逐字稿裡找得到）和 userReported（你自己列的）會算進出現次數
// excerpt：ChatGPT 交換格式標明是逐字稿逐句摘錄（verifiedOriginal），但沒附完整逐字稿可以比對
export const EVIDENCE = {
  transcript: '逐字稿裡的原句',
  excerpt: '逐字稿摘錄',
  userReported: '你自己列的',
  unverified: '未核對（逐字稿裡找不到）',
};
export const counts = (o) => o.evidence === 'transcript' || o.evidence === 'excerpt' || o.evidence === 'userReported';

export const STATUS = { new: '新的', learning: '學習中', mastered: '已學會' };
// 盒子 4 以上（下次 14 天後）算學會
export const MASTERED_BOX = 4;
export const bankStatus = (box, reps) => (!reps ? 'new' : box >= MASTERED_BOX ? 'mastered' : 'learning');

const clip = (s, n) => {
  const t = String(s ?? '').trim();
  return t.length > n ? t.slice(0, n) : t;
};

// 比對用：小寫、統一引號、去掉標點和省略號、空白合併
export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…|\.{3}/g, ' ')
    .replace(/[^a-z0-9'\s一-鿿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 穩定雜湊（cyrb53），當文件 ID 用：同一筆資料每次算出來都一樣
export function hash(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const sessionKey = (s) => (s.sourceId ? `id:${norm(s.sourceId)}` : `${s.date}|${norm(s.topic)}|${s.round ?? ''}`);
export const sessionDocId = (s) => `imp-${hash(sessionKey(s))}`;
// 錯誤的去重鍵：有給 pattern（例如 That's meaning → That means）就用它，沒有就用「原句→修正」
// recurrenceGroup（例如 that_means）優先：之後別次練習同一組的錯誤會加到同一張卡
export const errorKeyOf = (e) =>
  e.recurrenceGroup ? `g:${norm(e.recurrenceGroup)}` : e.pattern ? `p:${norm(e.pattern)}` : `s:${norm(e.verifiedOriginal)}→${norm(e.suggestedCorrection)}`;
export const errorDocId = (key) => `err-${hash(key)}`;
export const phraseKeyOf = (p) => norm(p);
export const phraseDocId = (key) => `phr-${hash(key)}`;
const occKey = (sessionId, text) => `${sessionId}|${norm(text)}`;

// ---- 1. 從貼上的文字取出 JSON ----
export function parseImportText(text) {
  const raw = String(text ?? '').replace(/^﻿/, '').trim();
  if (!raw) return { error: '沒有貼上任何內容。' };
  const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1].trim());
  const candidate = fenced.length ? fenced.find((c) => c.startsWith('{')) || fenced[0] : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  if (!candidate || !candidate.startsWith('{')) return { error: '找不到 JSON：內容要用 { 開頭、} 結尾（可以包在 ```json 區塊裡）。' };
  try {
    return { data: JSON.parse(candidate) };
  } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    const where = m ? `，大約在第 ${candidate.slice(0, Number(m[1])).split('\n').length} 行` : '';
    return { error: `JSON 格式錯誤${where}：${e.message}。常見原因：少了逗號、多了最後一個逗號、用了中文引號。` };
  }
}

const strList = (v, n = 10) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => clip(typeof x === 'string' ? x : JSON.stringify(x), 600)).filter(Boolean).slice(0, n);

// ---- 1b. ChatGPT 交換格式（schemaVersion "1.0.0"、datasetId、errors[].id、reusableExpressions）→ App 的格式 ----
// 交換格式不保證和 App 一樣：只在這裡做對應，其他流程（預覽、去重、寫入）都共用
export const isExchange = (obj) => !!obj && typeof obj === 'object' && typeof obj.datasetId === 'string' && /^1(\.\d+){0,2}$/.test(String(obj.schemaVersion)) && obj.schemaVersion !== 1;

export function fromExchange(obj) {
  const ss = Array.isArray(obj.sessions) ? obj.sessions : [];
  const s0 = ss[0] || {};
  const topics = Array.isArray(s0.topics) ? s0.topics : [];
  const topicTitle = Object.fromEntries(topics.map((x) => [x?.id, x?.title]));
  const ext = (id) => (id ? `${obj.datasetId}:${id}` : '');
  const rec = obj.reviewRecommendation || {};
  // 10/18 版叫 priorityErrorIds／dailyNewCardLimit，10/19 版叫 topErrorIds／dailyLimit，兩種都收
  const prio = [rec.priorityErrorIds, rec.topErrorIds].find(Array.isArray) || [];
  const perDay = rec.dailyNewCardLimit ?? rec.dailyLimit;
  return {
    schemaVersion: SCHEMA_VERSION,
    format: 'exchange',
    datasetId: obj.datasetId,
    session: {
      sourceId: `ex:${s0.id || obj.datasetId}`,
      date: s0.date,
      topic: topics.map((x) => x?.title).filter(Boolean).join('、') || s0.id,
      round: null,
      transcript: s0.rawTranscriptIncluded && typeof s0.rawTranscript === 'string' ? s0.rawTranscript : '',
      // 沒附完整逐字稿：原句是 ChatGPT 標明的逐句摘錄
      excerptOnly: !s0.rawTranscriptIncluded,
      importNotes: [obj.notesZh, s0.rawTranscriptNoteZh].filter(Boolean),
      extraSessions: ss.length - 1,
    },
    newPerDay: Number.isInteger(perDay) && perDay > 0 ? perDay : 0,
    errors: (Array.isArray(obj.errors) ? obj.errors : []).map((e) => ({
      ...e,
      externalId: ext(e?.id),
      sourceTopic: e?.sourceTopic || topicTitle[e?.sourceRoundId] || '',
      round: e?.sourceRoundId || '',
      reviewPriority: prio.includes(e?.id) ? prio.indexOf(e.id) + 1 : Number.isInteger(e?.reviewPriority) ? e.reviewPriority : null,
    })),
    phrases: (Array.isArray(obj.reusableExpressions) ? obj.reusableExpressions : []).map((p) => ({
      ...p,
      externalId: ext(p?.id),
      tags: p?.tags || (p?.contextTag ? [p.contextTag] : []),
      kind: p?.sourceType === 'inferredExpression' ? 'inferredExpression' : 'reusablePhrase',
      usage: p?.usage || '',
      addToSrs: p?.addToSrs !== false,
      sourceTopic: p?.sourceTopic || '',
    })),
  };
}

// ---- 2. 檢查格式（schemaVersion 1）----
// 回傳 fatal（整份不能匯入的原因）、warnings，和整理好的 session / errors / phrases
export function validateImport(input) {
  const fatal = [];
  const warnings = [];
  const obj = isExchange(input) ? fromExchange(input) : input;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { fatal: ['最外層要是一個物件 { … }。'], warnings, errors: [], phrases: [] };
  if (obj.schemaVersion !== SCHEMA_VERSION) fatal.push(`schemaVersion 要是 ${SCHEMA_VERSION}（現在是 ${JSON.stringify(obj.schemaVersion)}）。`);
  const s0 = obj.session;
  if (!s0 || typeof s0 !== 'object') fatal.push('缺少 session（練習日期、主題、逐字稿）。');
  const s = s0 && typeof s0 === 'object' ? s0 : {};
  if (!isValidDateStr(s.date)) fatal.push(`session.date 要是 YYYY-MM-DD 格式（現在是 ${JSON.stringify(s.date)}）。`);
  if (!clip(s.topic, 200)) fatal.push('session.topic（主題）是空的。');
  if (s.round != null && !(Number.isInteger(s.round) && s.round > 0)) warnings.push(`session.round 應該是正整數（現在是 ${JSON.stringify(s.round)}），先當作沒有 Round。`);
  if (obj.errors != null && !Array.isArray(obj.errors)) fatal.push('errors 要是陣列 [ … ]。');
  if (obj.phrases != null && !Array.isArray(obj.phrases)) fatal.push('phrases 要是陣列 [ … ]。');
  const kind = s.kind === 'userList' ? 'userList' : 'practice';
  const excerptOnly = !!s.excerptOnly;
  if (obj.format === 'exchange') {
    warnings.push(`ChatGPT 交換格式（資料集 ${obj.datasetId}），已經對應成 App 的欄位。`);
    if (s.extraSessions > 0) fatal.push(`這份有 ${s.extraSessions + 1} 個 sessions，目前一次只能匯入一個，請分開匯入。`);
  }
  const session = {
    sourceId: clip(s.sourceId, 200),
    kind,
    date: s.date,
    topic: clip(s.topic, 200),
    round: Number.isInteger(s.round) && s.round > 0 ? s.round : null,
    transcript: clip(s.transcript, 30000),
    correctedTranscript: clip(s.correctedTranscript, 30000),
    grammarNotes: strList(s.grammarNotes, 30),
    vocabularyNotes: strList(s.vocabularyNotes, 30),
    phraseNotes: strList(s.phraseNotes, 30),
    logicNotes: strList(s.logicNotes, 30),
    importNotes: strList(s.importNotes, 5),
    excerptOnly,
    format: obj.format === 'exchange' ? 'exchange' : 'app',
    datasetId: clip(obj.datasetId, 200),
    newPerDay: obj.newPerDay || 0,
  };
  if (excerptOnly) warnings.push('沒有附完整逐字稿：原句是 ChatGPT 標明的逐句摘錄（verifiedOriginal），會標「逐字稿摘錄」並算 1 次；修正句一律是建議。');
  else if (kind === 'practice' && !session.transcript) warnings.push('沒有附逐字稿（session.transcript）：錯誤原句沒辦法核對，會標成「未核對」，不算進出現次數。');

  const errors = (Array.isArray(obj.errors) ? obj.errors : []).map((e, i) => {
    const problems = [];
    const e0 = e && typeof e === 'object' ? e : {};
    const row = {
      index: i,
      verifiedOriginal: clip(e0.verifiedOriginal, 600),
      suggestedCorrection: clip(e0.suggestedCorrection, 600),
      pattern: clip(e0.pattern, 200),
      errorCategory: ERROR_CATEGORIES[e0.errorCategory] ? e0.errorCategory : 'other',
      explanationZh: clip(e0.explanationZh, 800),
      examples: strList(e0.examples, 5),
      inferredExpression: clip(e0.inferredExpression, 400),
      recurrenceGroup: clip(e0.recurrenceGroup, 100),
      externalId: clip(e0.externalId, 300),
      sourceTopic: clip(e0.sourceTopic, 200),
      round: clip(e0.round, 100),
      reviewPriority: Number.isInteger(e0.reviewPriority) && e0.reviewPriority > 0 ? e0.reviewPriority : null,
      semanticInference: e0.semanticInference === true,
      declaredOriginal: e0.sourceType === undefined || e0.sourceType === 'verifiedOriginal',
      problems,
      notes: [],
    };
    if (!e || typeof e !== 'object') problems.push('這一筆不是物件');
    if (!row.verifiedOriginal) problems.push('verifiedOriginal（我的原句）是空的');
    if (!row.suggestedCorrection) problems.push('suggestedCorrection（建議修正）是空的');
    if (row.verifiedOriginal && norm(row.verifiedOriginal) === norm(row.suggestedCorrection)) problems.push('原句和修正一模一樣');
    if (e0.errorCategory && !ERROR_CATEGORIES[e0.errorCategory]) row.notes.push(`不認得的類型「${e0.errorCategory}」，先放「其他」`);
    if (!e0.errorCategory) row.notes.push('沒給類型，先放「其他」');
    if (row.semanticInference) row.notes.push('修正是依語意推測（原句可能是語音辨識錯字），請自己確認原意');
    if (!row.declaredOriginal) row.notes.push(`sourceType 是「${e0.sourceType}」，不是你的原句：不算出現次數`);
    return row;
  });

  const phrases = (Array.isArray(obj.phrases) ? obj.phrases : []).map((p, i) => {
    const p0 = p && typeof p === 'object' ? p : {};
    const tags = strList(p0.tags, 6);
    const row = {
      index: i,
      phrase: clip(p0.phrase, 300),
      meaningZh: clip(p0.meaningZh, 300),
      usage: clip(p0.usage, 400),
      example: clip(p0.example, 400),
      tags,
      kind: p0.kind === 'inferredExpression' ? 'inferredExpression' : 'reusablePhrase',
      addToSrs: p0.addToSrs !== false,
      externalId: clip(p0.externalId, 300),
      isSuggestedSupplement: p0.isSuggestedSupplement === true,
      problems: [],
      notes: [],
    };
    if (!p || typeof p !== 'object') row.problems.push('這一筆不是物件');
    if (!row.phrase) row.problems.push('phrase（英文片語）是空的');
    const odd = tags.filter((x) => !PHRASE_TAGS.includes(x));
    if (odd.length) row.notes.push(`自訂標籤：${odd.join('、')}`);
    return row;
  });
  if (!fatal.length && !errors.length && !phrases.length) fatal.push('errors 和 phrases 都是空的，沒有東西可以匯入。');
  return { fatal, warnings, session, errors, phrases };
}

// 在逐字稿裡找得到原句嗎（忽略大小寫、標點）
export function inTranscript(transcript, text) {
  const t = norm(text);
  return !!t && ` ${norm(transcript)} `.includes(` ${t} `);
}

const tokens = (s) => new Set(norm(s).split(' ').filter(Boolean));
function similar(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return false;
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / (A.size + B.size - both) >= 0.75;
}

export const bankErrors = (items) => (items || []).filter((it) => it.bank === 'error');
export const bankPhrases = (items) => (items || []).filter((it) => it.bank === 'phrase');

// ---- 3. 預覽：每一筆標成 new（新卡）/ linked（加到現有卡）/ same（已經有了）/ similar（疑似重複）/ invalid ----
export const ROW_STATUS = { new: '新的', linked: '加到現有卡', same: '已經匯入過', similar: '疑似重複', invalid: '有錯' };

export function buildBankPreview(obj, items, existingSession = null) {
  const v = validateImport(obj);
  if (v.fatal.length) return { fatal: v.fatal, warnings: v.warnings, session: null, errors: [], phrases: [] };
  const sessionId = sessionDocId(v.session);
  const warnings = [...v.warnings];
  const session = { ...v.session, id: sessionId, exists: !!existingSession };
  if (existingSession) {
    warnings.push('這次練習已經匯入過：不會再建一筆紀錄，已經有的錯誤和片語會自動略過。');
    if (existingSession.transcript && session.transcript && norm(existingSession.transcript) !== norm(session.transcript)) {
      warnings.push('這次貼的逐字稿和之前存的不一樣：保留原本的逐字稿，不會覆蓋。');
    }
  }
  // 核對原句用的逐字稿：已存的優先（原始逐字稿不覆蓋）
  const transcript = existingSession?.transcript || session.transcript;

  const errCards = bankErrors(items);
  const byKey = Object.fromEntries(errCards.map((it) => [it.errorKey, it]));
  const allFix = (items || []).filter((it) => it.type === 'fix');
  const batchOcc = new Set();
  const errors = v.errors.map((r) => {
    if (r.problems.length) return { ...r, status: 'invalid', selected: false };
    const key = errorKeyOf(r);
    const evidence = session.kind === 'userList' ? 'userReported'
      : inTranscript(transcript, r.verifiedOriginal) ? 'transcript'
        : session.excerptOnly && r.declaredOriginal ? 'excerpt' : 'unverified';
    const notes = [...r.notes];
    if (evidence === 'unverified') notes.push('原句在逐字稿裡找不到，會存成「未核對」，不算出現次數');
    const ok = occKey(sessionId, r.verifiedOriginal);
    const base = { ...r, key, docId: errorDocId(key), evidence, notes };
    if (batchOcc.has(ok)) return { ...base, status: 'same', selected: false, notes: [...notes, '這份 JSON 裡重複出現，只算一次'] };
    batchOcc.add(ok);
    // datasetId + item.id 已經匯入過（就算修正句改了）也算同一筆
    const byExt = r.externalId && errCards.find((it) => (it.occurrences || []).some((o) => o.externalId === r.externalId));
    if (byExt) return { ...base, status: 'same', selected: false, target: byExt.id };
    const hit = byKey[key];
    if (hit) {
      if ((hit.occurrences || []).some((o) => occKey(o.sessionId, o.text) === ok)) return { ...base, status: 'same', selected: false, target: hit.id };
      return { ...base, status: 'linked', selected: true, target: hit.id, targetText: hit.correctedText };
    }
    const look = allFix.find((it) => itemKey('fix', it.front) === itemKey('fix', r.verifiedOriginal))
      || errCards.find((it) => it.errorCategory === r.errorCategory && similar(it.correctedText, r.suggestedCorrection));
    if (look) return { ...base, status: 'similar', selected: false, target: look.id, targetText: `${look.front} → ${look.back}` };
    return { ...base, status: 'new', selected: true };
  });

  const phraseCards = bankPhrases(items);
  const pByKey = Object.fromEntries(phraseCards.map((it) => [it.phraseKey, it]));
  const batchP = new Set();
  const phrases = v.phrases.map((r) => {
    if (r.problems.length) return { ...r, status: 'invalid', selected: false };
    const key = phraseKeyOf(r.phrase);
    const base = { ...r, key, docId: phraseDocId(key) };
    if (batchP.has(key)) return { ...base, status: 'same', selected: false, notes: [...r.notes, '這份 JSON 裡重複出現'] };
    batchP.add(key);
    const byExt = r.externalId && phraseCards.find((it) => (it.sources || []).some((x) => x.externalId === r.externalId));
    if (byExt) return { ...base, status: 'same', selected: false, target: byExt.id };
    const hit = pByKey[key];
    if (hit) {
      if ((hit.sources || []).some((x) => x.sessionId === sessionId)) return { ...base, status: 'same', selected: false, target: hit.id };
      return { ...base, status: 'linked', selected: true, target: hit.id, targetText: hit.front };
    }
    const look = (items || []).find((it) => it.front && norm(it.front) === key)
      || phraseCards.find((it) => { const k = it.phraseKey || ''; return Math.min(k.length, key.length) >= 8 && (k.includes(key) || key.includes(k)); });
    if (look) return { ...base, status: 'similar', selected: false, target: look.id, targetText: look.front };
    return { ...base, status: 'new', selected: true };
  });
  return { fatal: [], warnings, session, errors, phrases };
}

// ---- 4. 確認後要寫的資料（給 api.batch）。同一份再按一次也不會多出東西 ----
export function bankImportOps(preview, items, t, nowMs = Date.now(), existingSession = null) {
  const { session } = preview;
  const ops = [];
  const src = { sessionId: session.id, date: session.date, topic: session.topic, round: session.round };
  const pickedE = preview.errors.filter((r) => r.selected && r.status !== 'invalid' && r.status !== 'same');
  const pickedP = preview.phrases.filter((r) => r.selected && r.status !== 'invalid' && r.status !== 'same');
  if (!pickedE.length && !pickedP.length && existingSession) return { ops, summary: { errors: 0, linked: 0, phrases: 0 } };

  if (!existingSession) {
    const { exists, id, ...data } = session; // eslint-disable-line no-unused-vars
    ops.push({ add: 'speakImports', id, data: { ...data, schemaVersion: SCHEMA_VERSION, sessionKey: sessionKey(session), importedAtMs: nowMs, createdAtMs: nowMs } });
  } else {
    // 已經有紀錄：原始逐字稿不覆蓋，只補空的欄位
    const fill = {};
    for (const k of ['transcript', 'correctedTranscript']) if (!existingSession[k] && session[k]) fill[k] = session[k];
    for (const k of ['grammarNotes', 'vocabularyNotes', 'phraseNotes', 'logicNotes']) if (!(existingSession[k] || []).length && session[k].length) fill[k] = session[k];
    ops.push({ set: `speakImports/${session.id}`, data: { ...fill, lastImportedAtMs: nowMs } });
  }

  const byId = Object.fromEntries((items || []).map((it) => [it.id, it]));
  // 同一批裡同一個去重鍵有好幾句原句：放在同一張卡
  const fresh = {};
  const linked = {};
  for (const r of pickedE) {
    const occ = {
      ...src, topic: r.sourceTopic || session.topic, round: r.round || session.round, text: r.verifiedOriginal, evidence: r.evidence, importedAtMs: nowMs,
      ...(r.externalId ? { externalId: r.externalId } : {}),
    };
    if (r.status === 'linked' && byId[r.target]) {
      const cur = linked[r.target] || byId[r.target].occurrences || [];
      linked[r.target] = [...cur, occ];
      continue;
    }
    // new 或 similar（你勾了「還是要分開存」）
    const id = r.status === 'similar' ? errorDocId(`${r.key}|${session.id}`) : r.docId;
    if (fresh[id]) {
      fresh[id].occurrences.push(occ);
      continue;
    }
    fresh[id] = {
      ...newItem({
        type: 'fix', front: r.verifiedOriginal, back: r.suggestedCorrection, example: r.examples[0] || '',
        note: r.explanationZh, tags: ['錯誤庫', ERROR_CATEGORIES[r.errorCategory]], source: 'errorBank',
      }, t),
      bank: 'error',
      errorKey: r.status === 'similar' ? `${r.key}|${session.id}` : r.key,
      originalText: r.verifiedOriginal,
      correctedText: r.suggestedCorrection,
      explanationZh: r.explanationZh,
      errorCategory: r.errorCategory,
      pattern: r.pattern,
      examples: r.examples,
      inferredExpression: r.inferredExpression,
      sourceTopic: r.sourceTopic || session.topic,
      sourceDate: session.date,
      sourceSessionId: session.id,
      recurrenceGroup: r.recurrenceGroup,
      reviewPriority: r.reviewPriority,
      semanticInference: r.semanticInference,
      status: 'new',
      occurrences: [occ],
      createdAtMs: nowMs,
    };
  }
  // 有 dailyNewCardLimit 時：優先項目今天複習，其他新卡每天 N 張往後排，不會一次塞爆
  const per = session.newPerDay || 0;
  let slot = 0;
  const nextDue = () => (per ? addDays(t, 1 + Math.floor(slot++ / per)) : t);
  const freshList = Object.entries(fresh).sort((a, b) => (a[1].reviewPriority || 99) - (b[1].reviewPriority || 99));
  for (const [id, data] of freshList) {
    const occurrenceCount = data.occurrences.filter(counts).length;
    const due = data.reviewPriority ? t : nextDue();
    ops.push({ add: 'englishItems', id, data: { ...data, due, occurrenceCount, lastSeenDate: session.date } });
  }
  for (const [id, occurrences] of Object.entries(linked)) {
    const prev = byId[id];
    ops.push({
      set: `englishItems/${id}`,
      data: {
        occurrences,
        occurrenceCount: occurrences.filter(counts).length,
        lastSeenDate: [prev.lastSeenDate || '', session.date].sort().pop(),
      },
    });
  }

  let phrasesNew = 0;
  for (const r of pickedP) {
    if (r.status === 'linked' && byId[r.target]) {
      ops.push({ set: `englishItems/${r.target}`, data: { sources: [...(byId[r.target].sources || []), { ...src, ...(r.externalId ? { externalId: r.externalId } : {}) }] } });
      continue;
    }
    phrasesNew++;
    const id = r.status === 'similar' ? phraseDocId(`${r.key}|${session.id}`) : r.docId;
    ops.push({
      add: 'englishItems',
      id,
      data: {
        ...newItem({
          type: 'phrase', front: r.phrase, back: r.meaningZh, example: r.example, note: r.usage,
          tags: r.tags.length ? r.tags : ['錯誤庫'], source: 'errorBank',
        }, t),
        due: r.addToSrs ? nextDue() : t,
        bank: 'phrase',
        phraseKey: r.status === 'similar' ? `${r.key}|${session.id}` : r.key,
        meaningZh: r.meaningZh,
        usage: r.usage,
        kind: r.kind,
        srs: r.addToSrs,
        isSuggestedSupplement: r.isSuggestedSupplement,
        sources: [{ ...src, ...(r.externalId ? { externalId: r.externalId } : {}) }],
        status: 'new',
        createdAtMs: nowMs,
      },
    });
  }
  return {
    ops,
    summary: { errors: Object.keys(fresh).length, linked: pickedE.filter((r) => r.status === 'linked').length, phrases: phrasesNew },
  };
}

// ---- 5. 分析 ----
const firstSeen = (it) => (it.occurrences || []).map((o) => o.date).filter(Boolean).sort()[0] || it.sourceDate || '';

export function bankStats(items, t) {
  const errs = bankErrors(items);
  const byCategory = {};
  for (const it of errs) {
    const n = (it.occurrences || []).filter(counts).length;
    if (!n) continue;
    byCategory[it.errorCategory || 'other'] = (byCategory[it.errorCategory || 'other'] || 0) + n;
  }
  const since = (d) => errs.filter((it) => firstSeen(it) >= addDays(t, -(d - 1)) && firstSeen(it) <= t);
  const reviewable = [...errs, ...bankPhrases(items).filter((it) => it.srs !== false)];
  return {
    total: errs.length,
    categories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
    last7: since(7),
    last30: since(30),
    repeated: errs.filter((it) => (it.occurrences || []).filter(counts).length >= 2)
      .sort((a, b) => (b.occurrenceCount || 0) - (a.occurrenceCount || 0)),
    unverified: errs.filter((it) => (it.occurrences || []).some((o) => !counts(o))).length,
    mastered: reviewable.filter((it) => bankStatus(it.box || 0, it.reps || 0) === 'mastered'),
    due: reviewable.filter((it) => (it.due || '') <= t),
    phrases: bankPhrases(items).length,
  };
}

// ---- 6. Speaking Retry：挑 3～5 張（反覆出現的、該複習的、還不熟的優先）----
export function pickRetry(items, { sessionId, n = 5, t } = {}) {
  return bankErrors(items)
    .filter((it) => !sessionId || (it.occurrences || []).some((o) => o.sessionId === sessionId))
    .map((it) => ({ it, rep: (it.occurrences || []).filter(counts).length, due: t && (it.due || '') <= t ? 0 : 1 }))
    .sort((a, b) => b.rep - a.rep || (a.it.reviewPriority || 99) - (b.it.reviewPriority || 99) || a.due - b.due || (a.it.box || 0) - (b.it.box || 0) || String(a.it.id).localeCompare(String(b.it.id)))
    .slice(0, n)
    .map((x) => x.it);
}

// ---- 給 ChatGPT 的指令：輸出上面這個格式 ----
const CAT_KEYS = Object.keys(ERROR_CATEGORIES).join(' | ');
const PROMPT_BASE = `請把我們這次英文口說練習整理成一段 JSON，讓我匯入自己的英文學習 App。只輸出一個 \`\`\`json 程式碼區塊，不要其他文字。

格式（schemaVersion 固定 1）：
{
  "schemaVersion": 1,
  "session": {
    "sourceId": "chatgpt-日期-主題-round（同一次練習每次都給一樣的字串）",
    "date": "YYYY-MM-DD",
    "topic": "練習主題（英文）",
    "round": 1,
    "transcript": "我這次說的完整原文，一字不改，包含錯誤和贅字",
    "correctedTranscript": "修正後的自然英文版本",
    "grammarNotes": ["文法問題（中文說明）"],
    "vocabularyNotes": ["詞彙問題"],
    "phraseNotes": ["片語建議"],
    "logicNotes": ["邏輯與表達建議"]
  },
  "errors": [
    {
      "verifiedOriginal": "我真正說過的那一句，從 transcript 逐字複製",
      "suggestedCorrection": "建議的自然正確說法",
      "pattern": "錯誤句型的簡短寫法，例如 That's meaning → That means",
      "recurrenceGroup": "同一類反覆錯誤的固定代號（英文小寫底線，例如 that_means）；不是反覆犯的就填 null",
      "errorCategory": "${CAT_KEYS}",
      "explanationZh": "中文解釋為什麼",
      "examples": ["延伸英文例句"],
      "inferredExpression": "由上下文推導、我可能想表達的延伸說法（沒有就留空字串）"
    }
  ],
  "phrases": [
    {
      "phrase": "值得重複使用的英文片語",
      "meaningZh": "中文意思",
      "usage": "使用情境（中文）",
      "example": "英文例句",
      "tags": ["Daily Conversation | Career | BA / PM | Technology | Personal Reflection | Interview 挑 1～2 個"],
      "kind": "reusablePhrase 或 inferredExpression",
      "addToSrs": true
    }
  ]
}

規則：
1. transcript 只能放我原本說的話，不要改寫、不要修正、不要補字。
2. verifiedOriginal 一定要能在 transcript 裡逐字找到；找不到的就不要列。
3. 同一句錯誤只列一次；不要寫「出現幾次」，次數由 App 依實際紀錄計算。
4. 一筆 error 只放一個錯誤；意思不同的錯誤分開列。
5. phrases 是值得學的說法，不一定是我講錯的；kind 寫清楚是好用片語（reusablePhrase）還是你推導的延伸說法（inferredExpression）。
6. 不要給分數、不要評論發音。`;

// 把已經有的 recurrenceGroup 告訴 ChatGPT，同一種錯誤下次才會接到同一張卡
export function bankPrompt(items) {
  const groups = [...new Set(bankErrors(items).map((it) => it.recurrenceGroup).filter(Boolean))].sort();
  return groups.length ? `${PROMPT_BASE}\n7. 我已經有的 recurrenceGroup：${groups.join(', ')}。同一種錯誤請沿用這些代號。` : PROMPT_BASE;
}
export const BANK_PROMPT = PROMPT_BASE;
