import { addDays, diffDays, weekStart, monthKey, daysInMonth } from './date.js';
import { categoryBudgets, isLivingExpense, DRINK } from './budget.js';

// 依習慣調整預算：只提建議，按「接受」才改。
// 只看每天、每週的分類（三餐、飲料）；每月一次的化妝品、服飾一週看不出習慣。

export const MIN_DAYS = 28;
const OVER = 1.1;
const UNDER = 0.7;

export function median(nums) {
  if (!nums.length) return 0;
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const round5 = (n) => Math.round(n / 5) * 5;

// 最近 4 個完整的週（週一到週日），不含這一週，舊的在前
export function lastFullWeeks(day, n = 4) {
  const thisMon = weekStart(day);
  return Array.from({ length: n }, (_, i) => {
    const from = addDays(thisMon, -7 * (n - i));
    return { from, to: addDays(from, 6) };
  });
}

function weeklyBudget(cat) {
  if (cat.kind === 'perDay') return (Number(cat.amount) || 0) * 7;
  if (cat.kind === 'perWeek') return (Number(cat.perItem) || 0) * (Number(cat.perWeekCount) || 0);
  return null;
}

export const suggestionKey = (s, day) => `${s.category}:${s.kind}:${weekStart(day)}`;

export function budgetSuggestions({ budget, fixedItems, expenses, day, startDate, dismissed = {} }) {
  if (!startDate || diffDays(startDate, day) < MIN_DAYS) return [];
  const weeks = lastFullWeeks(day);
  const mKey = monthKey(day);
  const days = daysInMonth(mKey);
  const { flex } = categoryBudgets(budget, fixedItems, mKey);
  const living = expenses.filter(isLivingExpense);
  const out = [];

  for (const cat of budget?.categories || []) {
    const wb = weeklyBudget(cat);
    if (wb === null) continue;
    const items = (w) => living.filter((e) => e.category === cat.name && e.date >= w.from && e.date <= w.to);
    const spent = weeks.map((w) => items(w).reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const last3 = spent.slice(-3);
    const from = weeks[0].from;
    const to = weeks[weeks.length - 1].to;
    const all = living.filter((e) => e.category === cat.name && e.date >= from && e.date <= to);

    if (cat.kind === 'perDay') {
      // 每餐實際花多少：每天這一餐的加總取中位數，偶爾一次聚餐不會把建議拉高
      const perDay = {};
      for (const e of all) perDay[e.date] = (perDay[e.date] || 0) + (Number(e.amount) || 0);
      const typical = median(Object.values(perDay));
      const old = Number(cat.amount) || 0;
      if (!typical) continue;
      if (wb > 0 && last3.every((s) => s > wb * OVER)) {
        const next = round5(typical);
        if (next > old) out.push(mk(cat, 'raise', old, next, (next - old) * days, `${cat.name}實際中位數 ${Math.round(typical)} 元，連續 3 週超過預算`));
      } else if (wb > 0 && last3.every((s) => s < wb * UNDER)) {
        const next = Math.max(5, Math.ceil(typical / 5) * 5);
        if (next < old) out.push(mk(cat, 'lower', old, next, (next - old) * days, `${cat.name}實際中位數只花 ${Math.round(typical)} 元，連續 3 週用不到 7 成`));
      }
    } else if (cat.name === DRINK || cat.kind === 'perWeek') {
      const counts = weeks.map((w) => items(w).length);
      const typical = Math.round(median(counts));
      const old = Number(cat.perWeekCount) || 0;
      if (typical > old && counts.slice(-3).every((c) => c > old)) {
        const delta = Math.round(((typical - old) * (Number(cat.perItem) || 0) * days) / 7);
        out.push({
          ...mk(cat, 'count', old, typical, delta, `這 4 週平均每週 ${typical} 杯，設定是 ${old} 杯`),
          field: 'perWeekCount',
          alternative: '維持預算，改成中杯或少糖',
        });
      }
    }
  }

  return out
    .filter((s) => !dismissed[suggestionKey(s, day)])
    .map((s) => ({ ...s, key: suggestionKey(s, day), shortBy: s.monthlyDelta > 0 ? Math.max(0, s.monthlyDelta - flex) : 0 }));
}

function mk(cat, kind, oldValue, newValue, monthlyDelta, reason) {
  return { category: cat.name, kind, field: 'amount', oldValue, newValue, monthlyDelta, reason };
}

// 接受建議：改分類預算，並寫一筆調整紀錄
export function applySuggestion(budget, s) {
  return {
    ...budget,
    categories: (budget.categories || []).map((c) => (c.name === s.category ? { ...c, [s.field]: s.newValue } : c)),
  };
}
