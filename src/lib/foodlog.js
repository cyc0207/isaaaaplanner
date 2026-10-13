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

// 一張照片可以同時是好幾類（例：晚餐＋飲料）。新的存 slots 陣列，舊的只有 slot，讀的時候一起認
export function slotsOf(it) {
  const list = Array.isArray(it?.slots) && it.slots.length ? it.slots : it?.slot ? [it.slot] : [];
  return orderSlots(list);
}
export const hasSlot = (it, k) => slotsOf(it).includes(k);
// 照固定順序排（早餐、午餐、晚餐、點心、飲料、宵夜），第一個是主要的那類
export const orderSlots = (list) => Object.keys(LOG_SLOTS).filter((k) => list.includes(k));
export const slotLabel = (it, sep = '＋') => slotsOf(it).map((k) => LOG_SLOTS[k]).join(sep);
// 存檔用：slots 存全部，slot 留主要那類，舊版程式和舊資料都讀得懂
export function slotFields(list) {
  const slots = orderSlots(list);
  return { slots, slot: slots[0] || null };
}
// 點一下加進去、再點一下拿掉，至少留一個
export function toggleSlot(list, k) {
  if (!list.includes(k)) return orderSlots([...list, k]);
  return list.length > 1 ? list.filter((x) => x !== k) : list;
}

// 這週（週一到週日）每一類打卡幾次：晚餐＋飲料那張，晚餐和飲料各算一次
export function weekSlotCounts(items, day) {
  const days = weekDays(day);
  const out = Object.fromEntries(Object.keys(LOG_SLOTS).map((k) => [k, 0]));
  for (const it of items) {
    if (it.date < days[0] || it.date > days[6]) continue;
    for (const k of slotsOf(it)) if (k in out) out[k] += 1;
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

// 今天選擇：在收藏按「今天吃這個」或打卡時貼地圖網址。記到今天結束，打卡時預設帶進來
const CHOICE_KEY = 'planner.todayChoice';

export function rememberChoice({ name, url = '', placeId = null, kind = 'food' }, now = Date.now()) {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify({ name, url, placeId, kind, at: now }));
  } catch {
    // 存不了就打卡時自己貼
  }
}

export function todayChoice(now = Date.now()) {
  try {
    const v = JSON.parse(localStorage.getItem(CHOICE_KEY) || 'null');
    if (v && new Date(v.at).toDateString() === new Date(now).toDateString()) return v;
  } catch {
    // 讀不到當作沒選
  }
  return null;
}

export function forgetChoice() {
  try {
    localStorage.removeItem(CHOICE_KEY);
  } catch {
    // 無所謂
  }
}

// 這餐怎麼決定的：wheel 轉盤、self 自己選、today 今天選擇（收藏或貼網址）
export const HOWS = [['wheel', '轉盤轉的'], ['self', '自己選的'], ['today', '今天選擇']];
export const howOf = (it) => it.how || (it.fromWheel ? 'wheel' : 'self');

// 打卡要帶進來的預設：轉盤和今天選擇都有的話，用比較晚的那個
export function startHow(spin, choice) {
  if (choice && (!spin || choice.at >= spin.at)) {
    return { how: 'today', fromWheel: false, wheelSource: null, wheelPick: choice.name, placeId: choice.placeId || null, url: choice.url || '', note: choice.name };
  }
  if (spin) return { how: 'wheel', fromWheel: true, wheelSource: spin.source, wheelPick: spin.name, placeId: spin.placeId || null, url: '', note: spin.name };
  return { how: 'self', fromWheel: false, wheelSource: null, wheelPick: '', placeId: null, url: '', note: '' };
}

// 從 Google 地圖網址猜店名：/maps/place/店名/... 或 ?q=店名、?query=店名。短網址（maps.app.goo.gl）猜不出來
export function nameFromMapsUrl(url) {
  let u;
  try {
    u = new URL(String(url || '').trim());
  } catch {
    return '';
  }
  const m = u.pathname.match(/\/maps\/place\/([^/]+)/);
  let raw = m ? m[1] : u.searchParams.get('q') || u.searchParams.get('query') || '';
  try {
    raw = decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    // 留原樣
  }
  raw = raw.trim();
  // q 也可能是座標
  if (!raw || /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(raw)) return '';
  return raw;
}

export const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());

// 貼的網址是不是收藏裡的那家（比對網址或店家 id）
export function favByUrl(favs, url) {
  const v = String(url || '').trim();
  if (!v) return null;
  return favs.find((f) => (f.url && f.url === v) || (f.id && v.includes(f.id))) || null;
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
