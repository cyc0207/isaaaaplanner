import { describe, it, expect } from 'vitest';
import { drinkOdds, drinkSegments } from '../src/lib/drinks.js';
import { drinkGroupOf } from '../src/lib/places.js';

const budget = { categories: [{ name: '飲料', kind: 'perWeek', perItem: 60, perWeekCount: 3 }] };
const cup = (date, sugar = '微糖', amount = 60) => ({ date, amount, type: 'expense', category: '飲料', drink: { sugar } });

describe('今天要不要喝飲料', () => {
  it('預算還夠：喝 2 格、不喝 1 格', () => {
    const o = drinkOdds({ budget, expenses: [], day: '2026-10-14' });
    expect([o.drink, o.skip]).toEqual([2, 1]);
    expect(o.reasons[0]).toContain('還剩 $180');
  });
  it('預算用完：不喝的格子變多', () => {
    const o = drinkOdds({ budget, expenses: [cup('2026-10-12'), cup('2026-10-13'), cup('2026-10-13', '微糖', 50)], day: '2026-10-14' });
    expect([o.drink, o.skip]).toEqual([1, 4]);
    expect(o.reasons[0]).toContain('不夠一杯');
  });
  it('全糖喝多、今天喝過：再加不喝', () => {
    const o = drinkOdds({ budget, expenses: [cup('2026-10-12', '全糖', 30), cup('2026-10-14', '全糖', 30)], day: '2026-10-14' });
    expect([o.drink, o.skip]).toEqual([2, 3]);
    expect(o.reasons.join()).toContain('全糖 2 杯');
    expect(o.reasons.join()).toContain('今天已經喝過');
  });
  it('上週的不算', () => {
    expect(drinkOdds({ budget, expenses: [cup('2026-10-11'), cup('2026-10-10'), cup('2026-10-09')], day: '2026-10-14' }).drink).toBe(2);
  });
  it('格子交錯排', () => {
    expect(drinkSegments({ drink: 1, skip: 3 }).map((s) => s.yes)).toEqual([true, false, false, false]);
    expect(drinkSegments({ drink: 2, skip: 2 }).map((s) => s.yes)).toEqual([true, false, true, false]);
  });
  it('飲料店分類', () => {
    expect(drinkGroupOf({ displayName: { text: '路易莎咖啡' }, primaryType: 'cafe' })).toBe('咖啡');
    expect(drinkGroupOf({ displayName: { text: '50嵐' }, primaryType: 'cafe' })).toBe('手搖飲・茶');
    expect(drinkGroupOf({ displayName: { text: '50嵐' }, primaryType: 'tea_house' })).toBe('手搖飲・茶');
    expect(drinkGroupOf({ displayName: { text: '鮮果汁' }, primaryType: 'juice_shop' })).toBe('果汁・冰沙');
  });
});

describe('飲料打卡也算杯數', () => {
  const budget = { categories: [{ name: '飲料', kind: 'perWeek', perItem: 60, perWeekCount: 3 }] };
  const exp = (date, sugar = '微糖') => ({ type: 'expense', category: '飲料', date, amount: 50, drink: { size: '中', sugar } });
  const snap = (date, sugar = null) => ({ slot: 'drink', date, sugar });
  it('只有打卡沒記帳也算', () => {
    const o = drinkOdds({ budget, expenses: [], day: '2026-10-14', logs: [snap('2026-10-12'), snap('2026-10-13'), snap('2026-10-14', '全糖')] });
    expect(o.cups).toBe(3);
    expect(o.today).toBe(1);
    expect(o.reasons.join()).toContain('已經喝 3 杯');
  });
  it('同一天記帳又打卡不重複算', () => {
    const o = drinkOdds({ budget, expenses: [exp('2026-10-13', '全糖')], day: '2026-10-14', logs: [snap('2026-10-13', '全糖'), snap('2026-10-12')] });
    expect(o.cups).toBe(2);
    expect(o.fullSugar).toBe(1);
  });
  it('上週的打卡不算', () => {
    expect(drinkOdds({ budget, expenses: [], day: '2026-10-14', logs: [snap('2026-10-11')] }).cups).toBe(0);
  });
});
