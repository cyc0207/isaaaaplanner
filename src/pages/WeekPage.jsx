import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, addDays, weekDays, shortLabel } from '../lib/date.js';
import { weekCompletion, occursOn } from '../lib/plan.js';
import { Icon, TaskRow, DeadlineRow } from '../components/ui.jsx';
import { AddTaskForm, TaskEditor, DeadlineEditor, useTaskActions } from '../components/editors.jsx';
import { BudgetSuggestions } from '../components/Suggestions.jsx';
import { KINDS, STATUSES, isPending } from '../lib/inbox.js';

export default function WeekPage() {
  const { tasks, deadlines, recurring } = useData();
  const [params, setParams] = useSearchParams();
  const offset = Number(params.get('w')) || 0;
  const t = today();
  const days = weekDays(addDays(t, offset * 7));
  const actions = useTaskActions();
  const [editing, setEditing] = useState(null);
  const [editingDl, setEditingDl] = useState(null);
  const [adding, setAdding] = useState(null);
  const [over, setOver] = useState(null);
  const stat = weekCompletion(tasks, days);
  const unscheduled = tasks.filter((x) => !x.date && !x.done);

  const go = (n) => setParams(n ? { w: String(n) } : {});
  const title = offset === 0 ? '本週' : offset === 1 ? '下週' : offset === -1 ? '上週' : `${shortLabel(days[0])} 那週`;

  const onDrop = (day) => (e) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/task');
    const task = tasks.find((x) => x.id === id);
    if (task && task.date !== day) actions.move(task, day);
  };

  return (
    <div className="page wide-page">
      <header className="page-head">
        <button className="icon-btn" onClick={() => go(offset - 1)} aria-label="上一週">
          <Icon name="chevL" />
        </button>
        <div className="center">
          <h1>{title}</h1>
          <div className="muted">
            {shortLabel(days[0])} – {shortLabel(days[6])}・完成 {stat.done}／{stat.total} 件
          </div>
        </div>
        <button className="icon-btn" onClick={() => go(offset + 1)} aria-label="下一週">
          <Icon name="chevR" />
        </button>
      </header>
      {offset !== 0 && (
        <button className="link center-block" onClick={() => go(0)}>
          回到本週
        </button>
      )}
      {offset === 1 && <PlanPanel />}

      <div className="week-grid">
        {days.map((d) => {
          const dayTasks = tasks.filter((x) => x.date === d).sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
          const dayDl = deadlines.filter((x) => x.date === d);
          const rec = recurring.filter((r) => r.rule?.startsWith('weekly') && !r.special && occursOn(r.rule, d));
          const monthlyRec = recurring.filter((r) => r.rule?.startsWith('monthly') && occursOn(r.rule, d));
          return (
            <div
              key={d}
              className={`week-day ${d === t ? 'is-today' : ''} ${over === d ? 'drop' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(d);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={onDrop(d)}
            >
              <div className="week-day-head">
                <span>{shortLabel(d)}</span>
                <button className="icon-btn small" onClick={() => setAdding(adding === d ? null : d)} aria-label="新增任務">
                  <Icon name="plus" size={18} />
                </button>
              </div>
              <ul className="list">
                {dayDl.map((x) => (
                  <DeadlineRow key={x.id} d={x} day={t} onEdit={setEditingDl} />
                ))}
                {[...rec, ...monthlyRec].map((r) => (
                  <li key={r.id} className="recurring muted">
                    ↻ {r.title}
                  </li>
                ))}
                {dayTasks.map((x) => (
                  <TaskRow key={x.id} task={x} draggable onToggle={actions.toggle} onMove={actions.move} onEdit={setEditing} />
                ))}
              </ul>
              {adding === d && <AddTaskForm compact date={d} onAdd={actions.add} />}
            </div>
          );
        })}
      </div>

      {unscheduled.length > 0 && (
        <section className="section">
          <h2>未排定</h2>
          <ul className="list">
            {unscheduled.map((x) => (
              <TaskRow key={x.id} task={x} draggable onToggle={actions.toggle} onMove={actions.move} onEdit={setEditing} />
            ))}
          </ul>
        </section>
      )}

      <button className="btn" onClick={() => setEditingDl({ new: true, date: days[0] < t && t <= days[6] ? t : days[0] })}>
        新增期限
      </button>

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
      {editingDl && (
        <DeadlineEditor
          deadline={editingDl.new ? null : editingDl}
          date={editingDl.date}
          onClose={() => setEditingDl(null)}
        />
      )}
    </div>
  );
}


// 排下週：先看預算建議，再決定收件匣裡「考慮中」的
function PlanPanel() {
  const { inbox, api } = useData();
  const pending = inbox.filter(isPending);
  return (
    <section className="section plan-panel">
      <h2>排下週</h2>
      <h3>預算建議</h3>
      <BudgetSuggestions showEmpty />
      <h3>收件匣：考慮中（{pending.length}）</h3>
      {!pending.length && <p className="muted small">沒有要決定的。</p>}
      <ul className="list">
        {pending.map((it) => {
          const [, yes, , no] = STATUSES[it.kind] || STATUSES.other;
          return (
            <li key={it.id} className="task">
              <div className="task-body">
                <div className="task-title">{it.title}</div>
                <div className="task-meta">
                  <span className="chip">{KINDS[it.kind]}</span>
                  {it.deadline && <span>截止 {shortLabel(it.deadline)}</span>}
                </div>
              </div>
              <div className="task-actions">
                <button className="btn small primary" onClick={() => api.update(`inbox/${it.id}`, { status: yes })}>
                  {yes}
                </button>
                {no && (
                  <button className="btn small" onClick={() => api.update(`inbox/${it.id}`, { status: no })}>
                    {no}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
