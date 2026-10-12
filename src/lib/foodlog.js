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

export function rememberSpin(source, name, now = Date.now(), placeId = null) {
  try {
    localStorage.setItem(SPIN_KEY, JSON.stringify({ source, name, at: now, placeId }));
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

// 評分：吃完回來評這家店，或在轉盤直接按負評。好吃的在附近轉盤格子大一倍，負評的預設不上轉盤
export const RATINGS = [['good', '好吃，會再來'], ['ok', '普通'], ['bad', '負評']];
export const RATING_TAG = { good: '好吃', ok: '普通', bad: '負評' };

// 評分存在 placeReviews：Google 地圖的店用店家 id，其他用名字
export function reviewKey({ placeId, name }) {
  if (placeId) return placeId.replace(/\//g, '_');
  const n = (name || '').trim();
  return n ? `n_${n.replace(/[\/\s]+/g, '_')}` : null;
}

export function reviewOf(reviews, p) {
  return (p.id && reviews[reviewKey({ placeId: p.id })]) || reviews[reviewKey({ name: p.name })] || null;
}

// 打卡裡還沒評的（有寫吃什麼或轉盤轉到的才問），新的先
export function toReview(items, limit = 3) {
  return items
    .filter((i) => !i.rating && !i.reviewSkipped && (i.wheelPick || i.note))
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .slice(0, limit);
}

export function reviewUpdate(prev, { name, placeId, rating, now = Date.now() }) {
  const counts = { good: 0, ok: 0, bad: 0, ...(prev?.counts || {}) };
  counts[rating] += 1;
  return { name, placeId: placeId || prev?.placeId || null, rating, counts, updatedAtMs: now };
}

// 收藏和負評都存在同一份 placeReviews，順便記下地圖連結，收藏清單不用再查 Google
export function placeInfo(p, kind = 'food') {
  return { name: p.name, placeId: p.placeId || p.id || null, url: p.url || '', group: p.group || '', address: p.address || '', kind };
}

export function favoritesOf(reviews, kind = 'food') {
  return Object.entries(reviews)
    .filter(([, r]) => r.fav && (r.kind || 'food') === kind)
    .map(([key, r]) => ({ id: r.placeId || key, key, name: r.name, url: r.url, group: r.group, address: r.address, rating: r.rating || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
