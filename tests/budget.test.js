import { describe, it, expect } from 'vitest';
import {
  allocation, categoryBudgets, accountBalances, monthTotals, todayMealLeft, weekDrinkLeft,
  budgetProgress, orderCategories, parseRatio, DEFAULT_BUDGET_CATEGORIES,
} from '../src/lib/budget.js';

const budget = (over = {}) => ({
  salary: 30000,
  investment: { mode: 'ratio', ratio: 1 / 3, toAccount: 'broker' },
  categories: DEFAULT_BUDGET_CATEGORIES,
  ...over,
});
const fixed = [{ id: 'rent', amount: 3000, day: 1 }];

describe('薪資分配', () => {
  it('薪水 30,000、固定支出 3,000：定期定額 10,000、生活費 17,000', () => {
    expect(allocation(budget(), fixed)).toMatchObject({ investment: 10000, fixed: 3000, living: 17000 });
  });
  it('定期定額無條件捨去到百位，也可以改固定金額', () => {
    expect(allocation(budget({ salary: 31000 }), []).investment).toBe(10300);
    expect(allocation(budget({ investment: { mode: 'fixed', amount: 5000 } }), []).investment).toBe(5000);
  });
  it('固定支出太多時生活費是負的', () => {
    expect(allocation(budget(), [{ amount: 25000 }]).living).toBeLessThan(0);
  });
  it('比例輸入 1/3、25%、0.2', () => {
    expect(parseRatio('1/3')).toBeCloseTo(1 / 3);
    expect(parseRatio('25%')).toBe(0.25);
    expect(parseRatio('0.2')).toBe(0.2);
    expect(parseRatio('abc')).toBeNaN();
  });
});

describe('分類預算', () => {
  it('每餐 × 天數、飲料 × 週數，彈性 = 生活費 − 加總', () => {
    const r = categoryBudgets(budget(), fixed, '2026-10');
    const byName = Object.fromEntries(r.cats.map((c) => [c.name, c.budget]));
    expect(byName['早餐']).toBe(60 * 31);
    expect(byName['飲料']).toBe(Math.round((60 * 3 * 31) / 7));
    expect(r.flex).toBe(17000 - r.sum);
    expect(r.over).toBe(0);
  });
  it('加總超過生活費時 over > 0', () => {
    const b = budget({ categories: [{ name: '午餐', kind: 'perDay', amount: 1000 }] });
    expect(categoryBudgets(b, fixed, '2026-10').over).toBe(31000 - 17000);
  });
});

describe('帳戶與轉帳', () => {
  const accounts = [{ id: 'salary', initialBalance: 5000 }, { id: 'cash', initialBalance: 100 }];
  const ex = [
    { date: '2026-10-11', type: 'transfer', amount: 1000, account: 'salary', toAccount: 'cash' },
    { date: '2026-10-11', type: 'expense', amount: 80, account: 'cash', category: '午餐' },
  ];
  it('從薪資戶轉帳到現金：總支出不變，兩個帳戶餘額正確', () => {
    expect(accountBalances(accounts, ex)).toEqual({ salary: 4000, cash: 1020 });
    expect(monthTotals(ex, '2026-10').expense).toBe(80);
    expect(monthTotals(ex, '2026-10').income).toBe(0);
  });
});

describe('首頁餐費與飲料', () => {
  it('午餐超過每餐預算，今天餐費還剩正確', () => {
    const ex = [{ date: '2026-10-11', type: 'expense', amount: 150, category: '午餐', account: 'cash' }];
    expect(todayMealLeft(budget(), ex, '2026-10-11')).toEqual({ daily: 260, spent: 150, left: 110 });
  });
  it('記一杯飲料：本週飲料還剩和進度條同步', () => {
    const ex = [{ date: '2026-10-07', type: 'expense', amount: 55, category: '飲料', account: 'cash' }];
    expect(weekDrinkLeft(budget(), ex, '2026-10-11').left).toBe(180 - 55);
    const drink = budgetProgress(budget(), fixed, ex, '2026-10').rows.find((r) => r.name === '飲料');
    expect(drink.spent).toBe(55);
    // 上一週的不算
    expect(weekDrinkLeft(budget(), ex, '2026-10-12').left).toBe(180);
  });
  it('沒有預算的分類算進彈性；固定支出產生的支出不算生活費', () => {
    const ex = [
      { date: '2026-10-02', type: 'expense', amount: 300, category: '交通' },
      { date: '2026-10-02', type: 'expense', amount: 3000, category: '其他', fixedItemId: 'rent' },
    ];
    const flex = budgetProgress(budget(), fixed, ex, '2026-10').rows.find((r) => r.name === '彈性');
    expect(flex.spent).toBe(300);
  });
});

describe('記帳分類順序', () => {
  const cats = ['早餐', '午餐', '晚餐', '飲料', '交通'];
  it('早上早餐第一、飲料第二', () => {
    expect(orderCategories(cats, new Date(2026, 9, 11, 8)).slice(0, 2)).toEqual(['早餐', '飲料']);
    expect(orderCategories(cats, new Date(2026, 9, 11, 12)).slice(0, 2)).toEqual(['午餐', '飲料']);
    expect(orderCategories(cats, new Date(2026, 9, 11, 19)).slice(0, 2)).toEqual(['晚餐', '飲料']);
  });
});
