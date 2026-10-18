import { describe, it, expect } from 'vitest';
import {
  parseImportText, validateImport, buildBankPreview, bankImportOps, bankStats, pickRetry, inTranscript, sessionDocId, hash, norm,
} from '../src/lib/errorBank.js';
import { dueItems, practicable, review, reviewGrade } from '../src/lib/english.js';
import { SEED_IMPORT, SAMPLE_IMPORT } from '../src/data/errorBankSeed.js';

// 模擬 api.batch 寫進 englishItems / speakImports
function apply(ops, store) {
  for (const op of ops) {
    if (op.add) store[`${op.add}/${op.id}`] = { id: op.id, ...op.data };
    else if (op.set) store[op.set] = { ...(store[op.set] || { id: op.set.split('/')[1] }), ...op.data };
  }
  return store;
}
const itemsOf = (store) => Object.entries(store).filter(([k]) => k.startsWith('englishItems/')).map(([, v]) => v);
const sessionOf = (store, id) => store[`speakImports/${id}`] || null;

function runImport(obj, store, t = '2026-10-18') {
  const sid = sessionDocId(validateImport(obj).session);
  const existing = sessionOf(store, sid);
  const p = buildBankPreview(obj, itemsOf(store), existing);
  const { ops, summary } = bankImportOps(p, itemsOf(store), t, 1000, existing);
  apply(ops, store);
  return { p, ops, summary };
}

describe('錯誤庫：JSON 檢查', () => {
  it('從 ```json 區塊取出 JSON', () => {
    const r = parseImportText('好的：\n```json\n{"schemaVersion":1}\n```\n以上');
    expect(r.data).toEqual({ schemaVersion: 1 });
  });
  it('格式錯誤講出原因，不會靜默失敗', () => {
    expect(parseImportText('{"a": 1,}').error).toMatch(/JSON 格式錯誤/);
    expect(parseImportText('沒有 JSON').error).toMatch(/找不到 JSON/);
    expect(parseImportText('').error).toBeTruthy();
  });
  it('schemaVersion、日期、主題不對就整份擋下', () => {
    const v = validateImport({ schemaVersion: 2, session: { date: '10/16', topic: '' }, errors: [] });
    expect(v.fatal.length).toBe(3);
  });
  it('單筆缺欄位標成有錯，不影響其他筆；不認得的類型放「其他」', () => {
    const v = validateImport({
      schemaVersion: 1,
      session: { date: '2026-10-16', topic: 'x', transcript: 'I go to school yesterday.' },
      errors: [{ verifiedOriginal: 'I go to school yesterday.', suggestedCorrection: 'I went to school yesterday.', errorCategory: 'verb' }, { suggestedCorrection: 'x' }],
    });
    expect(v.fatal).toEqual([]);
    expect(v.errors[0].errorCategory).toBe('other');
    expect(v.errors[0].notes[0]).toMatch(/不認得/);
    expect(v.errors[1].problems.length).toBeGreaterThan(0);
  });
});

describe('錯誤庫：原句核對與出現次數', () => {
  it('原句要在逐字稿裡找得到（忽略大小寫標點）', () => {
    expect(inTranscript("Um, that's meaning I can choose.", "That’s meaning I can choose")).toBe(true);
    expect(inTranscript('I like it.', 'I love it')).toBe(false);
  });
  it('找不到的標「未核對」，不算次數', () => {
    const obj = {
      schemaVersion: 1,
      session: { date: '2026-10-16', topic: 'Goals', transcript: 'I want to into marketing.' },
      errors: [
        { verifiedOriginal: 'I want to into marketing.', suggestedCorrection: 'I want to get into marketing.', errorCategory: 'sentenceStructure' },
        { verifiedOriginal: 'AI made this up', suggestedCorrection: 'Something else', errorCategory: 'other' },
      ],
    };
    const store = {};
    runImport(obj, store);
    const items = itemsOf(store);
    expect(items.find((i) => i.front === 'I want to into marketing.').occurrenceCount).toBe(1);
    expect(items.find((i) => i.front === 'AI made this up').occurrenceCount).toBe(0);
  });
});

describe('錯誤庫：去重', () => {
  it('同一份匯入兩次不會多出任何卡或紀錄', () => {
    const store = {};
    const first = runImport(SAMPLE_IMPORT, store);
    expect(first.summary).toEqual({ errors: 1, linked: 0, phrases: 1 });
    const before = JSON.stringify(store);
    const second = runImport(SAMPLE_IMPORT, store);
    expect(second.p.errors.every((r) => r.status === 'same')).toBe(true);
    expect(second.p.phrases.every((r) => r.status === 'same')).toBe(true);
    expect(second.ops).toEqual([]);
    expect(JSON.stringify(store)).toBe(before);
  });
  it('文件 ID 不靠時間：同一筆資料算出同一個 ID', () => {
    expect(sessionDocId({ sourceId: 'abc' })).toBe(sessionDocId({ sourceId: ' ABC ' }));
    expect(hash('x')).toBe(hash('x'));
  });
  it('同一種錯誤在另一次練習又出現：加到同一張卡，次數 +1', () => {
    const store = {};
    runImport(SEED_IMPORT, store);
    const { p } = runImport(SAMPLE_IMPORT, store);
    expect(p.errors[0].status).toBe('linked');
    const card = itemsOf(store).find((i) => i.pattern === "That's meaning → That means");
    expect(card.occurrences.map((o) => o.evidence)).toEqual(['userReported', 'transcript']);
    expect(card.occurrenceCount).toBe(2);
    // 片語「That doesn't necessarily mean…」已經在初始清單：只記來源，不重複建卡
    expect(p.phrases[0].status).toBe('linked');
    expect(itemsOf(store).filter((i) => i.bank === 'phrase').length).toBe(SEED_IMPORT.phrases.length);
  });
  it('同一份 JSON 裡同一句列兩次只算一次', () => {
    const e = { verifiedOriginal: 'I have anxiety', suggestedCorrection: 'I feel anxious', errorCategory: 'collocation' };
    const store = {};
    const { p } = runImport({ schemaVersion: 1, session: { date: '2026-10-16', topic: 't', transcript: 'I have anxiety' }, errors: [e, e] }, store);
    expect(p.errors.map((r) => r.status)).toEqual(['new', 'same']);
    expect(itemsOf(store).length).toBe(1);
  });
  it('意思相近但不同的錯誤標「疑似重複」，預設不匯入、不合併', () => {
    const store = {};
    runImport({ schemaVersion: 1, session: { date: '2026-10-16', topic: 't', transcript: 'I go there yesterday.' }, errors: [{ verifiedOriginal: 'I go there yesterday.', suggestedCorrection: 'I went there yesterday.', errorCategory: 'tense' }] }, store);
    const { p } = runImport({ schemaVersion: 1, session: { date: '2026-10-17', topic: 't', transcript: 'I go there last week.' }, errors: [{ verifiedOriginal: 'I go there last week.', suggestedCorrection: 'I went there yesterday.', errorCategory: 'tense' }] }, store);
    expect(p.errors[0].status).toBe('similar');
    expect(p.errors[0].selected).toBe(false);
    expect(itemsOf(store).length).toBe(1);
  });
  it('重複匯入時不覆蓋原本的逐字稿', () => {
    const store = {};
    runImport(SAMPLE_IMPORT, store);
    const changed = { ...SAMPLE_IMPORT, session: { ...SAMPLE_IMPORT.session, transcript: 'rewritten by AI' } };
    const { p } = runImport(changed, store);
    expect(p.warnings.join()).toMatch(/不會覆蓋/);
    expect(sessionOf(store, p.session.id).transcript).toBe(SAMPLE_IMPORT.session.transcript);
  });
});

describe('錯誤庫：和原本的 Leitner 複習接在一起', () => {
  it('錯誤卡就是 englishItems 的改錯卡，會出現在今天的複習', () => {
    const store = {};
    runImport(SEED_IMPORT, store);
    const items = itemsOf(store);
    const due = dueItems(items, '2026-10-18');
    expect(due.length).toBe(SEED_IMPORT.errors.length + SEED_IMPORT.phrases.length);
    expect(items.filter((i) => i.bank === 'error').every((i) => i.type === 'fix' && i.box === 0 && i.status === 'new')).toBe(true);
  });
  it('沒勾加入複習的片語不進複習', () => {
    expect(practicable({ type: 'phrase', front: 'x', srs: false })).toBe(false);
    expect(practicable({ type: 'phrase', front: 'x' })).toBe(true);
  });
  it('週三：反覆犯的錯誤排最前面；其他天照原本順序', () => {
    const items = [
      { id: 'a', type: 'word', front: 'a', due: '2026-10-10', box: 1 },
      { id: 'b', type: 'fix', front: 'b', due: '2026-10-20', box: 1, bank: 'error', occurrenceCount: 3 },
    ];
    expect(dueItems(items, '2026-10-21').map((x) => x.id)).toEqual(['b', 'a']); // 週三
    expect(dueItems(items, '2026-10-22').map((x) => x.id)).toEqual(['a', 'b']); // 週四
  });
  it('三段自評：不會回第一格、有點會留在原格明天再練、熟悉往後一格', () => {
    const card = { box: 2, reps: 3, lapses: 0, bank: 'error' };
    expect(reviewGrade(card, 0, '2026-10-18')).toMatchObject({ box: 0, due: '2026-10-19', lapses: 1, status: 'learning' });
    expect(reviewGrade(card, 1, '2026-10-18')).toMatchObject({ box: 2, due: '2026-10-19', reps: 4, lapses: 0 });
    expect(reviewGrade(card, 2, '2026-10-18')).toEqual(review(card, true, '2026-10-18'));
    expect(review({ box: 3, bank: 'error' }, true, '2026-10-18').status).toBe('mastered');
    expect(review({ box: 3 }, true, '2026-10-18').status).toBeUndefined();
  });
});

describe('錯誤庫：分析與 Retry', () => {
  it('次數只算有來源的；7 天／30 天依第一次出現日期', () => {
    const store = {};
    runImport(SEED_IMPORT, store);
    runImport(SAMPLE_IMPORT, store);
    const st = bankStats(itemsOf(store), '2026-10-18');
    expect(st.total).toBe(12);
    expect(st.repeated.length).toBe(1);
    expect(st.categories[0]).toEqual(['wordForm', 3]);
    expect(st.categories).toContainEqual(['grammar', 2]);
    expect(st.last7.length).toBe(12);
    expect(bankStats(itemsOf(store), '2026-11-30').last30.length).toBe(0);
  });
  it('Retry 優先挑反覆出現的，最多 5 張，可以限定某次練習', () => {
    const store = {};
    runImport(SEED_IMPORT, store);
    runImport(SAMPLE_IMPORT, store);
    const picks = pickRetry(itemsOf(store), { t: '2026-10-18' });
    expect(picks.length).toBe(5);
    expect(picks[0].pattern).toBe("That's meaning → That means");
    const sid = sessionDocId(SAMPLE_IMPORT.session);
    expect(pickRetry(itemsOf(store), { sessionId: sid }).length).toBe(1);
  });
  it('初始資料本身通過檢查', () => {
    const v = validateImport(SEED_IMPORT);
    expect(v.fatal).toEqual([]);
    expect(v.errors.every((e) => !e.problems.length && !e.notes.length)).toBe(true);
    expect(v.phrases.every((p) => !p.problems.length && !p.notes.length)).toBe(true);
    expect(norm('Instead of rebuilding…')).toBe('instead of rebuilding');
  });
});
