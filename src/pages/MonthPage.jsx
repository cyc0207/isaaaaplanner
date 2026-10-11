import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, monthKey, prevMonthKey, nextMonthKey, daysInMonth, weekday, shortLabel, monthRange } from '../lib/date.js';
import { occursOn } from '../lib/plan.js';
import { Icon, TaskRow, DeadlineRow } from '../components/ui.jsx';
import { AddTaskForm, TaskEditor, DeadlineEditor, useTaskActions } from '../components/editors.jsx';

export default function MonthPage() {
  const { tasks, deadlines, recurring } = useData();
  const [params, setParams] = useSearchParams();
  const t = today();
  const mKey = params.get('m') || monthKey(t);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editingDl, setEditingDl] = useState(null);
  const actions = useTaskActions();

  const n = daysInMonth(mKey);
  const first = `${mKey}-01`;
  const lead = (weekday(first) + 6) % 7; // 週一開始
  const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${mKey}-${String(i + 1).padStart(2, '0')}`)];
  const { from, to } = monthRange(mKey);
  const monthTasks = tasks.filter((x) => x.date && x.date >= from && x.date <= to);
  const monthDl = deadlines.filter((x) => x.date >= from && x.date <= to);
  const monthlyRec = recurring.filter((r) => r.rule?.startsWith('monthly'));

  const go = (k) => {
    setSelected(null);
    setParams(k === monthKey(t) ? {} : { m: k });
  };

  const sel = selected;
  return (
    <div className="page wide-page">
      <header className="page-head">
        <button className="icon-btn" onClick={() => go(prevMonthKey(mKey))} aria-label="上個月">
          <Icon name="chevL" />
        </button>
        <div className="center">
          <h1>
            {mKey.slice(0, 4)} 年 {Number(mKey.slice(5))} 月
          </h1>
          <div className="muted">
            {monthDl.length} 個期限・{monthTasks.filter((x) => x.done).length}／{monthTasks.length} 件完成
          </div>
        </div>
        <button className="icon-btn" onClick={() => go(nextMonthKey(mKey))} aria-label="下個月">
          <Icon name="chevR" />
        </button>
      </header>

      <div className="month-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
          <div key={w} className="month-wd">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="month-cell empty" />;
          const dl = monthDl.filter((x) => x.date === d);
          const tk = monthTasks.filter((x) => x.date === d);
          const rec = monthlyRec.filter((r) => occursOn(r.rule, d));
          return (
            <button
              key={d}
              className={`month-cell ${d === t ? 'is-today' : ''} ${d === sel ? 'sel' : ''}`}
              onClick={() => setSelected(d === sel ? null : d)}
            >
              <span className="mday">{Number(d.slice(8))}</span>
              {dl.map((x) => (
                <span key={x.id} className="mdl">
                  {x.title}
                </span>
              ))}
              {rec.map((r) => (
                <span key={r.id} className="mrec">
                  ↻ {r.title}
                </span>
              ))}
              {tk.length > 0 && (
                <span className="mcount">
                  {tk.filter((x) => x.done).length}/{tk.length} 件
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sel && (
        <section className="section day-panel">
          <h2>{shortLabel(sel)}</h2>
          <ul className="list">
            {deadlines
              .filter((x) => x.date === sel)
              .map((x) => (
                <DeadlineRow key={x.id} d={x} day={t} onEdit={setEditingDl} />
              ))}
            {recurring
              .filter((r) => !r.special || r.special !== 'habit')
              .filter((r) => r.rule !== 'daily' && occursOn(r.rule, sel))
              .map((r) => (
                <li key={r.id} className="recurring muted">
                  ↻ {r.title}
                </li>
              ))}
            {tasks
              .filter((x) => x.date === sel)
              .map((x) => (
                <TaskRow key={x.id} task={x} onToggle={actions.toggle} onMove={actions.move} onEdit={setEditing} />
              ))}
          </ul>
          <AddTaskForm compact date={sel} onAdd={actions.add} />
          <button className="btn" onClick={() => setEditingDl({ new: true, date: sel })}>
            新增期限
          </button>
        </section>
      )}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
      {editingDl && (
        <DeadlineEditor deadline={editingDl.new ? null : editingDl} date={editingDl.date} onClose={() => setEditingDl(null)} />
      )}
    </div>
  );
}
