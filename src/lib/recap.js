import { LOG_SLOTS } from './foodlog.js';

// 一週吃什麼：從打卡挑照片排成 IG 圖
export const FORMATS = {
  square: { w: 1080, h: 1080, label: '方形貼文' },
  story: { w: 1080, h: 1920, label: '限時動態' },
};

// 照片多過格子時，每天輪流挑一張，盡量每天都有
export function pickPhotos(items, cap) {
  const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.createdAtMs || 0) - (b.createdAtMs || 0));
  if (sorted.length <= cap) return sorted;
  const days = [];
  for (const it of sorted) {
    const d = days.find((g) => g.date === it.date);
    if (d) d.items.push(it);
    else days.push({ date: it.date, items: [it] });
  }
  const out = [];
  for (let round = 0; out.length < cap; round++) {
    let added = false;
    for (const d of days) {
      if (out.length >= cap) break;
      if (d.items[round]) { out.push(d.items[round]); added = true; }
    }
    if (!added) break;
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAtMs || 0) - (b.createdAtMs || 0));
}

// 幾張照片排幾欄幾列
// 穿搭照是直的（3:4），一列可以多放幾張
export function gridFor(n, format, kind = 'food') {
  const story = format === 'story';
  let cols;
  if (n <= 1) cols = 1;
  else if (kind === 'ootd') cols = story ? (n <= 4 ? 2 : 3) : Math.min(4, n <= 4 ? n : Math.ceil(n / 2));
  else if (story) cols = n <= 2 ? 1 : n <= 6 ? 2 : 3;
  else cols = n <= 4 ? 2 : 3;
  const maxRows = kind === 'ootd' ? (story ? 3 : 2) : story ? (cols === 3 ? 4 : 3) : cols;
  return { cols, rows: Math.min(maxRows, Math.ceil(Math.max(n, 1) / cols)) };
}

export function weekStats(items) {
  const slots = {};
  for (const i of items) slots[i.slot] = (slots[i.slot] || 0) + 1;
  const top = Object.entries(slots).sort((a, b) => b[1] - a[1])[0];
  return {
    meals: items.length,
    days: new Set(items.map((i) => i.date)).size,
    wheel: items.filter((i) => i.fromWheel).length,
    good: items.filter((i) => i.rating === 'good').length,
    topSlot: top ? LOG_SLOTS[top[0]] || '其他' : '',
  };
}
