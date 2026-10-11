import { describe, it, expect } from 'vitest';
import { budgetSuggestions, applySuggestion, lastFullWeeks, median } from '../src/lib/suggest.js';
import {
  nextMeal, mealCandidates, rankMeals, recentlyEaten, slotBudgetLeft, wheelSegments, pickSegment, fullSugarCount, mealExpense,
} from '../src/lib/meals.js';
import { bmr, calorieTarget, weightTrend, needsWeighIn, trendLabel } from '../src/lib/body.js';
import { inboxDeadlines } from '../src/lib/inbox.js';
import { addDays, weekDays } from '../src/lib/date.js';
import { DEFAULT_BUDGET_CATEGORIES } from '../src/lib/budget.js';

const budget = {
  salary: 30000,
  investment: { mode: 'ratio', ratio: 1 / 3 },
  categories: DEFAULT_BUDGET_CATEGORIES, // 午餐 100、飲料 60 × 3
};
const exp = (date, category, amount, extra = {}) => ({ id: `${date}-${category}-${amount}`, date, category, amount, type: 'expense', fixedItemId: null, ...extra });

// 2026-11-15 是週日；前 4 個完整的週是 10/19–11/15 往前推
const DAY = '2026-11-16';
const weeks = lastFullWeeks(DAY);

function everyDay(fn) {
  const out = [];
  for (const w of weeks) for (let i = 0; i < 7; i++) out.push(...fn(addDays(w.from, i)));
  return out;
}

describe('依習慣調整預算', () => {
  it('前 4 個完整的週是週一到週日、不含這週', () => {
    expect(weeks[3]).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(weeks[0].from).toBe('2026-10-19');
  });
  it('資料不滿 4 週時不給建議', () => {
    const expenses = everyDay((d) => [exp(d, '午餐', 130)]);
    expect(budgetSuggestions({ budget, fixedItems: [], expenses, day: DAY, startDate: addDays(DAY, -20) })).toEqual([]);
  });
  it('午餐連續 3 週超支 10% 以上：建議調成中位數，差額從彈性扣', () => {
    const expenses = everyDay((d) => [exp(d, '午餐', d.endsWith('1') ? 400 : 115)]);
    const [s] = budgetSuggestions({ budget, fixedItems: [], expenses, day: DAY, startDate: '2026-10-01' });
    expect(s).toMatchObject({ category: '午餐', kind: 'raise', oldValue: 100, newValue: 115, monthlyDelta: 15 * 30 });
    // 聚餐那幾天 400 元不會把建議拉高（中位數）
    expect(s.shortBy).toBe(0);
    const next = applySuggestion(budget, s);
    expect(next.categories.find((c) => c.name === '午餐').amount).toBe(115);
  });
  it('彈性不夠時標出還差多少', () => {
    const tight = { ...budget, salary: 12000 };
    const expenses = everyDay((d) => [exp(d, '午餐', 150)]);
    const [s] = budgetSuggestions({ budget: tight, fixedItems: [], expenses, day: DAY, startDate: '2026-10-01' });
    expect(s.shortBy).toBeGreaterThan(0);
  });
  it('連續 3 週用不到 7 成：建議調低', () => {
    const expenses = everyDay((d) => [exp(d, '早餐', 40)]);
    const s = budgetSuggestions({ budget, fixedItems: [], expenses, day: DAY, startDate: '2026-10-01' }).find((x) => x.category === '早餐');
    expect(s).toMatchObject({ kind: 'lower', oldValue: 60, newValue: 40 });
  });
  it('飲料杯數比設定多：建議調杯數，並給維持預算的選項', () => {
    const expenses = weeks.flatMap((w) => [0, 1, 2, 3, 4].map((i) => exp(addDays(w.from, i), '飲料', 60)));
    const s = budgetSuggestions({ budget, fixedItems: [], expenses, day: DAY, startDate: '2026-10-01' }).find((x) => x.category === '飲料');
    expect(s).toMatchObject({ kind: 'count', field: 'perWeekCount', oldValue: 3, newValue: 5 });
    expect(s.alternative).toBeTruthy();
  });
  it('按過略過的同一週不再出現', () => {
    const expenses = everyDay((d) => [exp(d, '午餐', 130)]);
    const args = { budget, fixedItems: [], expenses, day: DAY, startDate: '2026-10-01' };
    const [s] = budgetSuggestions(args);
    expect(budgetSuggestions({ ...args, dismissed: { [s.key]: true } })).toEqual([]);
  });
  it('中位數', () => {
    expect(median([1, 100, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

const meals = [
  { id: 'a', name: '茶葉蛋', slots: ['breakfast'], price: 30, plateOk: false, protein: 14 },
  { id: 'b', name: '飯糰＋豆漿', slots: ['breakfast'], price: 55, plateOk: true, protein: 12 },
  { id: 'c', name: '早午餐', slots: ['breakfast'], price: 120, plateOk: true, protein: 20 },
  { id: 'd', name: '自助餐', slots: ['lunch'], price: 90, plateOk: true, protein: 25, kcal: 600 },
];

describe('吃什麼', () => {
  it('早上 8 點的下一餐是早餐，晚上 10 點是明天早餐', () => {
    expect(nextMeal(new Date(2026, 10, 1, 8, 0))).toEqual({ slot: 'breakfast', tomorrow: false });
    expect(nextMeal(new Date(2026, 10, 1, 12, 0)).slot).toBe('lunch');
    expect(nextMeal(new Date(2026, 10, 1, 22, 0))).toEqual({ slot: 'breakfast', tomorrow: true });
  });
  it('只出現這一餐、預算內、2 天內沒吃過的', () => {
    const day = '2026-11-02';
    const eaten = recentlyEaten([exp('2026-11-01', '早餐', 30, { mealId: 'a' }), exp('2026-10-30', '早餐', 55, { mealId: 'b' })], day);
    const left = slotBudgetLeft(budget, [], 'breakfast', day);
    expect(left).toBe(60);
    const list = mealCandidates({ meals, slot: 'breakfast', budgetLeft: left, eaten });
    expect(list.map((m) => m.id)).toEqual(['b']);
  });
  it('建議時符合一餐盤的排前面', () => {
    expect(rankMeals(meals.slice(0, 2)).map((m) => m.id)).toEqual(['b', 'a']);
  });
  it('有熱量目標時不能超過今天剩下的熱量', () => {
    expect(mealCandidates({ meals, slot: 'lunch', budgetLeft: 100, eaten: new Set(), kcalLeft: 500 })).toEqual([]);
  });
  it('轉盤：符合一餐盤的格子大一倍，抽到的對得上格子', () => {
    const segs = wheelSegments(meals.slice(0, 2));
    expect(segs[0].end - segs[0].start).toBe(120);
    expect(segs[1].end - segs[1].start).toBe(240);
    expect(pickSegment(segs, 0.1).meal.id).toBe('a');
    expect(pickSegment(segs, 0.9).meal.id).toBe('b');
  });
  it('點選項記帳：金額、分類、熱量一起記', () => {
    expect(mealExpense(meals[3], 'lunch', '2026-11-02', 'cash')).toMatchObject({ amount: 90, category: '午餐', mealId: 'd', kcal: 600, type: 'expense' });
  });
  it('本週全糖幾杯', () => {
    const e = [exp('2026-11-02', '飲料', 60, { drink: { sugar: '全糖' } }), exp('2026-11-03', '飲料', 60, { drink: { sugar: '微糖' } }), exp('2026-10-31', '飲料', 60, { drink: { sugar: '全糖' } })];
    expect(fullSugarCount(e, weekDays('2026-11-04'))).toBe(1);
  });
});

describe('體重與熱量', () => {
  const body = { heightCm: 160, age: 21, sex: 'female', activity: 1.2, deficit: 500 };
  it('Mifflin-St Jeor', () => {
    expect(bmr({ kg: 60, heightCm: 160, age: 21, sex: 'female' })).toBe(1334);
  });
  it('熱量目標低於基礎代謝時用基礎代謝當下限', () => {
    const t = calorieTarget(body, { kg: 60 });
    expect(t.tdee - t.deficit).toBeLessThan(t.bmr);
    expect(t).toMatchObject({ target: t.bmr, floored: true });
  });
  it('不填身高體重就沒有目標', () => {
    expect(calorieTarget(null, { kg: 60 })).toBeNull();
    expect(calorieTarget(body, null)).toBeNull();
  });
  it('4 週趨勢用斜率，不看單次增減', () => {
    const log = { '2026-10-12': { kg: 61 }, '2026-10-19': { kg: 60.6 }, '2026-10-26': { kg: 60.9 }, '2026-11-02': { kg: 60 } };
    const tr = weightTrend(log, '2026-11-02');
    expect(tr.perWeek).toBeLessThan(0);
    expect(trendLabel(tr.perWeek)).toContain('下降');
    expect(trendLabel(weightTrend({ '2026-11-02': { kg: 60 } }, '2026-11-02').perWeek)).toContain('至少');
  });
  it('這週量過就不提醒', () => {
    expect(needsWeighIn({ '2026-11-02': { kg: 60 } }, '2026-11-04')).toBe(false);
    expect(needsWeighIn({ '2026-10-30': { kg: 60 } }, '2026-11-04')).toBe(true);
  });
});

describe('收件匣', () => {
  it('有截止日的出現在行事曆，放棄的不出現', () => {
    const dl = inboxDeadlines([
      { id: 'x', kind: 'competition', title: '創新創業競賽', deadline: '2026-11-20', submitDate: '2026-12-10', status: '要報' },
      { id: 'y', kind: 'resume', title: '行銷實習', deadline: '2026-11-25', status: '要投' },
      { id: 'z', kind: 'competition', title: '放棄的', deadline: '2026-11-22', status: '放棄' },
    ]);
    expect(dl.map((d) => d.date)).toEqual(['2026-11-20', '2026-12-10', '2026-11-25']);
    expect(dl.every((d) => d.fromInbox && d.remindDayBefore)).toBe(true);
  });
});
