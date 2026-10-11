import { toCSV, PLAN_HEADER, LEDGER_HEADER } from './csv.js';

const inRange = (d, from, to) => d && d >= from && d <= to;

export function planRecords(tasks, deadlines, from, to, kind) {
  const rows = [];
  if (kind !== 'deadline') {
    for (const t of tasks) if (inRange(t.date, from, to)) rows.push({ type: 'task', date: t.date, title: t.title, project: t.project || '', note: t.note || '', done: t.done ? 'true' : 'false' });
  }
  if (kind !== 'task') {
    for (const d of deadlines) if (inRange(d.date, from, to)) rows.push({ type: 'deadline', date: d.date, title: d.title, project: d.project || '', note: d.note || '', done: '' });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function ledgerRecords(expenses, accountsById, from, to, onlyTransfers = false) {
  const name = (id) => (id ? accountsById[id]?.name || id : '');
  return expenses
    .filter((e) => inRange(e.date, from, to) && (!onlyTransfers || e.type === 'transfer'))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAtMs || 0) - (b.createdAtMs || 0))
    .map((e) => ({ date: e.date, type: e.type, amount: e.amount, category: e.category || '', account: name(e.account), toAccount: name(e.toAccount), note: e.note || '' }));
}

// planner_任務_2026-10.csv；不是整個月時用起訖日期
export function exportFileName(label, from, to) {
  const m = from.slice(0, 7);
  const lastDay = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  const whole = from === `${m}-01` && to === `${m}-${String(lastDay).padStart(2, '0')}`;
  return `planner_${label}_${whole ? m : `${from}_${to}`}.csv`;
}

export function downloadCSV(filename, header, records) {
  const blob = new Blob([toCSV(header, records)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export const EXPORTS = {
  task: { label: '任務', header: PLAN_HEADER, build: (d, f, t) => planRecords(d.tasks, d.ownDeadlines, f, t, 'task') },
  deadline: { label: '期限', header: PLAN_HEADER, build: (d, f, t) => planRecords(d.tasks, d.ownDeadlines, f, t, 'deadline') },
  ledger: { label: '記帳', header: LEDGER_HEADER, build: (d, f, t) => ledgerRecords(d.expenses, d.accountsById, f, t) },
  transfer: { label: '轉帳', header: LEDGER_HEADER, build: (d, f, t) => ledgerRecords(d.expenses, d.accountsById, f, t, true) },
};

export function runExport(data, kind, from, to) {
  const e = EXPORTS[kind];
  const records = e.build(data, from, to);
  downloadCSV(exportFileName(e.label, from, to), e.header, records);
  return records.length;
}
