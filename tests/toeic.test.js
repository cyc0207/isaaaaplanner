import { describe, it, expect } from 'vitest';
import {
  schedule, planDocs, todayPlan, accuracy, answeredCount, isAnswered, summary, cleanRecord, partOf, mistakeId,
  parseAiReply, mistakePrompt, cardFromMistake, weekdayMaterial, weekOf, errorTypeCounts, PLAN,
} from '../src/lib/toeic.js';
import { taipeiToday } from '../src/lib/date.js';

const full = { p5: 25, p6: 13, p7: 40 };

describe('toeic 計畫', () => {
  it('12 回日期：週五寫、週六檢討，最後一回 2027-01-08、檢討 01-09', () => {
    const s = schedule();
    expect(s).toHaveLength(12);
    expect(s[0]).toMatchObject({ round: 1, id: 'r01', plannedDate: '2026-10-23', reviewDate: '2026-10-24' });
    expect(s[10]).toMatchObject({ plannedDate: '2027-01-01', reviewDate: '2027-01-02' });
    expect(s[11]).toMatchObject({ id: 'r12', plannedDate: '2027-01-08', reviewDate: '2027-01-09' });
    expect(s.map((x) => x.plannedDate)).toEqual([
      '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27',
      '2026-12-04', '2026-12-11', '2026-12-18', '2026-12-25', '2027-01-01', '2027-01-08',
    ]);
    expect(PLAN.end).toBe(s[11].reviewDate);
  });

  it('建立計畫的文件 ID 固定，而且不含成績欄位（重開不會重複、不會蓋掉）', () => {
    const docs = planDocs();
    expect(docs.map((d) => d.path)).toEqual(['toeic/plan', ...schedule().map((s) => `toeic/${s.id}`)]);
    for (const d of docs.slice(1)) expect(Object.keys(d.data).sort()).toEqual(['plannedDate', 'reviewDate', 'round']);
  });

  it('10/18：計畫已建立、尚未開始，週日休息', () => {
    const p = todayPlan('2026-10-18', {});
    expect(p.phase).toBe('before');
    expect(p.kind).toBe('rest');
    expect(p.title).toContain('計畫已建立');
    expect(todayPlan('2026-10-21', {}).kind).toBe('before');
  });

  it('10/23：寫第 1 回', () => {
    const p = todayPlan('2026-10-23', {});
    expect(p).toMatchObject({ phase: 'active', kind: 'test', week: 1 });
    expect(p.round.round).toBe(1);
  });

  it('10/24：寫過才檢討；沒寫不假裝有錯題', () => {
    expect(todayPlan('2026-10-24', {}).kind).toBe('review-wait');
    const p = todayPlan('2026-10-24', { r01: full });
    expect(p.kind).toBe('review');
    expect(p.round.round).toBe(1);
    expect(todayPlan('2026-10-24', { r01: { ...full, reviewed: true } }).done).toBe(true);
  });

  it('週日不派作業', () => {
    for (const d of ['2026-10-25', '2026-11-01', '2026-12-27', '2027-01-03']) expect(todayPlan(d, {}).kind).toBe('rest');
  });

  it('週一到週四是 5～10 分鐘小任務', () => {
    expect(todayPlan('2026-10-26', {}).task.kind).toBe('cards');
    expect(todayPlan('2026-10-27', {}).task.kind).toBe('sentence');
    expect(todayPlan('2026-10-28', {}).task.kind).toBe('grammar');
    expect(todayPlan('2026-10-29', {}).task.kind).toBe('recap');
    expect(weekOf('2026-10-26')).toBe(2);
    expect(weekOf('2027-01-09')).toBe(12);
  });

  it('延後：週五先補沒寫完的那回，不跳過、不自動算完成', () => {
    const p = todayPlan('2026-10-30', { r01: { p5: 20 } });
    expect(p).toMatchObject({ kind: 'test', catchUp: true });
    expect(p.round.round).toBe(1);
    expect(p.round.plannedDate).toBe('2026-10-23');
    expect(summary({ r01: { p5: 20 } }).completed).toBe(0);
  });

  it('第 12 回之後：還有沒寫的就補，全寫完就結束', () => {
    expect(todayPlan('2027-01-10', {}).round.round).toBe(1);
    const all = Object.fromEntries(schedule().map((s) => [s.id, full]));
    expect(todayPlan('2027-01-10', all).kind).toBe('finished');
  });

  it('沒填的 Part 不當 0 分，沒寫完不算 100 題', () => {
    const r = { p5: 24 };
    const a = accuracy(r);
    expect(a.p6).toBeNull();
    expect(a.p7).toBeNull();
    expect(a.all).toMatchObject({ score: 24, total: 30, parts: ['p5'] });
    expect(answeredCount(r)).toBe(30);
    expect(isAnswered(r)).toBe(false);
    expect(accuracy({}).all).toBeNull();
    // 寫完但還沒對答案
    expect(answeredCount({ done: { p5: true, p6: true } })).toBe(46);
    expect(accuracy({ done: { p5: true } }).all).toBeNull();
  });

  it('總正確率、累計題數、最近一次', () => {
    const s = summary({ r01: { ...full, answeredDate: '2026-10-23' }, r02: { p5: 27, answeredDate: '2026-10-30' } });
    expect(s.completed).toBe(1);
    expect(s.questions).toBe(130);
    expect(s.latest.round).toBe(2);
    expect(accuracy(full).all.pct).toBeCloseTo(78 / 100);
    expect(s.pendingReview).toBe(1);
  });

  it('表單：空白是 null、超出範圍擋下', () => {
    const { data, errors } = cleanRecord({ p5: '28', p6: '', p7: '60', minutes: '80', done: { p6: true } });
    expect(data.p5).toBe(28);
    expect(data.p6).toBeNull();
    expect(data.done).toEqual({ p5: true, p6: true, p7: false });
    expect(data.minutes).toBe(80);
    expect(errors).toHaveLength(1);
    expect(cleanRecord({ p5: '0' }).data.p5).toBe(0);
    expect(cleanRecord({}).data.timed).toBeNull();
  });

  it('題號判斷 Part、錯題 ID 固定', () => {
    expect(partOf(101)).toBe('p5');
    expect(partOf(146)).toBe('p6');
    expect(partOf(147)).toBe('p7');
    expect(partOf(50)).toBe('');
    expect(mistakeId(1, 'p5', 112)).toBe('r01-p5-q112');
  });
});

describe('台灣日期', () => {
  it('UTC 16:30 已經是台灣隔天', () => {
    expect(taipeiToday(new Date('2026-10-22T16:30:00Z'))).toBe('2026-10-23');
    expect(taipeiToday(new Date('2026-10-23T15:59:00Z'))).toBe('2026-10-23');
  });
});

describe('錯題與 AI 回覆', () => {
  const good = `好的，以下是分析：
\`\`\`json
{"version":1,"items":[{"sourceRound":1,"part":5,"questionNumber":112,"errorType":"word_form","explanationZh":"要填形容詞","grammarPoint":"冠詞＋形容詞＋名詞","suggestedReview":"grammar","reviewSentence":"It was a careful decision."}]}
\`\`\``;

  it('驗證 JSON', () => {
    const r = parseAiReply(good);
    expect(r.error).toBeNull();
    expect(r.items[0]).toMatchObject({ ok: true, round: 1, part: 'p5', q: 112, errorType: 'word_form' });
  });

  it('版本不對、欄位錯誤', () => {
    expect(parseAiReply('{"version":2,"items":[]}').error).toContain('version');
    expect(parseAiReply('亂打').error).toBeTruthy();
    const r = parseAiReply('{"version":1,"items":[{"sourceRound":13,"part":5,"questionNumber":150,"errorType":"x"}]}');
    expect(r.items[0].ok).toBe(false);
    expect(r.items[0].errors.join()).toMatch(/sourceRound/);
    expect(r.items[0].errors.join()).toMatch(/Part 5/);
    expect(r.items[0].errors.join()).toMatch(/errorType/);
    expect(r.items[0].errors.join()).toMatch(/explanationZh/);
  });

  it('errorType 寫中文也認得', () => {
    const r = parseAiReply('{"version":1,"items":[{"sourceRound":2,"part":"Part 7","questionNumber":160,"errorType":"資訊定位","explanationZh":"x"}]}');
    expect(r.items[0]).toMatchObject({ ok: true, part: 'p7', errorType: 'locate' });
  });

  it('prompt 有回數、題號和 JSON 格式', () => {
    const p = mistakePrompt([{ round: 1, part: 'p5', q: 112, errorType: 'word_form', ask: 'the ___ decision' }]);
    expect(p).toContain('第 1 回 Part 5 第 112 題');
    expect(p).toContain('"version": 1');
    expect(p).toContain('the ___ decision');
  });

  it('錯題變卡片，帶 TOEIC閱讀 主題', () => {
    const c = cardFromMistake({ round: 3, part: 'p6', q: 133, errorType: 'tense', grammarPoint: '現在完成式', explanationZh: '有 since', reviewSentence: 'She has worked here since 2020.' });
    expect(c).toMatchObject({ type: 'grammar', front: '現在完成式', example: 'She has worked here since 2020.' });
    expect(c.tags).toContain('TOEIC閱讀');
    expect(cardFromMistake({ round: 1, part: 'p5', q: 101, errorType: 'vocab', note: '我的筆記' }, 'fix').front).toBe('我的筆記');
  });

  it('平日材料只用之前回數的錯題；沒有就是空的', () => {
    const mistakes = [
      { round: 1, part: 'p5', q: 105, errorType: 'tense' },
      { round: 1, part: 'p5', q: 110, errorType: 'tense' },
      { round: 1, part: 'p7', q: 160, errorType: 'locate' },
      { round: 2, part: 'p5', q: 101, errorType: 'clause' },
    ];
    expect(weekdayMaterial(3, { mistakes, cards: [], beforeRound: 2, t: '2026-10-28' }).mistakes).toHaveLength(2);
    expect(weekdayMaterial(4, { mistakes, cards: [], beforeRound: 2, t: '2026-10-29' }).top).toEqual(['tense', 2]);
    expect(weekdayMaterial(3, { mistakes: [], cards: [], beforeRound: 2, t: '2026-10-28' }).mistakes).toEqual([]);
    const cards = [{ id: 'a', tags: ['TOEIC閱讀'], due: '2026-10-26' }, { id: 'b', tags: ['別的'] }];
    expect(weekdayMaterial(1, { mistakes, cards, beforeRound: 2, t: '2026-10-26' }).cards.map((c) => c.id)).toEqual(['a']);
    expect(errorTypeCounts(mistakes)[0]).toEqual(['tense', 2]);
  });
});
