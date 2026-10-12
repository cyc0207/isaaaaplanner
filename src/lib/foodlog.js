import { addDays, weekDays } from './date.js';
import { SLOTS, nextMeal } from './meals.js';

// 打卡的類別：三餐沿用記帳分類名稱，再加點心、飲料、宵夜
export const LOG_SLOTS = { ...SLOTS, snack: '點心', drink: '飲料', late: '宵夜' };
export const DRINK_SLOT = 'drink';

// 打卡順便記帳時記到哪個分類：記帳有這個分類就用，沒有就記「其他」
export function slotCategory(slot, categories) {
  const name = LOG_SLOTS[slot];
  return name && categories.includes(name) ? name : '其他';
}

// 這週（週一到週日）每一類打卡幾次
export function weekSlotCounts(items, day) {
  const days = weekDays(day);
  const out = Object.fromEntries(Object.keys(LOG_SLOTS).map((k) => [k, 0]));
  for (const it of items) {
    if (it.date < days[0] || it.date > days[6]) continue;
    if (it.slot in out) out[it.slot] += 1;
  }
  return out;
}
export const DAYS = 30;

// 現在這個時間拍的，多半是哪一餐
export function slotNow(now = new Date(), spin = null) {
  if (spin?.source === 'drink') return DRINK_SLOT;
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

// 實際吃的是哪家：自己寫的字條優先；字條沒寫或就是轉盤那家，才用轉盤結果（和它的店家 id）
export function ateAt(item) {
  const note = (item.note || '').trim();
  const pick = (item.wheelPick || '').trim();
  if (note && (!pick || !note.includes(pick))) return { name: note, placeId: null };
  return { name: pick || note, placeId: item.placeId || null };
}

// 寫的字條不是轉盤轉到的那家
export const differsFromPick = (note, pick) => !!pick && !!note.trim() && !note.includes(pick);
