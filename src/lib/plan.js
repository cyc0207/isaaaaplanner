import { addDays, diffDays, weekday, WEEKDAY_KEYS, monthKey, dayInMonth, prevMonthKey } from './date.js';

export const MAX_TODAY = 3;

// 連續天數：今天有做就從今天算回去；今天還沒做就從昨天算（今天還有機會）
export function streak(isDone, day) {
  let d = isDone(day) ? day : addDays(day, -1);
  let n = 0;
  while (isDone(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function habitStreak(habitLogs, name, day) {
  return streak((d) => !!habitLogs[d]?.done?.[name], day);
}

// 今天的任務：日期是今天的，isToday 的排前面，最多顯示 3 件
export function todayTasks(tasks, day) {
  const list = tasks
    .filter((t) => t.date === day)
    .sort((a, b) => (b.isToday ? 1 : 0) - (a.isToday ? 1 : 0) || (a.createdAtMs || 0) - (b.createdAtMs || 0));
  return { shown: list.slice(0, MAX_TODAY), overflow: list.slice(MAX_TODAY) };
}

export function overdueTasks(tasks, day) {
  return tasks.filter((t) => t.date && t.date < day && !t.done).sort((a, b) => a.date.localeCompare(b.date));
}

export function weekCompletion(tasks, days) {
  const inWeek = tasks.filter((t) => t.date && t.date >= days[0] && t.date <= days[6]);
  return { done: inWeek.filter((t) => t.done).length, total: inWeek.length };
}

// rule: daily / weekly:tue / monthly:5
export function parseRule(rule) {
  const [kind, arg] = String(rule || '').split(':');
  if (kind === 'weekly') return { kind, weekday: WEEKDAY_KEYS.indexOf(arg) };
  if (kind === 'monthly') return { kind, day: Number(arg) };
  return { kind: 'daily' };
}

export function occursOn(rule, day) {
  const r = parseRule(rule);
  if (r.kind === 'daily') return true;
  if (r.kind === 'weekly') return weekday(day) === r.weekday;
  if (r.kind === 'monthly') return dayInMonth(monthKey(day), r.day) === day;
  return false;
}

export const recurringDoneId = (recId, day) => `${recId}_${day}`;

// 每週固定事項：最近一次（7 天內）還沒打勾的就顯示，過了當天標「延後 x 天」
export function pendingWeekly(recurring, doneIds, day, startDate) {
  const out = [];
  for (const r of recurring) {
    if (r.special) continue;
    const p = parseRule(r.rule);
    if (p.kind !== 'weekly' || p.weekday < 0) continue;
    const back = (weekday(day) - p.weekday + 7) % 7;
    const occ = addDays(day, -back);
    if (startDate && occ < startDate) continue;
    if (doneIds.has(recurringDoneId(r.id, occ))) continue;
    out.push({ ...r, occurrence: occ, delay: back });
  }
  return out;
}

// 期限倒數；暫定的顯示「最早 x 天」
export function nextDeadline(deadlines, day) {
  const upcoming = deadlines.filter((d) => d.date >= day).sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;
  const d = upcoming[0];
  return { ...d, daysLeft: diffDays(day, d.date) };
}

export function deadlineReminders(deadlines, day) {
  const tomorrow = addDays(day, 1);
  return deadlines
    .filter((d) => d.remindDayBefore && (d.date === day || d.date === tomorrow))
    .map((d) => ({ ...d, when: d.date === day ? '今天' : '明天' }));
}

// 需要作帳的月份：上個月，且不早於開始使用的月份、還沒結帳
export function monthToClose(monthClose, day, startMonth) {
  const prev = prevMonthKey(monthKey(day));
  if (startMonth && prev < startMonth) return null;
  return monthClose[prev] ? null : prev;
}

// 對帳日
export function isReconcileDay(reconcile, day) {
  if (!reconcile) return weekday(day) === 0;
  if (reconcile.cycle === 'monthly') return dayInMonth(monthKey(day), Number(reconcile.day) || 1) === day;
  return weekday(day) === (Number(reconcile.day) || 0);
}

export function lastReconcile(reconcileLogIds, day) {
  const past = reconcileLogIds.filter((d) => d <= day).sort();
  if (!past.length) return null;
  const last = past[past.length - 1];
  return { date: last, daysAgo: diffDays(last, day) };
}

// 固定支出：本月扣款日前 3 天內（或已過扣款日）還沒付的
export function fixedDue(fixedItems, paidIds, day) {
  const mKey = monthKey(day);
  return fixedItems
    .map((f) => ({ ...f, dueDate: dayInMonth(mKey, Number(f.day) || 1), paid: paidIds.has(`${mKey}_${f.id}`) }))
    .filter((f) => !f.paid && diffDays(day, f.dueDate) <= 3)
    .map((f) => ({ ...f, daysLeft: diffDays(day, f.dueDate) }));
}

export const fixedPaidId = (mKey, fixedItemId) => `${mKey}_${fixedItemId}`;
