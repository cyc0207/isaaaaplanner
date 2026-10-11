import { useData } from '../data.jsx';
import { today, diffDays, addDays, shortLabel } from '../lib/date.js';
import { budgetSuggestions, applySuggestion, MIN_DAYS } from '../lib/suggest.js';
import { money } from './ui.jsx';

const withoutId = ({ id, ...rest }) => rest;

// 依習慣調整預算：建議制，一定要按「接受」才改
export function BudgetSuggestions({ showEmpty = false }) {
  const { budget, fixedItems, expenses, meta, dismissed, api } = useData();
  const day = today();
  const list = budgetSuggestions({ budget, fixedItems, expenses, day, startDate: meta.startDate, dismissed });
  const daysUsed = meta.startDate ? diffDays(meta.startDate, day) : 0;

  if (daysUsed < MIN_DAYS) {
    if (!showEmpty) return null;
    return (
      <p className="muted small">
        預算建議要累積 4 週的紀錄才會開始，{shortLabel(addDays(meta.startDate || day, MIN_DAYS))}以後才會出現。
      </p>
    );
  }
  if (!list.length) return showEmpty ? <p className="muted small">這週沒有要調整的預算。</p> : null;

  const accept = (s) => {
    if (s.shortBy > 0) return;
    api.batch([
      { set: 'settings/budget', data: applySuggestion(withoutId(budget), s), merge: false },
      { add: 'budgetChanges', data: { date: day, category: s.category, field: s.field, oldValue: s.oldValue, newValue: s.newValue, reason: s.reason } },
    ]);
  };
  const dismiss = (s) => api.set('settings/suggest', { dismissed: { [s.key]: true } });

  return (
    <ul className="list suggestions">
      {list.map((s) => (
        <li key={s.key} className="card suggestion">
          <div>{s.reason}</div>
          <div className="strong">
            {s.kind === 'count'
              ? `每週杯數 ${s.oldValue} → ${s.newValue}`
              : `${s.category}預算 ${money(s.oldValue)} → ${money(s.newValue)}`}
            <span className="muted">
              （每月{s.monthlyDelta >= 0 ? '多' : '少'} {money(Math.abs(s.monthlyDelta))}，{s.monthlyDelta >= 0 ? '從彈性扣' : '放回彈性'}）
            </span>
          </div>
          {s.alternative && <div className="muted small">另一個選項：{s.alternative}（按略過）</div>}
          {s.shortBy > 0 && <div className="hint over">彈性不夠，還差 {money(s.shortBy)}，不能接受。</div>}
          <div className="row gap">
            <button className="btn small primary" disabled={s.shortBy > 0} onClick={() => accept(s)}>
              接受
            </button>
            <button className="btn small" onClick={() => dismiss(s)}>
              略過
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BudgetChangeLog() {
  const { budgetChanges } = useData();
  if (!budgetChanges.length) return null;
  return (
    <>
      <h3>預算調整紀錄</h3>
      <ul className="list ledger">
        {budgetChanges.map((c) => (
          <li key={c.id} className="ledger-row">
            <span className="ld-date">{shortLabel(c.date)}</span>
            <span className="ld-cat">
              {c.category}
              {c.field === 'perWeekCount' ? ' 每週杯數' : ''}
            </span>
            <span className="ld-amt num">
              {c.oldValue} → {c.newValue}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
