import { describe, it, expect } from 'vitest';
import { isInvestExpense, investTarget, investDashboard } from '../src/lib/invest.js';
import { isLivingExpense, monthTotals } from '../src/lib/budget.js';

const ex = (date, amount, category, note = '') => ({ id: `${date}-${category}-${amount}`, date, amount, type: 'expense', category, note });

describe('定期定額算投資', () => {
  it('分類或備註有定期定額就算', () => {
    expect(isInvestExpense(ex('2026-10-06', 3000, '0056 定期定額'))).toBe(true);
    expect(isInvestExpense(ex('2026-10-06', 3000, '其他', '00878 定期定額'))).toBe(true);
    expect(isInvestExpense(ex('2026-10-06', 100, '午餐'))).toBe(false);
  });
  it('不算生活費，但算進本月投資', () => {
    const e = ex('2026-10-06', 3000, '0056 定期定額');
    expect(isLivingExpense(e)).toBe(false);
    expect(monthTotals([e], '2026-10', null).invested).toBe(3000);
  });
  it('標的名稱', () => {
    expect(investTarget(ex('2026-10-06', 1, '0056 定期定額'))).toBe('0056');
    expect(investTarget(ex('2026-10-06', 1, '其他', '00878定期定額'))).toBe('00878');
    expect(investTarget(ex('2026-10-06', 1, '定期定額'))).toBe('定期定額');
  });
  it('儀表板：本月、累計、占薪水、各標的', () => {
    const expenses = [
      ex('2026-09-06', 3000, '0056 定期定額'),
      ex('2026-10-06', 3000, '0056 定期定額'),
      ex('2026-10-08', 2000, '其他', '00878 定期定額'),
      ex('2026-10-09', 5000, '午餐'),
      { id: 't', date: '2026-10-05', amount: 10000, type: 'transfer', account: 'a', toAccount: 'inv' },
    ];
    const d = investDashboard({ expenses, budget: { salary: 40000, investment: { toAccount: 'inv' } }, day: '2026-10-12' });
    expect(d.month).toBe(15000);
    expect(d.total).toBe(18000);
    expect(d.salaryRatio).toBeCloseTo(15000 / 40000);
    expect(d.monthOut).toBe(20000);
    expect(d.targets.map((t) => t.name)).toEqual(['薪資分配轉入', '0056', '00878']);
    expect(d.history.at(-1)).toEqual({ key: '2026-10', amount: 15000 });
    expect(d.history.at(-2).amount).toBe(3000);
  });
});
