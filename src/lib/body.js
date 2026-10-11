import { addDays, diffDays, weekStart } from './date.js';

export const ACTIVITY = [
  { value: 1.2, label: '幾乎不動（久坐）' },
  { value: 1.375, label: '輕度（每週運動 1–3 天）' },
  { value: 1.55, label: '中度（每週運動 3–5 天）' },
  { value: 1.725, label: '高度（每週運動 6–7 天）' },
];

export function latestWeight(weightLog, day) {
  const ids = Object.keys(weightLog).filter((d) => d <= day).sort();
  if (!ids.length) return null;
  const d = ids[ids.length - 1];
  return { date: d, kg: Number(weightLog[d].kg) };
}

// Mifflin-St Jeor
export function bmr({ kg, heightCm, age, sex }) {
  const base = 10 * kg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function bodyComplete(body, weight) {
  return !!(weight && body && Number(body.heightCm) > 0 && Number(body.age) > 0 && (body.sex === 'male' || body.sex === 'female') && Number(body.activity) > 0);
}

// 每日熱量目標 = 每日消耗 − 300～500，不低於基礎代謝
export function calorieTarget(body, weight) {
  if (!bodyComplete(body, weight)) return null;
  const b = bmr({ kg: weight.kg, heightCm: Number(body.heightCm), age: Number(body.age), sex: body.sex });
  const tdee = Math.round(b * Number(body.activity));
  const deficit = Math.min(500, Math.max(300, Number(body.deficit) || 400));
  const raw = tdee - deficit;
  return { bmr: b, tdee, deficit, target: Math.max(b, raw), floored: raw < b };
}

// 最近 4 週的體重點，和用最小平方法算出的每週變化（不看單次增減）
export function weightTrend(weightLog, day) {
  const from = addDays(day, -27);
  const pts = Object.keys(weightLog)
    .filter((d) => d >= from && d <= day)
    .sort()
    .map((d) => ({ date: d, x: diffDays(from, d), kg: Number(weightLog[d].kg) }))
    .filter((p) => p.kg > 0);
  if (pts.length < 2) return { pts, perWeek: null };
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.kg, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (!sxx) return { pts, perWeek: null };
  const slope = pts.reduce((s, p) => s + (p.x - mx) * (p.kg - my), 0) / sxx;
  return { pts, perWeek: Math.round(slope * 7 * 100) / 100, from };
}

export function trendLabel(perWeek) {
  if (perWeek === null) return '至少要 2 週的紀錄才看得出趨勢';
  if (Math.abs(perWeek) < 0.1) return '持平';
  return perWeek < 0 ? `每週約下降 ${Math.abs(perWeek)} 公斤` : `每週約上升 ${perWeek} 公斤`;
}

// 每週一量一次；這週還沒量就提醒
export function needsWeighIn(weightLog, day) {
  const mon = weekStart(day);
  return !Object.keys(weightLog).some((d) => d >= mon && d <= day);
}
