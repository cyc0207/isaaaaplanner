import { DEFAULT_BUDGET_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './budget.js';
import { monthKey } from './date.js';
import { SAMPLE_MEALS } from './meals.js';

export const DEFAULT_HABITS = ['英文 15 分鐘', '記帳', '看清單', '動 10 分鐘'];
export const ENGLISH_HABIT = '英文 15 分鐘';

// 第一次登入時寫入的初始資料。id 固定，重複執行也不會多一份。
export function seedDocs(day) {
  const docs = [];
  const add = (path, data) => docs.push({ path, data });

  [
    ['salary', '薪資戶', true],
    ['broker', '證券交割戶', false],
    ['cash', '現金', false],
    ['linepay', 'LINE Pay', false],
    ['other', '其他帳戶', false],
  ].forEach(([id, name, isDefault], i) => add(`accounts/${id}`, { name, initialBalance: 0, isDefault, order: i }));

  add('settings/budget', {
    payday: 5,
    salary: 0,
    salaryAccount: 'salary',
    investment: { mode: 'ratio', ratio: 1 / 3, amount: 0, toAccount: 'broker' },
    categories: DEFAULT_BUDGET_CATEGORIES,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    incomeCategories: DEFAULT_INCOME_CATEGORIES,
  });
  add('settings/reconcile', { cycle: 'weekly', day: 0, shortcuts: [] });
  add('settings/habits', { items: DEFAULT_HABITS });

  [
    ['2026-10-15', '企業倫理實體課', '企業倫理', true, false],
    ['2026-10-30', '資訊管理專題課程報告（題目：愛迪達）', '專題報告', false, false],
    ['2026-11-07', '資服競賽決賽 8:00–17:00', 'DecorateMe', false, false],
    ['2026-11-11', '企業倫理實體課', '企業倫理', true, false],
    ['2026-11-16', 'DecorateMe 新功能開工', 'DecorateMe', false, false],
    ['2026-12-01', '實習期末英文 Presentation', '實習報告', false, true],
    ['2026-12-23', '企業倫理實體課', '企業倫理', true, false],
  ].forEach(([date, title, project, remindDayBefore, tentative], i) =>
    add(`deadlines/seed-${i + 1}`, { title, date, project, remindDayBefore, tentative, note: '' }),
  );

  add('recurring/english', { title: '英文 15 分鐘', rule: 'daily', special: 'habit' });
  add('recurring/ethics', { title: '看企業倫理線上課程影片', rule: 'weekly:tue', special: null });
  add('recurring/math', { title: '看基礎數學線上課程影片', rule: 'weekly:thu', special: null });
  add('recurring/close', { title: '作上個月的帳', rule: 'monthly:1', special: 'monthClose' });
  add('recurring/plan', { title: '排下週', rule: 'weekly:sun', special: 'planWeek' });

  [
    ['確認愛迪達報告的規格與繳交方式（頁數、上台時間、分工）', '專題報告'],
    ['英文：挑一段實習工作內容，用英文講 2 分鐘並錄音', '英文'],
  ].forEach(([title, project], i) =>
    add(`tasks/seed-${i + 1}`, { title, date: '2026-10-12', project, note: '', done: false, doneAt: null, isToday: false }),
  );

  add('settings/meta', { version: 2, startDate: day, startMonth: monthKey(day) });
  return docs;
}

// 第二版：常吃清單範例（熱量是約略值，畫面上提示照包裝修改）
export function v2SeedDocs() {
  return SAMPLE_MEALS.map(({ id, ...m }, i) => ({
    path: `meals/${id}`,
    data: { ...m, isSample: true, createdAtMs: i },
  }));
}
