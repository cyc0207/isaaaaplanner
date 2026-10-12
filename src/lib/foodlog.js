import { addDays } from './date.js';
import { SLOTS, nextMeal } from './meals.js';

export const LOG_SLOTS = { ...SLOTS, snack: '點心' };
export const DAYS = 30;

// 現在這個時間拍的，多半是哪一餐
export function slotNow(now = new Date()) {
  const nm = nextMeal(now);
  return nm.tomorrow ? 'dinner' : nm.slot;
}

// 連續打卡幾天：今天還沒拍不算斷
export function photoStreak(dates, day) {
  const set = new Set(dates);
  let d = set.has(day) ? day : addDays(day, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}


// 轉盤打卡：轉盤停下來時記住結果，3 小時內打卡就預設是「轉盤轉的」
export const WHEEL_SOURCES = { meals: '常吃轉盤', near: '附近餐廳轉盤', drink: '飲料店轉盤' };
const SPIN_KEY = 'planner.lastSpin';
const SPIN_MS = 3 * 60 * 60 * 1000;

export function rememberSpin(source, name, now = Date.now()) {
  try {
    localStorage.setItem(SPIN_KEY, JSON.stringify({ source, name, at: now }));
  } catch {
    // 存不了就算了，打卡時自己選
  }
}

export function lastSpin(now = Date.now()) {
  try {
    const v = JSON.parse(localStorage.getItem(SPIN_KEY) || 'null');
    if (v && now - v.at < SPIN_MS) return v;
  } catch {
    // 讀不到當作沒轉過
  }
  return null;
}

export function forgetSpin() {
  try {
    localStorage.removeItem(SPIN_KEY);
  } catch {
    // 無所謂
  }
}

export function wheelLabel(it) {
  if (!it.fromWheel) return '';
  return [WHEEL_SOURCES[it.wheelSource] || '轉盤', it.wheelPick].filter(Boolean).join('：');
}
