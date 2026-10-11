import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, addDays, weekDays, shortLabel } from '../lib/date.js';
import { weekCompletion, occursOn } from '../lib/plan.js';
import { Icon, TaskRow, DeadlineRow } from '../components/ui.jsx';
import { AddTaskForm, TaskEditor, DeadlineEditor, useTaskActions } from '../components/editors.jsx';

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

