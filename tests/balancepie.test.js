import { describe, it, expect } from 'vitest';
import { balancePie } from '../src/lib/budget.js';

const acc = (id, initialBalance) => ({ id, name: id, initialBalance });
describe('balancePie', () => {
  it('依帳戶餘額占比，負的另外列出，未來的帳不算', () => {
    const r = balancePie([acc('現金', 1000), acc('銀行', 5000), acc('卡', 0)], [
      { type: 'expense', account: '現金', amount: 200, date: '2026-10-10' },
      { type: 'expense', account: '卡', amount: 300, date: '2026-10-10' },
      { type: 'expense', account: '銀行', amount: 999, date: '2026-10-20' },
    ], '2026-10-12');
    expect(r.mode).toBe('balance');
    expect(r.slices.map((s) => [s.name, s.value])).toEqual([['銀行', 5000], ['現金', 800]]);
    expect(r.negative.map((s) => s.value)).toEqual([-300]);
    expect(r.total).toBe(5500);
  });
  it('超過 5 個帳戶時合併成「其他」', () => {
    const r = balancePie([1, 2, 3, 4, 5, 6, 7].map((n) => acc('a' + n, n * 100)), [], '2026-10-12');
    expect(r.slices).toHaveLength(5);
    expect(r.slices[4]).toMatchObject({ name: '其他 3 項', value: 600 });
  });
  it('沒有正餘額時改看本月支出分類', () => {
    const r = balancePie([acc('現金', 0)], [
      { type: 'expense', account: '現金', amount: 120, date: '2026-10-03', category: '午餐' },
      { type: 'expense', account: '現金', amount: 60, date: '2026-10-05', category: '飲料' },
      { type: 'expense', account: '現金', amount: 80, date: '2026-09-30', category: '午餐' },
    ], '2026-10-12');
    expect(r.mode).toBe('spend');
    expect(r.slices.map((s) => [s.name, s.value])).toEqual([['午餐', 120], ['飲料', 60]]);
  });
});
