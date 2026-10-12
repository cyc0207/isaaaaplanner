import { addDays } from './date.js';
import { MEALS, isLivingExpense } from './budget.js';

export const SLOTS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
export const SLOT_KEYS = Object.keys(SLOTS);
export const SUGARS = ['無糖', '微糖', '半糖', '全糖'];
export const SIZES = ['中', '大'];

// 下一餐：10:30 前早餐、16:00 前午餐、21:00 前晚餐，之後是明天的早餐
export function nextMeal(now = new Date()) {
  const t = now.getHours() * 60 + now.getMinutes();
  if (t < 10 * 60 + 30) return { slot: 'breakfast', tomorrow: false };
  if (t < 16 * 60) return { slot: 'lunch', tomorrow: false };
  if (t < 21 * 60) return { slot: 'dinner', tomorrow: false };
  return { slot: 'breakfast', tomorrow: true };
}

// 這一餐還剩多少預算 = 每餐預算 − 當天這一餐已花
export function slotBudgetLeft(budget, expenses, slot, day) {
  const name = SLOTS[slot];
  const cat = (budget?.categories || []).find((c) => c.name === name && c.kind === 'perDay');
  if (!cat) return null;
  const spent = expenses
    .filter((e) => isLivingExpense(e) && e.date === day && e.category === name)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return (Number(cat.amount) || 0) - spent;
}

export function kcalToday(expenses, day) {
  return expenses.filter((e) => e.date === day && Number(e.kcal) > 0).reduce((s, e) => s + Number(e.kcal), 0);
}

// 最近 2 天（今天、昨天）吃過的清單項目
export function recentlyEaten(expenses, day) {
  const since = addDays(day, -1);
  return new Set(expenses.filter((e) => e.mealId && e.date >= since && e.date <= day).map((e) => e.mealId));
}

// 符合條件的選項：這一餐、預算內、最近 2 天沒吃過；有熱量目標時也不能超過今天剩下的熱量
export function mealCandidates({ meals, slot, budgetLeft, eaten, kcalLeft = null, onlyPlate = false, where = '' }) {
  return meals.filter(
    (m) =>
      (m.slots || []).includes(slot) &&
      (budgetLeft === null || (Number(m.price) || 0) <= budgetLeft) &&
      !eaten.has(m.id) &&
      (kcalLeft === null || !(Number(m.kcal) > 0) || Number(m.kcal) <= kcalLeft) &&
      (!onlyPlate || m.plateOk) &&
      (!where || m.where === where),
  );
}

// 首頁建議：符合一餐盤原則的優先，再看蛋白質，最後便宜的
export function rankMeals(list) {
  return list
    .slice()
    .sort((a, b) => (b.plateOk ? 1 : 0) - (a.plateOk ? 1 : 0) || (Number(b.protein) || 0) - (Number(a.protein) || 0) || (Number(a.price) || 0) - (Number(b.price) || 0));
}

export function cheapestForSlot(meals, slot) {
  return meals.filter((m) => (m.slots || []).includes(slot)).sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))[0] || null;
}

// 轉盤：符合一餐盤原則的格子大一倍
export const wheelWeight = (m) => m.weight ?? (m.plateOk ? 2 : 1);

export function wheelSegments(options) {
  const total = options.reduce((s, m) => s + wheelWeight(m), 0);
  let start = 0;
  return options.map((m) => {
    const size = (wheelWeight(m) / total) * 360;
    const seg = { meal: m, start, end: start + size };
    start += size;
    return seg;
  });
}

// rnd 在 [0, 1)；回傳轉到的格子
export function pickSegment(segments, rnd) {
  const deg = rnd * 360;
  return segments.find((s) => deg >= s.start && deg < s.end) || segments[segments.length - 1];
}

export function mealExpense(meal, slot, day, account) {
  return {
    date: day,
    amount: Math.round(Number(meal.price) || 0),
    type: 'expense',
    category: SLOTS[slot],
    account,
    toAccount: null,
    fixedItemId: null,
    note: meal.name,
    mealId: meal.id,
    kcal: Number(meal.kcal) > 0 ? Number(meal.kcal) : null,
  };
}

export const isMealCategory = (c) => MEALS.includes(c);
export const slotOfCategory = (c) => SLOT_KEYS.find((k) => SLOTS[k] === c) || null;

// 本週全糖幾杯
export function fullSugarCount(expenses, days) {
  return expenses.filter((e) => e.drink?.sugar === '全糖' && e.date >= days[0] && e.date <= days[6]).length;
}

// 第一次使用放的範例，熱量是約略值，提示照包裝修改
export const SAMPLE_MEALS = [
  { id: 'sample-breakfast', name: '茶葉蛋 2 顆＋無糖豆漿', slots: ['breakfast'], price: 55, kcal: 290, protein: 22, where: '便利商店', plateOk: false },
  { id: 'sample-lunch', name: '自助餐：1 拳飯＋1 掌蛋白質＋2 拳青菜', slots: ['lunch', 'dinner'], price: 90, kcal: 600, protein: 30, where: '自助餐', plateOk: true },
  { id: 'sample-dinner', name: '雞胸肉＋生菜沙拉＋無糖茶', slots: ['dinner', 'lunch'], price: 100, kcal: 350, protein: 30, where: '便利商店', plateOk: true },
];
