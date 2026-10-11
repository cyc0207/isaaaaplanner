// 所有日期都用 'YYYY-MM-DD' 字串，以裝置當地時間為準。

const pad = (n) => String(n).padStart(2, '0');

export function toStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parse(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateStr(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return toStr(parse(str)) === str;
}

export function addDays(str, n) {
  const d = parse(str);
  d.setDate(d.getDate() + n);
  return toStr(d);
}

export function diffDays(a, b) {
  // b - a，以天為單位
  return Math.round((parse(b) - parse(a)) / 86400000);
}

// 0 = 週日 … 6 = 週六
export function weekday(str) {
  return parse(str).getDay();
}

// 週一為一週的開始
export function weekStart(str) {
  const wd = weekday(str);
  return addDays(str, wd === 0 ? -6 : 1 - wd);
}

export function weekDays(str) {
  const start = weekStart(str);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthKey(str) {
  return str.slice(0, 7);
}

export function prevMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

export function nextMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthRange(key) {
  return { from: `${key}-01`, to: `${key}-${pad(daysInMonth(key))}` };
}

// 某月第 day 號；月份沒有那麼多天時用最後一天
export function dayInMonth(key, day) {
  return `${key}-${pad(Math.min(day, daysInMonth(key)))}`;
}

export const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function monthLabel(key) {
  return `${Number(key.slice(5, 7))} 月`;
}

export function shortLabel(str) {
  return `${Number(str.slice(5, 7))}/${Number(str.slice(8, 10))}（${WEEKDAY_NAMES[weekday(str)]}）`;
}

// 測試用：網址加 ?today=2026-11-01 可以假裝今天是那一天
const OVERRIDE_KEY = 'planner.todayOverride';

export function initTodayOverride() {
  try {
    const p = new URLSearchParams(window.location.search).get('today');
    if (p === '') sessionStorage.removeItem(OVERRIDE_KEY);
    else if (p && isValidDateStr(p)) sessionStorage.setItem(OVERRIDE_KEY, p);
  } catch {
    /* 無痕模式之類，忽略 */
  }
}

export function getTodayOverride() {
  try {
    return sessionStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

export function clearTodayOverride() {
  try {
    sessionStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

export function today() {
  return getTodayOverride() || toStr(new Date());
}
