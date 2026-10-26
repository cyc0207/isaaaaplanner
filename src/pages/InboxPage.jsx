import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, shortLabel } from '../lib/date.js';
import { KINDS, STATUSES, emptyItem, buildInboxPreview, INBOX_GPT_PROMPT, isClosed } from '../lib/inbox.js';
import { JOB_TRACKS } from '../lib/jobs.js';
import { JobBoard, JobEditor } from '../components/Jobs.jsx';
import { Sheet, deadlineLabel } from '../components/ui.jsx';
import { useGmailSync, SyncButton, QueryEditor } from '../components/Gmail.jsx';
import { gmailLink } from '../lib/gmail.js';
import { auth } from '../firebase.js';

const FILTERS = [
  ['open', '進行中'],
  ['competition', '比賽'],
  ['resume', '求職'],
  ['closed', '已結束'],
  ['gmail', 'Gmail'],
  ['import', '匯入'],
];

export default function InboxPage() {
  const { inbox, mail, api } = useData();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('open');
  const [editing, setEditing] = useState(null);
  const [quick, setQuick] = useState('');
  const [kind, setKind] = useState('competition');
  const t = today();

  // 從行事曆點進來：直接打開那一筆
  useEffect(() => {
    const id = params.get('id');
    const it = id && inbox.find((x) => x.id === id);
    if (it) {
      if (it.kind === 'resume') setFilter('resume');
      setEditing(it);
      setParams({}, { replace: true });
    }
  }, [params, inbox, setParams]);

  const newMail = mail.filter((m) => m.box === 'competition' && m.status === 'new').length;
  const shown = inbox
    .filter((it) =>
      filter === 'open' ? !isClosed(it) : filter === 'closed' ? isClosed(it) : it.kind === filter && !isClosed(it),
    )
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  // 快速丟進來：只要名稱，其他之後再補
  const add = (e) => {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    api.add('inbox', { ...emptyItem(kind), title });
    setQuick('');
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>收件匣</h1>
      </header>
      <form className="quick-inbox card" onSubmit={add}>
        <div className="seg">
          {Object.entries(KINDS).map(([k, l]) => (
            <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="row gap">
          <input className="grow" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={kind === 'resume' ? '例：某某公司 行銷實習生' : '例：大專校院創新創業競賽'} />
          <button className="btn primary">丟進來</button>
        </div>
        <p className="muted small">先丟進來就好，不用馬上決定。週日排下週時會列出「考慮中」的讓你決定。</p>
      </form>

      <div className="tabs" role="tablist">
        {FILTERS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {l}
            {k === 'gmail' && newMail > 0 && <span className="count-dot num">{newMail}</span>}
          </button>
        ))}
      </div>

      {filter === 'gmail' ? (
        <GmailInbox />
      ) : filter === 'import' ? (
        <InboxImport />
      ) : filter === 'resume' ? (
        <JobBoard />
      ) : (
        <>

      {!shown.length && <p className="muted">這裡是空的。</p>}
      <ul className="list">
        {shown.map((it) => (
          <li key={it.id} className="task inbox-row" onClick={() => setEditing(it)}>
            <div className="task-body">
              <div className="task-title">
                {it.title}
                {it.kind === 'resume' && it.company && <span className="muted">・{it.company}</span>}
              </div>
              <div className="task-meta">
                <span className="chip">{it.kind === 'resume' && JOB_TRACKS[it.track] ? JOB_TRACKS[it.track] : KINDS[it.kind]}</span>
                <span className={`chip ${it.status === '考慮中' ? 'warn' : ''}`}>{it.status}</span>
                {it.deadline && (
                  <span>
                    截止 {shortLabel(it.deadline)}・{deadlineLabel({ date: it.deadline }, t)}
                  </span>
                )}
                {it.kind === 'competition' && it.canReuseProject && <span className="chip ok">可用現有專題</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
        </>
      )}
      {editing && (editing.kind === 'resume' ? <JobEditor item={editing} onClose={() => setEditing(null)} /> : <InboxEditor item={editing} onClose={() => setEditing(null)} />)}
    </div>
  );
}

export function InboxEditor({ item, onClose }) {
  const { api } = useData();
  const [f, setF] = useState({ ...emptyItem(item.kind), ...item });
  const statuses = STATUSES[f.kind] || STATUSES.other;
  const save = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    const { id, createdAt, createdAtMs, ...data } = f;
    api.update(`inbox/${item.id}`, { ...data, title: f.title.trim(), status: statuses.includes(f.status) ? f.status : statuses[0] });
    onClose();
  };
  return (
    <Sheet title={KINDS[f.kind]} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          類型
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, status: STATUSES[e.target.value][0] })}>
            {Object.entries(KINDS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          {f.kind === 'resume' ? '職缺' : '名稱'}
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        {f.kind === 'resume' && (
          <label>
            公司
            <input value={f.company || ''} onChange={(e) => setF({ ...f, company: e.target.value })} />
          </label>
        )}
        <div className="row gap wrap">
          <label className="mini">
            {f.kind === 'competition' ? '報名截止日' : '截止日'}
            <input type="date" value={f.deadline || ''} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
          </label>
          {f.kind === 'competition' && (
            <label className="mini">
              繳件日
              <input type="date" value={f.submitDate || ''} onChange={(e) => setF({ ...f, submitDate: e.target.value })} />
            </label>
          )}
        </div>
        <label>
          狀態
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {f.kind === 'competition' && (
          <label className="inline">
            <input type="checkbox" checked={!!f.canReuseProject} onChange={(e) => setF({ ...f, canReuseProject: e.target.checked })} />
            可以用現有專題（例：DecorateMe）去投
          </label>
        )}
        <label>
          連結
          <input type="url" value={f.url || ''} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" />
        </label>
        {f.url && /^https?:\/\//.test(f.url) && (
          <a href={f.url} target="_blank" rel="noreferrer" className="link">
            打開連結 →
          </a>
        )}
        <label>
          備註
          <input value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
        <p className="muted small">有截止日的會自動出現在週曆和月曆上，前一天首頁會提醒。</p>
        <div className="row gap">
          <button className="btn primary" type="submit">
            儲存
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (window.confirm(`刪除「${item.title}」？`)) {
                api.remove(`inbox/${item.id}`);
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

// Gmail 收進來的比賽信：看一眼，決定要不要丟進收件匣
function GmailInbox() {
  const { mail, api } = useData();
  const g = useGmailSync();
  const [showDone, setShowDone] = useState(false);
  const email = auth.currentUser?.email;
  const all = mail.filter((m) => m.box === 'competition');
  const shown = all.filter((m) => (showDone ? m.status !== 'new' : m.status === 'new'));

  const addToInbox = (m) => {
    const id = api.add('inbox', {
      ...emptyItem('competition'),
      title: m.subject,
      deadline: m.guess || '',
      url: gmailLink(m, email),
      note: `Gmail：${m.from}（${m.date}）`,
    });
    api.update(`mail/${m.id}`, { status: 'added', inboxId: id });
  };

  return (
    <div className="gmail-box">
      <div className="card">
        <SyncButton g={g} />
        <QueryEditor queries={g.queries} />
      </div>
      <div className="row between gmail-head">
        <span className="muted small">{showDone ? '已處理的信' : `${shown.length} 封還沒看`}</span>
        <button className="link small" onClick={() => setShowDone(!showDone)}>
          {showDone ? '看還沒處理的' : '看已處理的'}
        </button>
      </div>
      {!shown.length && <p className="muted">{g.lastSync ? '這裡是空的。' : '按「連結 Gmail」後，符合比賽條件的信會出現在這裡。'}</p>}
      <ul className="list">
        {shown.map((m) => (
          <li key={m.id} className="mail-row">
            <a className="mail-subject" href={gmailLink(m, email)} target="_blank" rel="noreferrer">
              {m.subject}
            </a>
            <div className="task-meta">
              <span>{m.from}</span>
              <span>{m.date}</span>
              {m.guess && <span className="chip warn">可能截止 {shortLabel(m.guess)}</span>}
            </div>
            {m.snippet && <p className="mail-snippet">{m.snippet}</p>}
            {m.status === 'new' ? (
              <div className="row gap">
                <button className="btn small primary" onClick={() => addToInbox(m)}>
                  丟進收件匣
                </button>
                <button className="btn small" onClick={() => api.update(`mail/${m.id}`, { status: 'skipped' })}>
                  略過
                </button>
              </div>
            ) : (
              <div className="row gap">
                <span className="chip">{m.status === 'added' ? '已丟進收件匣' : '已略過'}</span>
                <button className="link small" onClick={() => api.update(`mail/${m.id}`, { status: 'new' })}>
                  放回來
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// 從 ChatGPT 匯入：複製 prompt、貼回結果、檢查後丟進收件匣
const IMPORT_LABEL = { ok: '新的', duplicate: '重複', error: '有錯' };

function InboxImport() {
  const { inbox, api } = useData();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(INBOX_GPT_PROMPT);
      setCopied(true);
    } catch {
      window.prompt('複製下面這段', INBOX_GPT_PROMPT);
    }
  };

  const check = (raw) => {
    setResult('');
    setPreview(buildInboxPreview(raw, inbox));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const raw = await file.text();
    setText(raw);
    check(raw);
  };

  const toggle = (i) =>
    setPreview({ ...preview, rows: preview.rows.map((r, j) => (j === i && r.status_ !== 'error' ? { ...r, selected: !r.selected } : r)) });

  const confirm = () => {
    const rows = preview.rows.filter((r) => r.selected && r.status_ !== 'error');
    const ops = rows.map(({ line, rawKind, status_, errors, warnings, selected, ...data }) => ({ add: 'inbox', data }));
    for (let i = 0; i < ops.length; i += 400) api.batch(ops.slice(i, i + 400));
    const skipped = preview.rows.length - rows.length;
    setResult(`已匯入 ${rows.length} 筆${skipped ? `，略過 ${skipped} 筆` : ''}。有截止日的已經出現在週曆和月曆上。`);
    setPreview(null);
    setText('');
  };

  const counts = preview?.rows.reduce((c, r) => ({ ...c, [r.status_]: (c[r.status_] || 0) + 1 }), {}) || {};
  const selectedCount = preview?.rows.filter((r) => r.selected).length || 0;

  return (
    <div className="inbox-import">
      <section className="section">
        <h2>1. 請 ChatGPT 整理</h2>
        <p className="muted small">複製這段貼給 ChatGPT，它會把記得的比賽、實習和工作機會整理成 CSV。</p>
        <button className="btn" onClick={copyPrompt}>
          {copied ? '已複製' : '複製 prompt'}
        </button>
      </section>
      <section className="section">
        <h2>2. 貼上結果</h2>
        <textarea className="paste" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'kind,title,company,deadline,submitDate,url,status,note\ncompetition,大專校院創新創業競賽,教育部,2026-11-30,,https://,考慮中,'} />
        <div className="row gap wrap">
          <button className="btn primary" onClick={() => check(text)} disabled={!text.trim()}>
            檢查
          </button>
          <label className="btn file-btn">
            或選 CSV 檔
            <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} hidden />
          </label>
        </div>
        {result && <p className="hint ok">{result}</p>}
        {preview?.error && <p className="hint over">{preview.error}</p>}
        {preview && !preview.error && (
          <div className="preview">
            <p className="small">
              共 {preview.rows.length} 筆：新的 {counts.ok || 0}、重複 {counts.duplicate || 0}、有錯 {counts.error || 0}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>狀態</th>
                    <th>類型</th>
                    <th>名稱</th>
                    <th>截止</th>
                    <th>進度</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className={`st-${r.status_}`}>
                      <td>
                        <input type="checkbox" checked={r.selected} disabled={r.status_ === 'error'} onChange={() => toggle(i)} />
                      </td>
                      <td>
                        {r.status_ === 'error' ? r.errors.join('；') : IMPORT_LABEL[r.status_]}
                        {r.warnings.length > 0 && <div className="small warn-text">{r.warnings.join('；')}</div>}
                      </td>
                      <td>{r.status_ === 'error' && !KINDS[r.kind] ? r.rawKind : KINDS[r.kind]}</td>
                      <td>
                        {r.title}
                        {r.company && <span className="muted">・{r.company}</span>}
                      </td>
                      <td>{r.deadline ? shortLabel(r.deadline) : ''}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row gap">
              <button className="btn primary" onClick={confirm} disabled={!selectedCount}>
                匯入 {selectedCount} 筆
              </button>
              <button className="btn" onClick={() => setPreview(null)}>
                取消
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
