import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CORE_WORDS, QUICK_WORDS } from '../src/data/wordLab.js';
import { review, dueItems, newItem } from '../src/lib/english.js';
import {
  STEPS, DONE_STEP, wordById, arrange, stepQuestions, stepComplete, nextQuestion, visibleExamples, startData, answerUpdate, advanceData,
  enterSrsOps, sentenceId, sentencePrompt, parseFeedback, submitSentence, addFeedback, sentenceSkill, labDue, weakSkill, reviewTask,
  dailyPlan, quickPicks, quickQuestion, toeicPicks, dayFinished, wordStats, speakingErrors, errorCloze, errorRewriteTask,
} from '../src/lib/wordLab.js';

const T = '2026-10-21';
const implement = wordById.implement;
// 把 answerUpdate 的 merge 資料套到狀態上（模擬 Firestore setDoc merge）
const merge = (a, b) => {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(out[k], v) : v;
  return out;
};

describe('題庫', () => {
  it('每個核心字的客觀題都有明確答案、解釋，錯誤選項都有原因', () => {
    for (const w of CORE_WORDS) {
      expect(w.examples.length).toBeLessThanOrEqual(10);
      for (const q of w.questions) {
        expect(q.options[q.answer], `${w.id} ${q.id}`).toBeTruthy();
        expect(q.explain).toBeTruthy();
        expect(new Set(q.options).size).toBe(q.options.length);
        q.options.forEach((_, i) => {
          if (i !== q.answer) expect(q.why[i], `${w.id} ${q.id} 選項 ${i}`).toBeTruthy();
        });
      }
      // 7 步裡的 1–4 步都有題目，還有 Part 5、兩題造句
      for (const n of [1, 2, 3, 4]) expect(stepQuestions(w, n).length, `${w.id} 第 ${n} 步`).toBeGreaterThan(0);
      expect(w.questions.filter((q) => q.kind === 'part5').length).toBeGreaterThan(0);
      expect(w.tasks.map((x) => x.kind)).toEqual(['translate', 'own']);
    }
  });
  it('8 種題型都有', () => {
    const kinds = new Set(CORE_WORDS.flatMap((w) => [...w.questions.map((q) => q.kind), ...w.tasks.map((x) => x.kind)]));
    for (const k of ['meaning', 'collocation', 'preposition', 'pos', 'errorFix', 'translate', 'scenario', 'part5']) expect(kinds.has(k)).toBe(true);
  });
  it('快速辨識字不重複', () => {
    expect(new Set(QUICK_WORDS.map((q) => q.word)).size).toBe(QUICK_WORDS.length);
  });
});

describe('作答、答錯、重答', () => {
  const q = stepQuestions(implement, 1)[0];
  const wrong = (q.answer + 1) % q.options.length;

  it('重答時選項換位置，正確答案不會在同一格', () => {
    const a0 = arrange(q, 0).map((o) => o.i);
    const a1 = arrange(q, 1).map((o) => o.i);
    expect(a0.indexOf(q.answer)).not.toBe(a1.indexOf(q.answer));
    expect([...a1].sort()).toEqual(q.options.map((_, i) => i));
  });

  it('答錯：記錯誤類型；重答答對：這步可以往下，但能力只算第一次', () => {
    let st = merge({}, startData(implement, null, T));
    const r1 = answerUpdate(implement, st, q, wrong, T);
    expect(r1.correct).toBe(false);
    expect(r1.log).toMatchObject({ correct: false, errorType: 'meaning', attempt: 1 });
    st = merge(st, r1.data);
    expect(st.lastErrorType).toBe('meaning');
    expect(st.skills.meaning).toEqual({ ok: 0, n: 1 });
    expect(nextQuestion(implement, st, 1).id).toBe(q.id);

    const r2 = answerUpdate(implement, st, q, q.answer, T);
    expect(r2.log.attempt).toBe(2);
    st = merge(st, r2.data);
    expect(st.skills.meaning).toEqual({ ok: 0, n: 1 });
    expect(st.answered[q.id]).toMatchObject({ tries: 2, firstOk: false, lastOk: true });
    expect(stepComplete(implement, st, 1)).toBe(true);
    expect(advanceData(implement, st, T)).toMatchObject({ step: 2 });
  });

  it('這步還沒答對不能往下；已開始的字再開一次不重設', () => {
    const st = { startedOn: '2026-10-20', step: 2 };
    expect(advanceData(implement, st, T)).toBeNull();
    expect(startData(implement, st, T)).toBeNull();
  });

  it('第 6 步（批改）可以先跳過', () => {
    expect(advanceData(implement, { startedOn: T, step: 6 }, T)).toMatchObject({ step: 7 });
  });

  it('例句一開始只給少數，搭配詞答錯會提早解鎖搭配詞例句', () => {
    const s1 = visibleExamples(implement, { startedOn: T, step: 1 });
    expect(s1.length).toBe(1);
    const s1miss = visibleExamples(implement, { startedOn: T, step: 1, errors: { collocation: 1 } });
    expect(s1miss.some((e) => e.focus === 'collocation')).toBe(true);
    expect(visibleExamples(implement, { finishedOn: T }).length).toBe(implement.examples.length);
  });
});

describe('進入間隔複習（沿用 englishItems）', () => {
  it('沒有同一個字：新增 wl-字，明天到期', () => {
    const ops = enterSrsOps(implement, [], T);
    expect(ops[0]).toMatchObject({ add: 'englishItems', id: 'wl-implement' });
    expect(ops[0].data).toMatchObject({ type: 'word', front: 'implement', box: 0, due: '2026-10-22', labWord: 'implement', source: 'wordLab' });
    expect(ops[1]).toMatchObject({ set: 'wordLab/implement', data: { step: DONE_STEP, finishedOn: T, itemId: 'wl-implement' } });
  });
  it('已經有同一個字的卡：只補 labWord，不動盒子和到期日', () => {
    const old = { id: 'abc', type: 'word', front: 'Implement', box: 3, due: '2026-11-01', reps: 5 };
    const ops = enterSrsOps(implement, [old], T);
    expect(ops[0]).toEqual({ set: 'englishItems/abc', data: { labWord: 'implement' } });
    expect(ops[1].data.itemId).toBe('abc');
  });
  it('到期後在原本的 dueItems 和 Word Lab 的到期清單都看得到，複習用同一個 review()', () => {
    const item = { id: 'wl-implement', ...enterSrsOps(implement, [], T)[0].data };
    expect(labDue([item], T)).toHaveLength(0);
    expect(labDue([item], '2026-10-22')).toHaveLength(1);
    expect(dueItems([item], '2026-10-22')).toHaveLength(1);
    const after = review(item, true, '2026-10-22');
    expect(after).toMatchObject({ box: 1, due: '2026-10-23' });
  });
});

describe('Smart Review 依弱點出題', () => {
  const item = { box: 1, reps: 1 };
  it('最近搭配詞錯 → 搭配詞題', () => {
    const r = reviewTask(implement, { lastErrorType: 'collocation' }, item);
    expect(r.kind).toBe('q');
    expect(['collocation', 'preposition', 'errorFix']).toContain(r.q.kind);
  });
  it('詞性弱 → 詞性題', () => {
    const r = reviewTask(implement, { lastErrorType: 'pos' }, item);
    expect(['pos', 'errorFix', 'part5']).toContain(r.q.kind);
  });
  it('造句要修改 → 重新造句', () => {
    expect(reviewTask(implement, {}, item, { needsFix: 1 }).kind).toBe('rewrite');
  });
  it('長期掌握（盒子 4 以上）→ 混合題', () => {
    const r = reviewTask(implement, { lastErrorType: 'pos' }, { box: 4 });
    expect(r.reason).toContain('長期掌握');
  });
  it('沒答錯過：找正確率最低的那項', () => {
    expect(weakSkill({ skills: { meaning: { ok: 3, n: 3 }, collocation: { ok: 1, n: 2 }, pos: { ok: 2, n: 2 } } })).toBe('collocation');
    expect(weakSkill({ skills: { meaning: { ok: 1, n: 1 } } })).toBe('mixed');
  });
  it('複習時第一次作答算進能力（fresh）', () => {
    const q = implement.questions[0];
    const st = { answered: { [q.id]: { tries: 2, firstOk: false, lastOk: true } }, skills: { meaning: { ok: 0, n: 1 } } };
    const r = answerUpdate(implement, st, q, q.answer, T, { fresh: true });
    expect(r.data.skills.meaning).toEqual({ ok: 1, n: 2 });
    expect(r.data.answered[q.id].firstOk).toBe(false);
  });
});

describe('造句：外部 AI 批改，不假裝評分', () => {
  const task = implement.tasks[0];
  it('prompt 帶題目、句子和 json 格式，要求不打分數', () => {
    const p = sentencePrompt({ word: 'implement', zh: '實施', task, text: 'We will implement it.' });
    expect(p).toContain(task.zh);
    expect(p).toContain('We will implement it.');
    expect(p).toContain('"verdict"');
    expect(p).toContain('不要幫我打分數');
  });
  it('讀 json 回覆；沒有 json 就存原文', () => {
    const fb = parseFeedback('不錯！\n```json\n{"verdict":"fix","corrected":"We will implement it next sprint.","issues":[{"type":"collocation","zh":"少了時間"}],"tipZh":"加時間"}\n```');
    expect(fb).toMatchObject({ parsed: true, verdict: 'fix', issues: [{ type: 'collocation', zh: '少了時間' }] });
    // verdict 說 ok 但列了問題 → 當成要修改
    expect(parseFeedback('{"verdict":"ok","corrected":"x","issues":[{"type":"grammar","zh":"a"}]}').verdict).toBe('fix');
    const raw = parseFeedback('看起來很好');
    expect(raw).toMatchObject({ parsed: false, verdict: '', raw: '看起來很好' });
    expect(parseFeedback('   ')).toBeNull();
  });
  it('修改再交：每一版都留，回饋對應版本，狀態跟著變', () => {
    let s = submitSentence(null, { wordId: 'implement', word: 'implement', task, text: 'We implement change.', t: T, nowMs: 1 });
    s = { ...s, ...addFeedback(s, { verdict: 'fix', corrected: 'We will implement the change.', issues: [] }, 2) };
    expect(s.status).toBe('needsFix');
    s = submitSentence(s, { wordId: 'implement', word: 'implement', task, text: 'We will implement the change.', t: T, nowMs: 3 });
    expect(s.versions.map((v) => v.text)).toEqual(['We implement change.', 'We will implement the change.']);
    expect(s.status).toBe('submitted');
    s = { ...s, ...addFeedback(s, { verdict: 'ok', corrected: '', issues: [] }, 4) };
    expect(s.feedback.map((f) => [f.forVersion, f.by])).toEqual([[1, '外部 AI'], [2, '外部 AI']]);
    expect(sentenceSkill([{ ...s, id: sentenceId('implement', 't1') }], 'implement')).toMatchObject({ submitted: 1, ok: 1, revisions: 1 });
  });
});

describe('每日模式', () => {
  const states = {};
  it('15／30／45 分鐘的核心字、快速字、TOEIC 題數', () => {
    expect(dailyPlan({ settings: { mode: 15 }, states, items: [], t: T }).core).toHaveLength(1);
    const p30 = dailyPlan({ settings: { mode: 30 }, states, items: [], t: T });
    expect([p30.core.length, p30.cfg.quick, p30.cfg.toeic]).toEqual([2, 5, 5]);
    const p45 = dailyPlan({ settings: { mode: 45 }, states, items: [], t: T });
    expect([p45.core.length, p45.cfg.quick, p45.cfg.toeic]).toEqual([3, 5, 10]);
  });
  it('每天新字可調', () => {
    expect(dailyPlan({ settings: { mode: 15, newPerDay: 2 }, states, items: [], t: T }).core).toHaveLength(2);
    expect(dailyPlan({ settings: { mode: 45, newPerDay: 0 }, states, items: [], t: T }).core).toHaveLength(0);
  });
  it('複習積壓超過 10 張：不給新字，還沒做完的字照樣列出', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ id: `x${i}`, type: 'word', front: `w${i}`, labWord: 'implement', due: '2026-10-20' }));
    const st = { allocate: { startedOn: '2026-10-20', step: 3 } };
    const p = dailyPlan({ settings: { mode: 45 }, states: st, items, t: T });
    expect(p.backlog).toBe(true);
    expect(p.core.map((w) => w.id)).toEqual(['allocate']);
  });
  it('昨天沒做完的字先接著做', () => {
    const p = dailyPlan({ settings: { mode: 15 }, states: { verify: { startedOn: '2026-10-20', step: 5 } }, items: [], t: T });
    expect(p.core.map((w) => w.id)).toEqual(['verify']);
  });
  it('快速字：今天答過的留在清單，選項有正確中文', () => {
    const picks = quickPicks({ words: { invoice: { last: T, streak: 1 } } }, T, 5);
    expect(picks).toHaveLength(5);
    expect(picks[0].word).toBe('invoice');
    const q = quickQuestion(picks[0], T);
    expect(q.options[q.answer]).toBe(picks[0].zh);
    expect(new Set(q.options).size).toBe(4);
  });
  it('TOEIC 小測先出開始學的字', () => {
    const picks = toeicPicks({ verify: { startedOn: T } }, T, 3);
    expect(picks).toHaveLength(3);
    expect(picks[0].w.id).toBe('verify');
    expect(picks.every((x) => x.q.kind === 'part5')).toBe(true);
  });
  it('全部做完才算今天完成', () => {
    const st = { implement: { startedOn: T, finishedOn: T } };
    const p = dailyPlan({ settings: { mode: 15 }, states: st, items: [], t: T });
    expect(dayFinished(p, st, {}, 0)).toBe(false);
    expect(dayFinished(p, st, { toeic: { done: true } }, 0)).toBe(true);
  });
});

describe('學習分析', () => {
  it('每個字 6 項分開', () => {
    const st = { startedOn: T, skills: { meaning: { ok: 1, n: 2 }, toeic: { ok: 1, n: 1 } }, lastErrorType: 'meaning' };
    const s = wordStats(implement, st, { box: 2, reps: 3, lapses: 1, due: '2026-10-25' }, []);
    expect(Object.keys(s)).toEqual(expect.arrayContaining(['meaning', 'collocation', 'pos', 'sentence', 'srs', 'toeic']));
    expect(s.collocation).toBeNull();
    expect(s.srs).toMatchObject({ box: 2, lapses: 1 });
  });
});

describe('口說錯誤庫 → 題目', () => {
  const ds = ['2026-10-18', '2026-10-19'].map((d) => JSON.parse(readFileSync(new URL(`../src/data/speaking-${d}.json`, import.meta.url))));

  it('讀交換格式 JSON：保留來源日期、原句、建議、中文說明', () => {
    const errs = speakingErrors([], ds);
    expect(errs.length).toBeGreaterThan(50);
    const e = errs.find((x) => x.original === 'I had an image about the BA intern in the DBS.');
    expect(e).toMatchObject({ sourceDate: '2026-10-19', correction: 'I had a certain idea of what a BA intern at DBS would do.' });
    expect(e.explanationZh).toBeTruthy();
  });
  it('只收標明是原句的；建議句不會變成原句', () => {
    const d = { datasetId: 'x', errors: [
      { id: '1', verifiedOriginal: 'I am agree.', suggestedCorrection: 'I agree.', sourceType: 'verifiedOriginal', sourceDate: T },
      { id: '2', verifiedOriginal: 'We discuss about it.', suggestedCorrection: 'We discussed it.', sourceType: 'inferredExpression' },
      { id: '3', suggestedCorrection: 'Only a suggestion.' },
    ] };
    const errs = speakingErrors([], [d]);
    expect(errs.map((e) => e.original)).toEqual(['I am agree.']);
    expect(errorRewriteTask(errs[0])).not.toHaveProperty('model');
  });
  it('錯誤庫卡片優先，和 JSON 同一句不重複', () => {
    const card = { id: 'err-1', bank: 'error', type: 'fix', front: 'I had an image about the BA intern in the DBS.', back: 'I had a certain idea of what a BA intern at DBS would do.', originalText: 'I had an image about the BA intern in the DBS.', correctedText: 'I had a certain idea of what a BA intern at DBS would do.', sourceDate: '2026-10-19', occurrences: [{ evidence: 'excerpt' }] };
    const errs = speakingErrors([card], ds);
    const same = errs.filter((x) => x.original === card.originalText);
    expect(same).toHaveLength(1);
    expect(same[0].itemId).toBe('err-1');
  });
  it('介係詞錯誤出成填空，答案是建議句裡的介係詞', () => {
    const q = errorCloze({ id: 'p1', category: 'preposition', original: 'I am good in English.', correction: 'I am good at English.', explanationZh: 'good at' });
    expect(q.q).toContain('I am good ___ English.');
    expect(q.options[q.answer]).toBe('at');
    expect(q.options).toContain('in');
    expect(errorCloze({ id: 'p2', category: 'vocabulary', original: 'a', correction: 'b' })).toBeNull();
  });
});

describe('舊資料相容', () => {
  it('沒有 Word Lab 欄位的舊卡不會被當成 Word Lab 卡', () => {
    const old = { ...newItem({ type: 'word', front: 'deadline' }, T), id: 'old' };
    expect(labDue([old], T)).toHaveLength(0);
    expect(STEPS).toHaveLength(7);
  });
});

describe('發音和互動小遊戲', async () => {
  const { fullSentence, listenGame, matchGame, dictationGame, dictationOk, builderGame, builderOk, gameUpdate } = await import('../src/lib/wordLab.js');
  it('答對後念的完整句：把空格換成答案；找錯題不念', () => {
    const q = implement.questions.find((x) => x.id === 'q2');
    expect(fullSentence(q)).toBe('The team spent two weeks implementing the changes requested by the client.');
    const p5 = implement.questions.find((x) => x.id === 'q8');
    expect(fullSentence(p5)).toContain('will be implemented across');
    expect(fullSentence(implement.questions.find((x) => x.kind === 'errorFix'))).toBe('');
    expect(fullSentence(implement.questions[0])).toBe('The bank plans to implement a new login process for all customers.');
  });
  it('每個核心字都能玩 4 種小遊戲', () => {
    for (const w of CORE_WORDS) {
      const l = listenGame(w, 1);
      expect(l.options.length).toBeGreaterThanOrEqual(3);
      expect(l.options).toContain(l.target);
      const m = matchGame(w, 1);
      expect(m.pairs.length).toBeGreaterThanOrEqual(3);
      expect([...m.right].sort()).toEqual(m.pairs.map((p) => p.en).sort());
      const d = dictationGame(w, w.examples, 1);
      expect(d, w.id).toBeTruthy();
      expect(d.shown).not.toContain(` ${d.answer} `);
      expect(dictationOk(` ${d.answer.toUpperCase()}. `, d.answer)).toBe(true);
      const b = builderGame(w, w.examples, 1);
      expect(b, w.id).toBeTruthy();
      expect(builderOk(b.tiles, b.sentence)).toBe(false);
      expect(builderOk([...b.tiles].sort((x, y) => x.id - y.id), b.sentence)).toBe(true);
    }
  });
  it('小遊戲結果算進對應能力，答錯記錯誤類型', () => {
    const u = gameUpdate({ skills: { collocation: { ok: 1, n: 1 } } }, 'builder', false);
    expect(u.skills.collocation).toEqual({ ok: 1, n: 2 });
    expect(u.games.builder).toEqual({ played: 1, ok: 0 });
    expect(u.lastErrorType).toBe('collocation');
    expect(gameUpdate({}, 'listen', true)).toEqual({ skills: { pos: { ok: 1, n: 1 } }, games: { listen: { played: 1, ok: 1 } } });
  });
});
