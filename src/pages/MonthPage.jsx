import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, monthKey, prevMonthKey, nextMonthKey, daysInMonth, weekday, shortLabel, monthRange } from '../lib/date.js';
import { occursOn } from '../lib/plan.js';
import { Icon, TaskRow, DeadlineRow, deadlineLabel } from '../components/ui.jsx';
import { AddTaskForm, TaskEditor, DeadlineEditor, useTaskActions } from '../components/editors.jsx';

export default function MonthPage() {
  const { tasks, deadlines, recurring } = useData();
  const [params, setParams] = useSearchParams();
  const t = today();
  const mKey = params.get('m') || monthKey(t);
  const [selected, setSelected] = useState(() => (monthKey(t) === mKey ? t : null));
  const panelRef = useRef(null);
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
    setSelected(k === monthKey(t) ? t : null);
    setParams(k === monthKey(t) ? {} : { m: k });
  };

  const sel = selected;
  // 手機上格子太小放不下字：格子只放色點，期限的全名列在月曆下面
  const agenda = [
    ...monthDl,
    ...cells.filter(Boolean).flatMap((d) => monthlyRec.filter((r) => occursOn(r.rule, d)).map((r) => ({ id: `${r.id}:${d}`, date: d, title: r.title, rec: true }))),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.rec ? 1 : 0) - (b.rec ? 1 : 0));
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
              className={`month-cell ${d === t ? 'is-today' : ''} ${d === sel ? 'sel' : ''} ${d < t ? 'past' : ''} ${dl.length ? 'has-dl' : ''}`}
              aria-label={`${shortLabel(d)}${dl.length ? `，${dl.length} 個期限` : ''}${tk.length ? `，${tk.length} 件任務` : ''}`}
              onClick={() => setSelected(d === sel ? null : d)}
            >
              <span className="mday">{Number(d.slice(8))}</span>
              {(dl.length > 0 || rec.length > 0 || tk.length > 0) && (
                <span className="mmarks" aria-hidden="true">
                  {dl.slice(0, 3).map((x) => (
                    <i key={x.id} className="mk-dl" />
                  ))}
                  {rec.length > 0 && <i className="mk-rec" />}
                  {tk.length > 0 && <i className={`mk-task ${tk.every((x) => x.done) ? 'done' : ''}`} />}
                </span>
              )}
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

      <div className="month-legend muted small" aria-hidden="true">
        <span><i className="mk-dl" />期限</span>
        <span><i className="mk-rec" />每月固定</span>
        <span><i className="mk-task" />任務</span>
      </div>

      <section className="section month-agenda">
        <h2>這個月的期限</h2>
        {!agenda.length && <p className="muted small">這個月沒有期限。</p>}
        <ul className="list">
          {agenda.map((x) => (
            <li key={x.id}>
              <button
                className={`agenda-row ${x.date < t ? 'past' : ''} ${x.date === sel ? 'sel' : ''}`}
                onClick={() => {
                  setSelected(x.date);
                  setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                }}
              >
                <span className="ag-date num">{shortLabel(x.date)}</span>
                <span className="ag-title">
                  {x.rec && <span className="ag-rec">每月</span>}
                  {x.title}
                </span>
                <span className="ag-left muted small">{x.rec ? '' : deadlineLabel(x, t)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {sel && (
        <section className="section day-panel" ref={panelRef}>
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
