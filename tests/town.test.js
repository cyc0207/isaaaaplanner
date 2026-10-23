import { describe, it, expect } from 'vitest';
import { town, tierOf, BUILDINGS, parkMonths, weather } from '../src/lib/town.js';

const ex = (date, amount, category, extra = {}) => ({ id: `${date}-${category}-${amount}`, date, amount, type: 'expense', category, account: 'a', ...extra });

describe('牛仔小鎮', () => {
  it('累計投入決定房子等級和差多少升級', () => {
    expect(tierOf(BUILDINGS, 0).key).toBe('lot');
    const t = tierOf(BUILDINGS, 32000);
    expect(t.levelName).toBe('酒館');
    expect(t.next.name).toBe('旅館');
    expect(t.toNext).toBe(28000);
    expect(tierOf(BUILDINGS, 999999).next).toBe(null);
  });

  it('生活費守住種仙人掌，超支是風滾草，沒記帳的月份不算', () => {
    const expenses = [ex('2026-08-03', 20000, '午餐'), ex('2026-09-03', 35000, '午餐'), ex('2026-10-02', 100, '午餐')];
    const p = parkMonths(expenses, 30000, '2026-10-12');
    expect(p.map((m) => [m.key, m.kept, m.saved])).toEqual([
      ['2026-08', true, 10000],
      ['2026-09', false, -5000],
    ]);
  });

  it('天氣看這個月的進度', () => {
    expect(weather([ex('2026-10-02', 100, '午餐')], 31000, '2026-10-10').kind).toBe('sun');
    expect(weather([ex('2026-10-02', 20000, '午餐')], 31000, '2026-10-10').kind).toBe('dust');
    expect(weather([ex('2026-10-02', 40000, '午餐')], 31000, '2026-10-10').kind).toBe('storm');
    expect(weather([], 0, '2026-10-10').kind).toBe('none');
  });

  it('身價＝投資累計＋投資帳戶以外的存款，地名保留標的名稱', () => {
    const accounts = [
      { id: 'a', name: '薪轉', initialBalance: 50000 },
      { id: 'inv', name: '證券', initialBalance: 0 },
    ];
    const expenses = [
      ex('2026-10-06', 6000, '0056 定期定額'),
      { id: 't', date: '2026-10-05', amount: 10000, type: 'transfer', account: 'a', toAccount: 'inv' },
    ];
    const t = town({ expenses, accounts, budget: { salary: 40000, investment: { toAccount: 'inv' } }, fixedItems: [], day: '2026-10-12' });
    expect(t.investTotal).toBe(16000);
    expect(t.vault.amount).toBe(34000);
    expect(t.worth).toBe(50000);
    expect(t.title).toBe('西部小鎮');
    expect(t.lots.map((l) => [l.name, l.levelName])).toEqual([['投資帳戶', '小木屋'], ['0056', '小木屋']]);
    expect(t.builtThisMonth).toBe(16000);
  });
});
