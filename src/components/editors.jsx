import { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { useData } from '../data.jsx';
import { Sheet, useProjects } from './ui.jsx';
import { today, monthKey } from '../lib/date.js';
import { fixedPaidId } from '../lib/plan.js';

export const TASK_PLACEHOLDER = '例：把第 3 章架構圖貼進簡報';

export function useTaskActions() {
  const { api } = useData();
  return {
    toggle: (t) =>
      api.update(`tasks/${t.id}`, t.done ? { done: false, doneAt: null } : { done: true, doneAt: serverTimestamp() }),
    move: (t, date) => api.update(`tasks/${t.id}`, { date, isToday: date === today() }),
    remove: (t) => window.confirm(`刪除「${t.title}」？`) && api.remove(`tasks/${t.id}`),
    add: ({ title, date, project = '', note = '' }) =>
      api.add('tasks', { title, date, project, note, done: false, doneAt: null, isToday: date === today() }),
  };
}

function ProjectInput({ value, onChange }) {
  const { tasks, deadlines } = useData();
  const projects = useProjects(tasks, deadlines);
  return (
    <>
      <input list="projects" value={value} onChange={(e) => onChange(e.target.value)} placeholder="專案（可不填）" />
      <datalist id="projects">
        {projects.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </>
  );
}

export function TaskEditor({ task, onClose }) {
  const { api } = useData();
  const [f, setF] = useState({ title: task.title, date: task.date || '', project: task.project || '', note: task.note || '' });
  const save = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    api.update(`tasks/${task.id}`, { ...f, title: f.title.trim(), date: f.date || null, isToday: f.date === today() });
    onClose();
  };
  return (
    <Sheet title="編輯任務" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          要做什麼
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={TASK_PLACEHOLDER} autoFocus />
        </label>
        <label>
          日期
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </label>
        <label>
          專案
          <ProjectInput value={f.project} onChange={(project) => setF({ ...f, project })} />
        </label>
        <label>
          備註
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
        <div className="row gap">
          <button className="btn primary" type="submit">
            儲存
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (window.confirm('刪除這個任務？')) {
                api.remove(`tasks/${task.id}`);
                onClose();
              }
            }}
          >
            刪除
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function DeadlineEditor({ deadline, date, onClose }) {
  const { api } = useData();
  const isNew = !deadline;
  const [f, setF] = useState({
    title: deadline?.title || '',
    date: deadline?.date || date || today(),
    project: deadline?.project || '',
    note: deadline?.note || '',
    remindDayBefore: !!deadline?.remindDayBefore,
    tentative: !!deadline?.tentative,
  });
  const save = (e) => {
    e.preventDefault();
    if (!f.title.trim() || !f.date) return;
    const data = { ...f, title: f.title.trim() };
    if (isNew) api.add('deadlines', data);
    else api.update(`deadlines/${deadline.id}`, data);
    onClose();
  };
  return (
    <Sheet title={isNew ? '新增期限' : '編輯期限'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          期限
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="例：專題報告繳交" autoFocus={isNew} />
        </label>
        <label>
          日期
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </label>
        {f.tentative && (
          <button type="button" className="btn small" onClick={() => setF({ ...f, tentative: false })}>
            日期確定了：取消「日期未定」
          </button>
        )}
        <label>
          專案
          <ProjectInput value={f.project} onChange={(project) => setF({ ...f, project })} />
        </label>
        <label>
          備註
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={f.remindDayBefore} onChange={(e) => setF({ ...f, remindDayBefore: e.target.checked })} />
          前一天和當天在首頁提醒
        </label>
        <label className="inline">
          <input type="checkbox" checked={f.tentative} onChange={(e) => setF({ ...f, tentative: e.target.checked })} />
          日期未定（暫定）
        </label>
        <div className="row gap">
          <button className="btn primary" type="submit">
            儲存
          </button>
          {!isNew && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (window.confirm('刪除這個期限？')) {
                  api.remove(`deadlines/${deadline.id}`);
                  onClose();
                }
              }}
            >
              刪除
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

// 新增一件任務的小表單
export function AddTaskForm({ date, onAdd, disabledReason, compact }) {
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [msg, setMsg] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (disabledReason) {
      setMsg(disabledReason);
      return;
    }
    onAdd({ title: title.trim(), date, project });
    setTitle('');
    setMsg('');
  };
  return (
    <form className={`add-task ${compact ? 'compact' : ''}`} onSubmit={submit}>
      <input value={title} onChange={(e) => { setTitle(e.target.value); setMsg(''); }} placeholder={TASK_PLACEHOLDER} aria-label="新增任務" />
      {!compact && <ProjectInput value={project} onChange={setProject} />}
      <button className="btn primary" type="submit">
        新增
      </button>
      {msg && <p className="hint warn">{msg}</p>}
    </form>
  );
}

// 固定支出付款：產生一筆支出，同一個月只能付一次（文件 id 固定，兩台裝置同時按也只會有一筆）
export function payFixed(data, item, mKey, account) {
  const { api, fixedPaid, confirmClosed } = data;
  const paidId = fixedPaidId(mKey, item.id);
  if (fixedPaid.has(paidId)) return false;
  const date = mKey === monthKey(today()) ? today() : `${mKey}-${String(Math.min(28, item.day || 1)).padStart(2, '0')}`;
  if (!confirmClosed(date)) return false;
  const expenseId = `fixed-${paidId}`;
  api.batch([
    {
      add: 'expenses',
      id: expenseId,
      data: {
        date, amount: Number(item.amount) || 0, type: 'expense', category: '固定支出', account: account || item.account,
        toAccount: null, fixedItemId: item.id, note: item.name,
      },
    },
    { set: `fixedPaid/${paidId}`, data: { expenseId, paidAt: serverTimestamp() }, merge: false },
  ]);
  return true;
}
