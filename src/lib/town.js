import { monthKey, monthRange, prevMonthKey, daysInMonth } from './date.js';
import { investDashboard, INVEST_WORD } from './invest.js';
import { accountBalances, allocation, isLivingExpense, sumWhere } from './budget.js';

export const INVEST_HINT = `記帳時分類或備註寫「${INVEST_WORD}」（例如「0056 ${INVEST_WORD}」），就會在島上插旗蓋房子。`;

// 我的牛仔小鎮：記帳變成蓋房子。不另外存資料，全部從記帳算出來。
// 每個投資標的是一塊地，累計投入越多房子越大
export const BUILDINGS = [
  { min: 0, key: 'lot', name: '插旗空地' },
  { min: 1000, key: 'tent', name: '帳篷' },
  { min: 5000, key: 'cabin', name: '小木屋' },
  { min: 15000, key: 'store', name: '雜貨店' },
  { min: 30000, key: 'saloon', name: '酒館' },
  { min: 60000, key: 'hotel', name: '旅館' },
  { min: 120000, key: 'clock', name: '鐘樓飯店' },
  { min: 250000, key: 'gold', name: '黃金大樓' },
];

// 存款（投資帳戶以外的帳戶餘額）是一座金礦，越多金塊堆越高
export const VAULTS = [
  { min: 0, key: 'v0', name: '錢袋' },
  { min: 10000, key: 'v1', name: '小金礦' },
  { min: 50000, key: 'v2', name: '金礦' },
  { min: 150000, key: 'v3', name: '大金礦' },
  { min: 500000, key: 'v4', name: '黃金山' },
];

// 小鎮身價 = 投資累計 + 存款
export const TOWN_TITLES = [
  { min: 0, name: '荒漠' },
  { min: 1, name: '營地' },
  { min: 10000, name: '牧場' },
  { min: 50000, name: '西部小鎮' },
  { min: 200000, name: '淘金城' },
  { min: 1000000, name: '黃金之都' },
];

export function tierOf(ladder, amount) {
  let i = 0;
  while (i + 1 < ladder.length && amount >= ladder[i + 1].min) i++;
  const next = ladder[i + 1] || null;
  const cur = ladder[i];
  return {
    level: i,
    key: cur.key,
    levelName: cur.name,
    next,
    toNext: next ? next.min - amount : 0,
    progress: next ? Math.max(0, Math.min(1, (amount - cur.min) / (next.min - cur.min))) : 1,
  };
}

// 仙人掌園：過去幾個月，生活費守住就種一棵仙人掌，超支就是一團風滾草。
// 沒有任何生活費紀錄的月份不算（還沒開始用 app）
export function parkMonths(expenses, living, day, months = 6) {
  if (!(living > 0)) return [];
  const out = [];
  let k = prevMonthKey(monthKey(day));
  for (let i = 0; i < months; i++) {
    const { from, to } = monthRange(k);
    const has = expenses.some((e) => isLivingExpense(e) && e.date >= from && e.date <= to);
    if (has) {
      const spent = sumWhere(expenses, (e) => isLivingExpense(e) && e.date >= from && e.date <= to);
      out.unshift({ key: k, spent, living, saved: living - spent, kept: spent <= living });
    }
    k = prevMonthKey(k);
  }
  return out;
}

// 這個月的天氣：生活費照進度花是晴天，花太快起沙塵，超過整個月就是暴風
export function weather(expenses, living, day) {
  if (!(living > 0)) return { kind: 'none', spent: 0, pace: 0 };
  const mKey = monthKey(day);
  const { from } = monthRange(mKey);
  const spent = sumWhere(expenses, (e) => isLivingExpense(e) && e.date >= from && e.date <= day);
  const dayNo = Number(day.slice(8, 10));
  const pace = (living * dayNo) / daysInMonth(mKey);
  const kind = spent > living ? 'storm' : spent > pace ? 'dust' : 'sun';
  return { kind, spent, pace: Math.round(pace), living };
}

export function town({ expenses, accounts = [], budget, fixedItems = [], day }) {
  const inv = investDashboard({ expenses, budget, day });
  const toAccount = budget?.investment?.toAccount || null;
  const lots = inv.targets.map((t) => ({
    name: t.name === '薪資分配轉入' ? '投資帳戶' : t.name,
    total: t.total,
    month: t.month,
    count: t.count,
    ...tierOf(BUILDINGS, t.total),
  }));

  const bal = accountBalances(accounts, expenses.filter((e) => e.date <= day));
  const savings = Math.max(
    0,
    accounts.filter((a) => a.id !== toAccount).reduce((s, a) => s + (bal[a.id] || 0), 0),
  );
  const vault = { amount: savings, ...tierOf(VAULTS, savings) };

  const { living } = allocation(budget, fixedItems);
  const park = parkMonths(expenses, living, day);
  const worth = inv.total + savings;
  return {
    worth,
    title: tierOf(TOWN_TITLES, worth).levelName,
    lots,
    vault,
    park,
    trees: park.filter((m) => m.kept).length,
    parkSaved: park.filter((m) => m.kept).reduce((s, m) => s + m.saved, 0),
    weather: weather(expenses, living, day),
    builtThisMonth: inv.month,
    investTotal: inv.total,
  };
}
