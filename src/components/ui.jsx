import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { today, addDays, weekStart, shortLabel, diffDays } from '../lib/date.js';

export const money = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

const ICONS = {
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  week: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8 13h2M12 13h2M16 13h0',
  month: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01',
  money: 'M3 7h18v12H3zM3 11h18M7 15h3',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  x: 'M18 6L6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  plus: 'M12 5v14M5 12h14',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z',
  english: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11M9 8h6',
};

export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Ring({ value, total, size = 76 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const p = total ? Math.min(1, value / total) : 0;
  return (
    <svg width={size} height={size} className="ring" role="img" aria-label={`${value}／${total}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth="8" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeWidth="8" fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - p)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-text">
        {value}／{total}
      </text>
    </svg>
  );
}

export function Bar({ row }) {
  const pct = row.budget > 0 ? Math.min(100, (row.spent / row.budget) * 100) : row.spent > 0 ? 100 : 0;
  return (
    <div className={`bar-row ${row.status}`}>
      <div className="bar-head">
        <span>{row.name}</span>
        <span className="num">
          {money(row.spent)} / {money(row.budget)}
        </span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="bar-foot">{row.left >= 0 ? `剩 ${money(row.left)}` : `超過 ${money(-row.left)}`}</div>
    </div>
  );
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// 「移到…」選單：手機用原生下拉，好點
export function MoveSelect({ value, onMove, label = '移到…' }) {
  const [picking, setPicking] = useState(false);
  const t = today();
  const nextMon = addDays(weekStart(t), 7);
  const options = [
    ['今天', t],
    ['明天', addDays(t, 1)],
    ['後天', addDays(t, 2)],
    [`下週一 ${shortLabel(nextMon)}`, nextMon],
  ];
  if (picking) {
    return (
      <input
        type="date"
        className="move-date"
        autoFocus
        defaultValue={value || t}
        onChange={(e) => e.target.value && onMove(e.target.value)}
        onBlur={() => setPicking(false)}
      />
    );
  }
  return (
    <select
      className="move-select"
      value=""
      aria-label={label}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '__pick') setPicking(true);
        else if (v === '__none') onMove(null);
        else if (v) onMove(v);
      }}
    >
      <option value="">{label}</option>
      {options
        .filter(([, d]) => d !== value)
        .map(([l, d]) => (
          <option key={l} value={d}>
            {l}
          </option>
        ))}
      <option value="__pick">選日期…</option>
      <option value="__none">未排定</option>
    </select>
  );
}

export function TaskRow({ task, onToggle, onMove, onDelete, onEdit, showDate, draggable, extra }) {
  return (
    <li
      className={`task ${task.done ? 'done' : ''}`}
      draggable={draggable}
      onDragStart={draggable ? (e) => e.dataTransfer.setData('text/task', task.id) : undefined}
    >
      <label className="check">
        <input type="checkbox" checked={!!task.done} onChange={() => onToggle(task)} />
        <span className="box" />
      </label>
      <div className="task-body" onClick={onEdit ? () => onEdit(task) : undefined}>
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {showDate && task.date && <span>{shortLabel(task.date)}</span>}
          {task.project && <span className="chip">{task.project}</span>}
          {task.note && <span className="muted">{task.note}</span>}
          {extra}
        </div>
      </div>
      <div className="task-actions">
        {onMove && <MoveSelect value={task.date} onMove={(d) => onMove(task, d)} />}
        {onDelete && (
          <button className="icon-btn" aria-label="刪除" onClick={() => onDelete(task)}>
            <Icon name="trash" size={18} />
          </button>
        )}
      </div>
    </li>
  );
}

export function deadlineLabel(d, day) {
  const n = diffDays(day, d.date);
  if (n < 0) return '已過';
  if (d.tentative) return n === 0 ? '最早今天' : `最早 ${n} 天`;
  return n === 0 ? '今天' : `還有 ${n} 天`;
}

export function DeadlineRow({ d, day, onEdit, onDelete }) {
  const navigate = useNavigate();
  // 收件匣的截止日是算出來的，回收件匣改
  const open = d.fromInbox ? () => navigate(`/inbox?id=${d.inboxId}`) : onEdit ? () => onEdit(d) : undefined;
  return (
    <li className="deadline">
      <span className="dl-dot" />
      <div className="task-body" onClick={open}>
        <div className="task-title">{d.title}</div>
        <div className="task-meta">
          <span>{deadlineLabel(d, day)}</span>
          {d.project && <span className="chip">{d.project}</span>}
          {d.tentative && <span className="chip warn">日期未定</span>}
          {d.fromInbox && <span className="chip">收件匣</span>}
        </div>
      </div>
      {onDelete && !d.fromInbox && (
        <button className="icon-btn" aria-label="刪除" onClick={() => onDelete(d)}>
          <Icon name="trash" size={18} />
        </button>
      )}
    </li>
  );
}

export function useProjects(tasks, deadlines) {
  const set = new Set(['專題報告', '育成提案', '英文', '實習報告', '履歷', 'DecorateMe', '企業倫理']);
  [...tasks, ...deadlines].forEach((t) => t.project && set.add(t.project));
  return [...set];
}
