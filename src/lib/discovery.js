// Sunday English Discovery：每週日一個選好的英文影片／音訊
import { DISCOVERY_SEED } from '../data/discovery.js';
import { isValidDateStr, weekday, addDays } from './date.js';

export const LEVELS = ['入門', '中等', '進階'];

// 內建清單＋自己貼進來的（Firestore discovery/{id}），同 id 用 Firestore 的進度蓋過去
export function mergeItems(docs) {
  const byId = Object.fromEntries((docs || []).map((d) => [d.id, d]));
  const seeded = DISCOVERY_SEED.map((s) => ({ ...s, ...(byId[s.id] || {}), id: s.id }));
  const custom = (docs || []).filter((d) => d.custom && !DISCOVERY_SEED.some((s) => s.id === d.id));
  return [...seeded, ...custom].filter((x) => !x.removed).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

// 這個日期所在那週的週日（週一開始，所以週日是一週最後一天）
export function sundayOf(t) {
  const wd = weekday(t);
  return wd === 0 ? t : addDays(t, 7 - wd);
}

// 這週日的主要推薦：排在這天的；沒排就拿最早一個沒排日期、還沒完成的
export function pickFor(items, sunday) {
  return items.find((x) => x.date === sunday) || items.find((x) => !x.date && x.status !== 'done') || null;
}

// 換一個：下一個還沒完成、不是這週的教材
export function nextAlternative(items, current, sunday) {
  return items.find((x) => x.id !== current?.id && x.status !== 'done' && (!x.date || x.date > sunday)) || null;
}

// 換的時候兩個交換日期，這樣原本那個會移到之後的週日
export function swapOps(current, alt, sunday) {
  const ops = [{ id: alt.id, data: { date: sunday } }];
  if (current) ops.push({ id: current.id, data: { date: alt.date || '' } });
  return ops;
}

const isUrl = (s) => {
  if (typeof s !== 'string') return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

const str = (v) => (v == null ? '' : String(v).trim());

// 貼進來的 JSON（陣列，或 { items: [...] }），回傳每一筆的狀態，不會自己補連結
export function parseDiscoveryJSON(text, existing) {
  let data;
  const m = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/);
  try {
    data = JSON.parse(m ? m[1] : text);
  } catch {
    return { error: '看不懂這段 JSON，請確認是完整的 [ ... ] 或 { "items": [ ... ] }。' };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
  if (!list) return { error: '要是一個陣列，或有 items 陣列的物件。' };
  const urls = new Set((existing || []).map((x) => x.url));
  const dates = new Set((existing || []).filter((x) => x.date).map((x) => x.date));
  const rows = list.map((r) => {
    const item = {
      title: str(r?.title),
      speaker: str(r?.speaker),
      source: str(r?.source),
      url: str(r?.url),
      topic: str(r?.topic),
      level: str(r?.level),
      minutes: Number(r?.minutes) || null,
      segment: str(r?.segment),
      transcriptUrl: str(r?.transcriptUrl),
      date: str(r?.date),
    };
    const errors = [];
    if (!item.title) errors.push('沒有標題');
    if (!isUrl(item.url)) errors.push('官方連結不是網址');
    if (item.transcriptUrl && !isUrl(item.transcriptUrl)) errors.push('逐字稿連結不是網址');
    if (item.date && !isValidDateStr(item.date)) errors.push('日期要是 YYYY-MM-DD');
    else if (item.date && weekday(item.date) !== 0) errors.push('日期不是星期日');
    let status = errors.length ? 'error' : 'ok';
    if (status === 'ok' && urls.has(item.url)) status = 'duplicate';
    if (status === 'ok' && item.date && dates.has(item.date)) status = 'taken';
    if (status === 'ok') {
      urls.add(item.url);
      if (item.date) dates.add(item.date);
    }
    return { item, status, errors };
  });
  return { rows };
}

// 首頁英文習慣要寫的紀錄；已經有今天的紀錄就保留原本的分鐘數
export function habitEntry(prev, item) {
  return {
    minutes: prev?.minutes || item.minutes || 10,
    note: prev?.note || `Sunday English Discovery：${item.title}`,
    discovery: item.id,
  };
}
