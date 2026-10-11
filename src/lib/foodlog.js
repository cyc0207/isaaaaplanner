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

