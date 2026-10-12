import { monthKey, monthRange, prevMonthKey } from './date.js';

// 支出的分類或備註有「定期定額」，就算投資（例：分類「0056 定期定額」）
export const INVEST_WORD = '定期定額';

export const isInvestExpense = (e) =>
  e.type === 'expense' && (String(e.category || '').includes(INVEST_WORD) || String(e.note || '').includes(INVEST_WORD));

// 薪資分配轉到投資帳戶的那筆也算
const isInvestTransfer = (e, toAccount) => e.type === 'transfer' && !!toAccount && e.toAccount === toAccount;

// 標的名稱：分類拿掉「定期定額」剩下的字（0056）；分類沒寫就看備註；都沒有叫「定期定額」
export function investTarget(e) {
  const strip = (s) => String(s || '').replace(INVEST_WORD, '').replace(/[\s:：・\-]+/g, ' ').trim();
  if (e.type === 'transfer') return '薪資分配轉入';
  const fromCat = String(e.category || '').includes(INVEST_WORD) ? strip(e.category) : '';
  if (fromCat) return fromCat;
  const fromNote = String(e.note || '').includes(INVEST_WORD) ? strip(e.note) : '';
  return fromNote || INVEST_WORD;
}

export function investRecords(expenses, toAccount) {
  return expenses.filter((e) => isInvestExpense(e) || isInvestTransfer(e, toAccount));
}

const sum = (list) => list.reduce((s, e) => s + (Number(e.amount) || 0), 0);

// 投資儀表板：本月、累計、占薪水和占本月花出去的錢、各標的、最近 6 個月
export function investDashboard({ expenses, budget, day, months = 6 }) {
  const toAccount = budget?.investment?.toAccount || null;
  const all = investRecords(expenses, toAccount).filter((e) => e.date <= day);
  const mKey = monthKey(day);
  const { from, to } = monthRange(mKey);
  const inMonth = all.filter((e) => e.date >= from && e.date <= to);
  const month = sum(inMonth);
  const total = sum(all);

  const salary = Number(budget?.salary) || 0;
  const monthIncome = sum(expenses.filter((e) => e.type === 'income' && e.category === '薪水' && e.date >= from && e.date <= to));
  const base = salary || monthIncome;
  // 本月花出去的錢 = 一般支出 + 轉進投資帳戶
  const monthOut = sum(expenses.filter((e) => e.date >= from && e.date <= to && (e.type === 'expense' || isInvestTransfer(e, toAccount))));

  const byTarget = {};
  for (const e of all) {
    const k = investTarget(e);
    byTarget[k] ||= { name: k, total: 0, month: 0, count: 0 };
    byTarget[k].total += Number(e.amount) || 0;
    byTarget[k].count += 1;
    if (e.date >= from && e.date <= to) byTarget[k].month += Number(e.amount) || 0;
  }
  const targets = Object.values(byTarget).sort((a, b) => b.total - a.total);

  const history = [];
  let k = mKey;
  for (let i = 0; i < months; i++) {
    const r = monthRange(k);
    history.unshift({ key: k, amount: sum(all.filter((e) => e.date >= r.from && e.date <= r.to)) });
    k = prevMonthKey(k);
  }

  const months0 = new Set(all.map((e) => monthKey(e.date))).size;
  return {
    month,
    total,
    salary: base,
    salaryRatio: base > 0 ? month / base : null,
    monthOut,
    outRatio: monthOut > 0 ? month / monthOut : null,
    targets,
    history,
    avg: months0 ? Math.round(total / months0) : 0,
    recent: all.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs || 0) - (a.createdAtMs || 0)).slice(0, 8),
  };
}
