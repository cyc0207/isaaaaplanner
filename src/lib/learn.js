import { weekStart, monthKey, diffDays, addDays } from './date.js';

// 學習計畫：大目標 → 月目標 → 每週目標，全部放在 studyGoals 一個集合
// level: 'big' | 'month' | 'week'；month/week 有 bigId 和 period（'2026-10' 或該週週一 '2026-10-12'）

export const LEVELS = { big: '大目標', month: '月目標', week: '每週目標' };
export const GOAL_COLORS = ['brick', 'teal', 'mustard', 'olive'];

export const periodOf = (level, day) => (level === 'month' ? monthKey(day) : level === 'week' ? weekStart(day) : null);

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAtMs || 0) - (b.createdAtMs || 0) || String(a.id).localeCompare(String(b.id));

export function bigGoals(goals, { archived = false } = {}) {
  return goals.filter((g) => g.level === 'big' && !!g.archived === archived).sort(byOrder);
}

export function goalsIn(goals, level, period, bigId) {
  return goals.filter((g) => g.level === level && g.period === period && (bigId === undefined || g.bigId === bigId)).sort(byOrder);
}

const count = (list) => ({ done: list.filter((g) => g.done).length, total: list.length });

// 大目標的進度：用月目標算；還沒有月目標就用每週目標
export function bigProgress(goals, bigId) {
  const months = goals.filter((g) => g.level === 'month' && g.bigId === bigId);
  const weeks = goals.filter((g) => g.level === 'week' && g.bigId === bigId);
  return { month: count(months), week: count(weeks) };
}

// 某個月裡面的每週目標（週一落在那個月的週）
export function weeksOfMonth(goals, month, bigId) {
  return goals.filter((g) => g.level === 'week' && g.period?.slice(0, 7) === month && (bigId === undefined || g.bigId === bigId));
}

export function periodCount(goals, level, period) {
  return count(goalsIn(goals, level, period));
}

// 上一期沒完成的，可以搬到這一期
export function carryOver(goals, level, period) {
  const prev = level === 'week' ? addDays(period, -7) : prevMonth(period);
  const live = new Set(bigGoals(goals).map((g) => g.id));
  const here = new Set(goalsIn(goals, level, period).map((g) => `${g.bigId}|${g.title}`));
  return goalsIn(goals, level, prev).filter((g) => !g.done && live.has(g.bigId) && !here.has(`${g.bigId}|${g.title}`));
}

function prevMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function daysLeft(deadline, day) {
  return deadline ? diffDays(day, deadline) : null;
}

export function deadlineText(deadline, day) {
  const n = daysLeft(deadline, day);
  if (n === null) return '';
  if (n > 0) return `還有 ${n} 天`;
  if (n === 0) return '今天到期';
  return `已過 ${-n} 天`;
}

// 一次貼很多行就變很多個目標
export function splitTitles(text) {
  return text
    .split(/\n/)
    .map((s) => s.replace(/^\s*(?:[-*•・]|\d+[.、)])\s*/, '').trim())
    .filter(Boolean);
}
