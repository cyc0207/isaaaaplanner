import { daysInMonth, monthKey, weekDays, diffDays, monthRange } from './date.js';

export const FLEX = '彈性';
export const MEALS = ['早餐', '午餐', '晚餐'];
export const DRINK = '飲料';
export const ADJUST = '調整';

export const DEFAULT_EXPENSE_CATEGORIES = ['早餐', '午餐', '晚餐', '飲料', '化妝品', '服飾', '交通', '娛樂', '學習', '生活', '其他'];
export const DEFAULT_INCOME_CATEGORIES = ['薪水', '獎學金', '其他'];

export const DEFAULT_BUDGET_CATEGORIES = [
  { name: '早餐', kind: 'perDay', amount: 60 },
  { name: '午餐', kind: 'perDay', amount: 100 },
  { name: '晚餐', kind: 'perDay', amount: 100 },
  { name: '飲料', kind: 'perWeek', perItem: 60, perWeekCount: 3 },
  { name: '化妝品', kind: 'perMonth', amount: 0 },
  { name: '服飾', kind: 'perMonth', amount: 0 },
];

// 比例可以輸入 1/3、0.25 或 25%
export function parseRatio(input) {
  const s = String(input).trim();
  let m;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/))) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*%$/))) return Number(m[1]) / 100;
  if (/^\d*\.?\d+$/.test(s)) return Number(s);
  return NaN;
}

export function formatRatio(r) {
  for (const d of [2, 3, 4, 5, 10]) {
    const n = r * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return `${Math.round(n)}/${d}`;
  }
  return `${Math.round(r * 10000) / 100}%`;
}

export function investmentAmount(budget) {
  const inv = budget?.investment || {};
  const salary = Number(budget?.salary) || 0;
  if (inv.mode === 'fixed') return Number(inv.amount) || 0;
  const ratio = inv.ratio ?? 1 / 3;
  // 無條件捨去到百位；加一點容差避免 0.1+0.2 這類浮點誤差
  return Math.floor((salary * ratio) / 100 + 1e-9) * 100;
}

export function fixedTotal(fixedItems) {
  return fixedItems.reduce((s, f) => s + (Number(f.amount) || 0), 0);
}

export function allocation(budget, fixedItems) {
  const salary = Number(budget?.salary) || 0;
  const investment = investmentAmount(budget);
  const fixed = fixedTotal(fixedItems);
  return { salary, investment, fixed, living: salary - investment - fixed };
}

export function categoryMonthlyBudget(cat, mKey) {
  const days = daysInMonth(mKey);
  if (cat.kind === 'perDay') return (Number(cat.amount) || 0) * days;
  if (cat.kind === 'perWeek') return Math.round(((Number(cat.perItem) || 0) * (Number(cat.perWeekCount) || 0) * days) / 7);
  return Number(cat.amount) || 0;
}

export function categoryBudgets(budget, fixedItems, mKey) {
  const { living } = allocation(budget, fixedItems);
  const cats = (budget?.categories || []).map((c) => ({ ...c, budget: categoryMonthlyBudget(c, mKey) }));
  const sum = cats.reduce((s, c) => s + c.budget, 0);
  return { living, cats, sum, flex: living - sum, over: Math.max(0, sum - living) };
}

const inRange = (d, from, to) => d >= from && d <= to;

// 生活費的支出：一般支出，不含固定支出產生的那幾筆
export const isLivingExpense = (e) => e.type === 'expense' && !e.fixedItemId;

export function spentByBucket(expenses, budgetCats, from, to) {
  const names = new Set(budgetCats.map((c) => c.name));
  const out = { [FLEX]: 0 };
  for (const c of budgetCats) out[c.name] = 0;
  for (const e of expenses) {
    if (!isLivingExpense(e) || !inRange(e.date, from, to)) continue;
    const bucket = names.has(e.category) ? e.category : FLEX;
    out[bucket] += Number(e.amount) || 0;
  }
  return out;
}

// 每個分類：本月預算、已花、剩下、狀態（ok / warn 80% / over）
export function budgetProgress(budget, fixedItems, expenses, mKey) {
  const { living, cats, flex } = categoryBudgets(budget, fixedItems, mKey);
  const { from, to } = monthRange(mKey);
  const spent = spentByBucket(expenses, cats, from, to);
  const rows = [...cats.map((c) => ({ name: c.name, budget: c.budget })), { name: FLEX, budget: flex }];
  return {
    living,
    rows: rows.map((r) => {
      const s = spent[r.name] || 0;
      const ratio = r.budget > 0 ? s / r.budget : s > 0 ? Infinity : 0;
      return { ...r, spent: s, left: r.budget - s, ratio, status: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok' };
    }),
  };
}

export function sumWhere(expenses, pred) {
  return expenses.reduce((s, e) => (pred(e) ? s + (Number(e.amount) || 0) : s), 0);
}

// 今天餐費還剩 = 三餐每餐預算加總 − 今天三餐已花
export function todayMealLeft(budget, expenses, day) {
  const cats = (budget?.categories || []).filter((c) => MEALS.includes(c.name) && c.kind === 'perDay');
  const daily = cats.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const names = new Set(cats.map((c) => c.name));
  const spent = sumWhere(expenses, (e) => isLivingExpense(e) && e.date === day && names.has(e.category));
  return { daily, spent, left: daily - spent };
}

// 本週飲料還剩 = 每杯 × 每週杯數 − 本週（週一到週日）飲料已花
export function weekDrinkLeft(budget, expenses, day) {
  const cat = (budget?.categories || []).find((c) => c.name === DRINK);
  const weekly = cat ? (Number(cat.perItem) || 0) * (Number(cat.perWeekCount) || 0) : 0;
  const days = weekDays(day);
  const spent = sumWhere(expenses, (e) => isLivingExpense(e) && e.category === DRINK && inRange(e.date, days[0], days[6]));
  return { weekly, spent, left: weekly - spent };
}

// 本月生活費剩下、平均每天還能花
export function livingSummary(budget, fixedItems, expenses, day) {
  const mKey = monthKey(day);
  const { living } = allocation(budget, fixedItems);
  const { from, to } = monthRange(mKey);
  const spent = sumWhere(expenses, (e) => isLivingExpense(e) && inRange(e.date, from, to));
  const left = living - spent;
  const daysLeft = diffDays(day, to) + 1;
  return { living, spent, left, daysLeft, perDay: daysLeft > 0 ? Math.floor(left / daysLeft) : left };
}

export function monthTotals(expenses, mKey, investmentAccountId) {
  const { from, to } = monthRange(mKey);
  const inMonth = expenses.filter((e) => inRange(e.date, from, to));
  const income = sumWhere(inMonth, (e) => e.type === 'income');
  const expense = sumWhere(inMonth, (e) => e.type === 'expense');
  const invested = sumWhere(inMonth, (e) => e.type === 'transfer' && investmentAccountId && e.toAccount === investmentAccountId);
  return { income, expense, net: income - expense, invested };
}

// 帳戶餘額 = 初始餘額 + 收入 − 支出 ± 轉帳
export function accountBalances(accounts, expenses) {
  const bal = Object.fromEntries(accounts.map((a) => [a.id, Number(a.initialBalance) || 0]));
  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    if (e.type === 'income' && e.account in bal) bal[e.account] += amt;
    else if (e.type === 'expense' && e.account in bal) bal[e.account] -= amt;
    else if (e.type === 'transfer') {
      if (e.account in bal) bal[e.account] -= amt;
      if (e.toAccount in bal) bal[e.toAccount] += amt;
    }
  }
  return bal;
}

// 記帳按鈕順序：現在這一餐第一個，飲料固定第二個，其餘照原本順序
export function currentMeal(hour, minute = 0) {
  const t = hour * 60 + minute;
  if (t < 10 * 60 + 30) return '早餐';
  if (t < 16 * 60) return '午餐';
  return '晚餐';
}

export function orderCategories(categories, now = new Date()) {
  const meal = currentMeal(now.getHours(), now.getMinutes());
  const first = categories.includes(meal) ? [meal] : [];
  const second = categories.includes(DRINK) && meal !== DRINK ? [DRINK] : [];
  return [...first, ...second, ...categories.filter((c) => c !== meal && c !== DRINK)];
}
