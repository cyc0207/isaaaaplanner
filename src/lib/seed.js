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

  // 只放每個人都用得到的固定事項；個人的課程、報告、比賽日期不放進來，免得新使用者看到別人的行程
  add('recurring/english', { title: '英文 15 分鐘', rule: 'daily', special: 'habit' });
  add('recurring/close', { title: '作上個月的帳', rule: 'monthly:1', special: 'monthClose' });
  add('recurring/plan', { title: '排下週', rule: 'weekly:sun', special: 'planWeek' });

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

// 舊版初始資料裡放了站長自己的行程（課程、報告、比賽）。之後才加入的使用者，
// 登入時會把這些「沒改過」的項目清掉；改過或打勾過的留著不動。
export const LEGACY_PERSONAL_SEED = {
  'deadlines/seed-1': '企業倫理實體課',
  'deadlines/seed-2': '資訊管理專題課程報告（題目：愛迪達）',
  'deadlines/seed-3': '資服競賽決賽 8:00–17:00',
  'deadlines/seed-4': '企業倫理實體課',
  'deadlines/seed-5': 'DecorateMe 新功能開工',
  'deadlines/seed-6': '實習期末英文 Presentation',
  'deadlines/seed-7': '企業倫理實體課',
  'recurring/ethics': '看企業倫理線上課程影片',
  'recurring/math': '看基礎數學線上課程影片',
  'tasks/seed-1': '確認愛迪達報告的規格與繳交方式（頁數、上台時間、分工）',
  'tasks/seed-2': '英文：挑一段實習工作內容，用英文講 2 分鐘並錄音',
};

// 站長是 2026-10-11 開始用的；這天以前（含）建立的帳號一律不清，避免刪到站長自己的資料
export const OWNER_LAST_START = '2026-10-13';

export function shouldCleanLegacySeed(meta) {
  return !!meta && !meta.seedCleaned && typeof meta.startDate === 'string' && meta.startDate > OWNER_LAST_START;
}

// 還是當初的樣子（標題一樣、沒打勾、沒寫備註）才算沒動過
export function isUntouchedSeed(path, data) {
  if (!data || data.title !== LEGACY_PERSONAL_SEED[path]) return false;
  if (data.done || data.note) return false;
  return true;
}
