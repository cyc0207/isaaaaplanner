import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, addDays, weekStart, monthKey, prevMonthKey, nextMonthKey, monthLabel } from '../lib/date.js';
import { todayTasks, MAX_TODAY } from '../lib/plan.js';
import {
  LEVELS, GOAL_COLORS, bigGoals, goalsIn, bigProgress, weeksOfMonth, periodCount, carryOver, deadlineText, splitTitles,
} from '../lib/learn.js';
import { Sheet, Icon } from '../components/ui.jsx';
import { useTaskActions } from '../components/editors.jsx';

const TABS = [
  ['week', '這週'],
  ['month', '這個月'],
  ['big', '大目標'],
];

const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export function StudyNav({ on }) {
  return (
    <div className="study-switch">
      <Link to="/study" className={on === 'study' ? 'on' : ''}>學習計畫</Link>
      <Link to="/english" className={on === 'english' ? 'on' : ''}>英文</Link>
    </div>
  );
}

export default function StudyPage() {
  const { studyGoals } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'week';
  const [editing, setEditing] = useState(null);
  const bigs = bigGoals(studyGoals);
  return (
    <div className="page">
      <header className="page-head">
        <h1>學習</h1>
      </header>
      <StudyNav on="study" />
      {!bigs.length ? (
        <section className="section">
          <div className="card study-empty">
            <h2>先寫一個大目標</h2>
            <p className="muted">例如「多益 850」「考過日檢 N2」「學會 React」。再把它拆成每個月、每一週要做到的事。</p>
            <button className="btn primary big" onClick={() => setEditing({})}>新增大目標</button>
          </div>
        </section>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {TABS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setParams(k === 'week' ? {} : { tab: k })}>
                {l}
              </button>
            ))}
          </div>
          {tab === 'week' && <PeriodView level="week" />}
          {tab === 'month' && <PeriodView level="month" />}
          {tab === 'big' && <BigList onEdit={setEditing} />}
        </>
      )}
      {editing && <BigEditor goal={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PeriodView({ level }) {
  const { studyGoals, api } = useData();
  const t = today();
  const [period, setPeriod] = useState(level === 'week' ? weekStart(t) : monthKey(t));
  const bigs = bigGoals(studyGoals);
  const isNow = period === (level === 'week' ? weekStart(t) : monthKey(t));
  const step = (n) => setPeriod(level === 'week' ? addDays(period, 7 * n) : n > 0 ? nextMonthKey(period) : prevMonthKey(period));
  const label = level === 'week' ? `${md(period)} – ${md(addDays(period, 6))}` : monthLabel(period);
  const sum = periodCount(studyGoals, level, period);
  const carry = isNow ? carryOver(studyGoals, level, period) : [];
  const moveOver = () => api.batch(carry.map((g) => ({ add: 'studyGoals', data: { level, bigId: g.bigId, period, title: g.title, done: false, order: Date.now() } })));
  return (
    <section className="section">
      <div className="study-period">
        <button className="icon-btn" onClick={() => step(-1)} aria-label={level === 'week' ? '上一週' : '上個月'}><Icon name="chevL" /></button>
        <div className="center">
          <strong>{label}</strong>
          <div className="muted small">{isNow ? (level === 'week' ? '這週' : '這個月') : ''}{sum.total ? `　完成 ${sum.done}／${sum.total}` : ''}</div>
        </div>
        <button className="icon-btn" onClick={() => step(1)} aria-label={level === 'week' ? '下一週' : '下個月'}><Icon name="chevR" /></button>
      </div>
      {sum.total > 0 && <Progress done={sum.done} total={sum.total} />}
      {carry.length > 0 && (
        <div className="reminder">
          <span>{level === 'week' ? '上週' : '上個月'}還有 {carry.length} 個沒完成</span>
          <button className="btn small" onClick={moveOver}>搬過來</button>
        </div>
      )}
      {bigs.map((b, i) => (
        <GoalGroup key={b.id} big={b} color={b.color || GOAL_COLORS[i % GOAL_COLORS.length]} level={level} period={period} />
      ))}
    </section>
  );
}

function Progress({ done, total }) {
  return (
    <div className="bar study-bar" role="img" aria-label={`完成 ${done}／${total}`}>
      <div className="bar-fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  );
}

function GoalGroup({ big, color, level, period }) {
  const { studyGoals, api } = useData();
  const list = goalsIn(studyGoals, level, period, big.id);
  // 每週頁面順便看這個月要做到什麼；每月頁面看這個月每週完成多少
  const monthGoals = level === 'week' ? goalsIn(studyGoals, 'month', period.slice(0, 7), big.id) : [];
  const weekly = level === 'month' ? weeksOfMonth(studyGoals, period, big.id) : [];
  const add = (text) => {
    const titles = splitTitles(text);
    api.batch(titles.map((title, i) => ({ add: 'studyGoals', data: { level, bigId: big.id, period, title, done: false, order: Date.now() + i } })));
  };
  return (
    <div className={`card study-group c-${color}`}>
      <div className="study-group-head">
        <h3>{big.title}</h3>
        {big.deadline && <span className="chip">{deadlineText(big.deadline, today())}</span>}
      </div>
      {monthGoals.length > 0 && (
        <p className="study-context">
          這個月：{monthGoals.map((g) => (g.done ? `${g.title}（完成）` : g.title)).join('、')}
        </p>
      )}
      {level === 'month' && weekly.length > 0 && (
        <p className="study-context">這個月的每週目標完成 {weekly.filter((g) => g.done).length}／{weekly.length}</p>
      )}
      <ul className="list">
        {list.map((g) => <GoalRow key={g.id} goal={g} big={big} canSchedule={level === 'week'} />)}
      </ul>
      <AddGoal level={level} onAdd={add} />
    </div>
  );
}

function AddGoal({ level, onAdd }) {
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };
  return (
    <form className="add-task compact" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={level === 'week' ? '這週要做到…' : '這個月要做到…'} aria-label={`新增${LEVELS[level]}`} />
      <button className="btn primary" type="submit">新增</button>
    </form>
  );
}

function GoalRow({ goal, big, canSchedule }) {
  const { api, tasks } = useData();
  const actions = useTaskActions();
  const [edit, setEdit] = useState(null);
  const t = today();
  const toggle = () => api.update(`studyGoals/${goal.id}`, { done: !goal.done, doneOn: goal.done ? null : t });
  const schedule = () => {
    if (todayTasks(tasks, t).shown.length >= MAX_TODAY) return window.alert('今天已經有 3 件了：先完成或移到別天');
    actions.add({ title: goal.title, date: t, project: big.title });
    api.update(`studyGoals/${goal.id}`, { scheduledOn: t });
  };
  const save = (e) => {
    e.preventDefault();
    if (edit.trim()) api.update(`studyGoals/${goal.id}`, { title: edit.trim() });
    setEdit(null);
  };
  return (
    <li className={`task ${goal.done ? 'done' : ''}`}>
      <label className="check">
        <input type="checkbox" checked={!!goal.done} onChange={toggle} aria-label={goal.title} />
        <span className="box" />
      </label>
      {edit !== null ? (
        <form className="grow row gap" onSubmit={save}>
          <input className="grow" value={edit} onChange={(e) => setEdit(e.target.value)} autoFocus aria-label="改目標" />
          <button className="btn small" type="submit">好</button>
        </form>
      ) : (
        <div className="task-body" onClick={() => setEdit(goal.title)}>
          <div className="task-title">{goal.title}</div>
          {goal.scheduledOn === t && !goal.done && <div className="task-meta"><span className="chip ok">已排進今天</span></div>}
        </div>
      )}
      {edit === null && (
        <div className="row-acts">
          {canSchedule && !goal.done && goal.scheduledOn !== t && (
            <button className="link" onClick={schedule}>排進今天</button>
          )}
          <button className="link muted" onClick={() => window.confirm(`刪除「${goal.title}」？`) && api.remove(`studyGoals/${goal.id}`)} aria-label={`刪除 ${goal.title}`}>
            刪除
          </button>
        </div>
      )}
    </li>
  );
}

function BigList({ onEdit }) {
  const { studyGoals, api } = useData();
  const t = today();
  const bigs = bigGoals(studyGoals);
  const old = bigGoals(studyGoals, { archived: true });
  return (
    <section className="section">
      {bigs.map((b, i) => {
        const p = bigProgress(studyGoals, b.id);
        return (
          <div key={b.id} className={`card study-group c-${b.color || GOAL_COLORS[i % GOAL_COLORS.length]}`}>
            <div className="study-group-head">
              <h3>{b.title}</h3>
              {b.deadline && <span className="chip">{deadlineText(b.deadline, t)}</span>}
            </div>
            {b.why && <p className="study-context">為什麼：{b.why}</p>}
            <div className="study-stats">
              <div>
                <span className="muted small">月目標 {p.month.done}／{p.month.total}</span>
                <Progress {...p.month} />
              </div>
              <div>
                <span className="muted small">每週目標 {p.week.done}／{p.week.total}</span>
                <Progress {...p.week} />
              </div>
            </div>
            <div className="row-acts">
              <button className="link" onClick={() => onEdit(b)}>編輯</button>
              <button className="link" onClick={() => api.update(`studyGoals/${b.id}`, { archived: true })}>完成了，收起來</button>
            </div>
          </div>
        );
      })}
      <button className="btn wide" onClick={() => onEdit({})}>新增大目標</button>
      {old.length > 0 && (
        <details className="more">
          <summary>收起來的大目標 {old.length} 個</summary>
          <ul className="list">
            {old.map((b) => (
              <li key={b.id} className="task done">
                <div className="task-body"><div className="task-title">{b.title}</div></div>
                <div className="row-acts">
                  <button className="link" onClick={() => api.update(`studyGoals/${b.id}`, { archived: false })}>拿回來</button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function BigEditor({ goal, onClose }) {
  const { api, studyGoals } = useData();
  const isNew = !goal.id;
  const [f, setF] = useState({ title: goal.title || '', why: goal.why || '', deadline: goal.deadline || '', color: goal.color || GOAL_COLORS[bigGoals(studyGoals).length % GOAL_COLORS.length] });
  const save = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    const data = { ...f, title: f.title.trim(), why: f.why.trim(), deadline: f.deadline || null };
    if (isNew) api.add('studyGoals', { ...data, level: 'big', archived: false, order: Date.now() });
    else api.update(`studyGoals/${goal.id}`, data);
    onClose();
  };
  const remove = () => {
    const kids = studyGoals.filter((g) => g.bigId === goal.id);
    if (!window.confirm(`刪除「${goal.title}」和底下 ${kids.length} 個月目標、每週目標？`)) return;
    api.batch([...kids, goal].map((g) => ({ remove: `studyGoals/${g.id}` })));
    onClose();
  };
  return (
    <Sheet title={isNew ? '新增大目標' : '編輯大目標'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          大目標
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="例：多益 850" autoFocus={isNew} />
        </label>
        <label>
          為什麼想做到（可不填）
          <input value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} placeholder="例：明年換工作要用" />
        </label>
        <label>
          想在哪天前做到（可不填）
          <input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
        </label>
        <div className="study-colors" role="radiogroup" aria-label="顏色">
          {GOAL_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c} className={`c-${c} ${f.color === c ? 'on' : ''}`} onClick={() => setF({ ...f, color: c })} />
          ))}
        </div>
        <div className="row gap">
          <button className="btn primary" type="submit">儲存</button>
          {!isNew && <button className="btn danger" type="button" onClick={remove}>刪除</button>}
        </div>
      </form>
    </Sheet>
  );
}

// 首頁用：這週的學習目標
export function StudyTodayCard() {
  const { studyGoals } = useData();
  const t = today();
  const week = weekStart(t);
  const bigs = bigGoals(studyGoals);
  if (!bigs.length) return null;
  const live = new Set(bigs.map((b) => b.id));
  const list = goalsIn(studyGoals, 'week', week).filter((g) => live.has(g.bigId));
  const left = list.filter((g) => !g.done);
  return (
    <Link to="/study" className="reminder study-home">
      <span className="grow">
        <strong>這週學習目標 {list.length - left.length}／{list.length}</strong>
        <span className="muted small ellipsis">{list.length ? (left[0] ? `下一個：${left[0].title}` : '這週都完成了') : '還沒寫這週要做到什麼'}</span>
      </span>
      <span>→</span>
    </Link>
  );
}
