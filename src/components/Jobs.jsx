import { useMemo, useRef, useState } from 'react';
import { useData } from '../data.jsx';
import { today, shortLabel } from '../lib/date.js';
import { Sheet, deadlineLabel } from './ui.jsx';
import {
  JOB_TRACKS, TRACK_ORDER, APPLY_STATUSES, LEGACY_APPLY_STATUSES, RESUME_STATUSES, LINK_TYPES, LISTING_FIELDS, TBD, ATTACH_MAX_BYTES,
  emptyJob, filterJobs, planJobImport, findSameJob, jobUrlKey, linkTypeOf, guessLinkType, officialUrlError, isJobClosed, orTBD,
} from '../lib/jobs.js';
import { JOBS_2026_10_21, JOB_BATCH_ID, DEFAULT_JOB_PROFILE } from '../data/jobs20261021.js';

const jobLabel = (it) => [it.company, it.title].filter(Boolean).join('｜') || '（沒有名稱）';
const isHttp = (u) => /^https?:\/\//.test(u || '');

// 外部連結：只打開頁面，不會幫你投遞或寄信
function ExtLink({ href, children, className = 'link small' }) {
  if (!isHttp(href)) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  );
}

export function JobLinks({ it }) {
  const type = linkTypeOf(it);
  const needOfficial = type === 'linkedin' || type === 'board';
  return (
    <div className="job-links">
      {isHttp(it.url) ? (
        <ExtLink href={it.url}>打開{type === 'linkedin' ? ' ' : ''}{LINK_TYPES[type] || '職缺頁'} →</ExtLink>
      ) : (
        <span className="muted small">職缺連結：{TBD}</span>
      )}
      {isHttp(it.officialUrl) ? (
        <ExtLink href={it.officialUrl}>打開正式投遞入口 →</ExtLink>
      ) : (
        needOfficial && <span className="muted small">正式投遞入口：待補</span>
      )}
    </div>
  );
}

function JobCard({ it, onOpen, t }) {
  const closed = isJobClosed(it);
  return (
    <li className={`job-card${closed ? ' closed' : ''}`} onClick={() => onOpen(it)}>
      <div className="job-top">
        <span className="job-pri num" aria-label="優先順序">{it.priority === '' || it.priority == null ? '–' : `#${it.priority}`}</span>
        <div className="job-name">
          <div className="job-company">{it.company || TBD}</div>
          <div className="job-title">{it.title || TBD}</div>
        </div>
      </div>
      <div className="task-meta">
        <span className={`chip track-${it.track || 'none'}`}>{JOB_TRACKS[it.track] || '未分類'}</span>
        <span className={`chip ${(it.status || '未確認') === '未確認' ? 'warn' : ''}`}>申請：{it.status || '未確認'}</span>
        <span className={`chip ${(it.resumeStatus || '未確認') === '未確認' ? 'warn' : ''}`}>履歷：{it.resumeStatus || '未確認'}</span>
      </div>
      <dl className="job-facts">
        <dt>截止日</dt>
        <dd>{it.deadline ? `${shortLabel(it.deadline)}・${deadlineLabel({ date: it.deadline }, t)}` : TBD}</dd>
        {it.track === 'excluded' ? (
          <>
            <dt>排除原因</dt>
            <dd>{orTBD(it.excludeReason)}</dd>
          </>
        ) : (
          <>
            <dt>履歷版本</dt>
            <dd>{orTBD(it.resumeVersion)}</dd>
            <dt>能力缺口</dt>
            <dd>{orTBD(it.gap)}</dd>
            <dt>待確認</dt>
            <dd>{it.toConfirm || '（沒有）'}</dd>
          </>
        )}
      </dl>
      <JobLinks it={it} />
    </li>
  );
}

function JobProfile() {
  const { jobSettings, api } = useData();
  const text = jobSettings.profile ?? DEFAULT_JOB_PROFILE;
  const [draft, setDraft] = useState(null);
  return (
    <details className="card job-profile">
      <summary>我的求職條件</summary>
      {draft === null ? (
        <>
          <pre className="job-profile-text">{text}</pre>
          <button className="btn small" onClick={() => setDraft(text)}>
            編輯
          </button>
        </>
      ) : (
        <div className="form">
          <textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="row gap">
            <button
              className="btn small primary"
              onClick={() => {
                api.set('settings/jobs', { profile: draft });
                setDraft(null);
              }}
            >
              儲存
            </button>
            <button className="btn small" onClick={() => setDraft(null)}>
              取消
            </button>
          </div>
        </div>
      )}
    </details>
  );
}

// 一批整理好的職缺：先預覽「新增／更新」，按了才寫進去
function JobBatch({ batch, batchId, title }) {
  const { inbox, jobSettings, api } = useData();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  const rows = useMemo(() => planJobImport(batch, inbox), [batch, inbox]);
  const todo = rows.filter((r) => r.action !== 'same');
  if (done) return <p className="hint ok">{done}</p>;
  if (jobSettings.applied?.[batchId] || !todo.length) return null;
  const adds = todo.filter((r) => r.action === 'add').length;
  const ups = todo.length - adds;

  const apply = () => {
    const ops = todo.map((r) => (r.action === 'add' ? { add: 'inbox', data: r.job } : { set: `inbox/${r.target.id}`, data: r.patch, merge: true }));
    ops.push({ set: 'settings/jobs', data: { applied: { [batchId]: Date.now() } }, merge: true });
    api.batch(ops);
    setDone(`已新增 ${adds} 筆、更新 ${ups} 筆。原本的紀錄都還在，申請和履歷狀態沒有被改。`);
  };

  return (
    <div className="card job-batch">
      <div className="strong">{title}</div>
      <p className="small">
        要新增 {adds} 筆{ups ? `、更新既有的 ${ups} 筆（連結或職缺代碼相同）` : ''}。
      </p>
      <button className="link small" onClick={() => setOpen(!open)}>
        {open ? '收起來' : '先看看有哪些'}
      </button>
      {open && (
        <ul className="job-batch-list small">
          {todo.map((r, i) => (
            <li key={i}>
              <span className={`chip ${r.action === 'add' ? 'ok' : 'warn'}`}>{r.action === 'add' ? '新增' : '更新'}</span> {jobLabel(r.job)}
              {r.action === 'update' && <span className="muted">（改：{Object.keys(r.patch).join('、')}）</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="row gap">
        <button className="btn small primary" onClick={apply}>
          加入求職清單
        </button>
      </div>
    </div>
  );
}

export function JobBoard() {
  const { inbox } = useData();
  const [track, setTrack] = useState('all');
  const [status, setStatus] = useState('all');
  const [resumeStatus, setResumeStatus] = useState('all');
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState(null);
  const t = today();
  const jobs = inbox.filter((it) => it.kind === 'resume');
  const shown = filterJobs(inbox, { track, status, resumeStatus, showClosed });
  const count = (k) => jobs.filter((it) => (k === 'none' ? !TRACK_ORDER.includes(it.track) : it.track === k)).length;
  const legacy = [...new Set(jobs.map((it) => it.status).filter((s) => LEGACY_APPLY_STATUSES.includes(s)))];
  const trackTabs = [['all', '全部'], ...TRACK_ORDER.map((k) => [k, JOB_TRACKS[k]]), ...(count('none') ? [['none', '未分類']] : [])];

  return (
    <div className="job-board">
      <JobProfile />
      <JobBatch batch={JOBS_2026_10_21} batchId={JOB_BATCH_ID} title="2026/10/21 整理的職缺" />
      <p className="muted small">職缺資訊是整理當下的狀況，不保證仍開放，投之前先點連結確認。這裡只記錄，不會幫你寄信或投遞。</p>

      <div className="tabs job-tracks" role="tablist">
        {trackTabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={track === k} className={track === k ? 'on' : ''} onClick={() => setTrack(k)}>
            {l}
            {k !== 'all' && <span className="num"> {count(k)}</span>}
          </button>
        ))}
      </div>
      <div className="row gap wrap job-filters">
        <label className="mini">
          申請狀態
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            {[...APPLY_STATUSES, ...legacy].map((s) => (
              <option key={s} value={s}>
                {LEGACY_APPLY_STATUSES.includes(s) ? `${s}（舊）` : s}
              </option>
            ))}
          </select>
        </label>
        <label className="mini">
          履歷完成狀態
          <select value={resumeStatus} onChange={(e) => setResumeStatus(e.target.value)}>
            <option value="all">全部</option>
            {RESUME_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="inline small">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          顯示已結束和排除的
        </label>
      </div>

      <button className="btn primary wide job-add" onClick={() => setEditing({ ...emptyJob(), track: track !== 'all' && track !== 'none' ? track : '' })}>
        ＋ 新增職缺
      </button>

      {!shown.length && <p className="muted">這裡是空的。</p>}
      <ul className="list job-list">
        {shown.map((it) => (
          <JobCard key={it.id} it={it} t={t} onOpen={setEditing} />
        ))}
      </ul>
      {editing && <JobEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// 履歷附件：可以貼雲端連結，或上傳 700 KB 以內的檔案
function Attachments({ list, onChange, added }) {
  const { api } = useData();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');

  const addLink = () => {
    if (!isHttp(url.trim())) return setMsg('連結要以 https:// 開頭');
    onChange([...list, { id: newId(), name: name.trim() || url.trim(), url: url.trim() }]);
    setName('');
    setUrl('');
    setMsg('');
  };

  const addFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > ATTACH_MAX_BYTES) return setMsg(`檔案 ${Math.round(file.size / 1024)} KB 太大了（上限 700 KB）。可以改貼 Google 雲端硬碟的連結。`);
    try {
      const data = await readDataUrl(file);
      const fileId = newId();
      api.set(`jobFiles/${fileId}`, { name: file.name, type: file.type, size: file.size, data }, false);
      added.current.push(fileId);
      onChange([...list, { id: fileId, name: file.name, fileId, size: file.size }]);
      setMsg('');
    } catch (err) {
      setMsg(`讀不到這個檔案：${err?.message || err}`);
    }
  };

  const openFile = async (a) => {
    const d = await api.get(`jobFiles/${a.fileId}`).catch(() => null);
    if (!d?.data) return setMsg('找不到這個檔案，可能還沒同步完，等一下再試。');
    const href = URL.createObjectURL(dataUrlToBlob(d.data));
    const link = document.createElement('a');
    link.href = href;
    link.download = a.name;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  };

  return (
    <div className="job-attach">
      {!list.length && <p className="muted small">還沒有附件。</p>}
      <ul className="list">
        {list.map((a) => (
          <li key={a.id} className="row between gap">
            {a.fileId ? (
              <button type="button" className="link small" onClick={() => openFile(a)}>
                {a.name}（{Math.max(1, Math.round((a.size || 0) / 1024))} KB）
              </button>
            ) : (
              <ExtLink href={a.url}>{a.name}</ExtLink>
            )}
            <button type="button" className="link small danger-text" onClick={() => onChange(list.filter((x) => x.id !== a.id))}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <div className="row gap wrap">
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="附件名稱（例：IBM 履歷 v2）" />
        <input className="grow" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="雲端連結 https://" />
        <button type="button" className="btn small" onClick={addLink} disabled={!url.trim()}>
          加連結
        </button>
        <label className="btn small file-btn">
          上傳檔案
          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={addFile} hidden />
        </label>
      </div>
      {msg && <p className="hint warn">{msg}</p>}
    </div>
  );
}

const Field = ({ label, children, hint }) => (
  <label>
    {label}
    {children}
    {hint && <span className="muted small">{hint}</span>}
  </label>
);

export function JobEditor({ item, onClose }) {
  const { inbox, api } = useData();
  const isNew = !item.id;
  const [f, setF] = useState({ ...emptyJob(), ...item, attachments: item.attachments || [] });
  const [err, setErr] = useState('');
  const added = useRef([]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const statuses = APPLY_STATUSES.includes(f.status) ? APPLY_STATUSES : [...APPLY_STATUSES, f.status];
  const resumeStatuses = RESUME_STATUSES.includes(f.resumeStatus) ? RESUME_STATUSES : [...RESUME_STATUSES, f.resumeStatus];
  const urlType = linkTypeOf(f);
  const officialErr = officialUrlError(f.officialUrl);
  const dup = findSameJob(f, inbox, item.id);

  // 沒存就關掉：剛上傳的檔案一起刪掉
  const close = (saved = false) => {
    if (!saved) added.current.forEach((fid) => api.remove(`jobFiles/${fid}`));
    else {
      const keep = new Set(f.attachments.map((a) => a.fileId).filter(Boolean));
      (item.attachments || []).forEach((a) => a.fileId && !keep.has(a.fileId) && api.remove(`jobFiles/${a.fileId}`));
      added.current.forEach((fid) => !keep.has(fid) && api.remove(`jobFiles/${fid}`));
    }
    onClose();
  };

  const save = (e) => {
    e.preventDefault();
    if (!f.company.trim() && !f.title.trim()) return setErr('公司或職稱至少填一個。');
    if (f.url && !isHttp(f.url)) return setErr('職缺連結要以 https:// 開頭。');
    if (officialErr) return setErr(officialErr);
    const { id, createdAt, createdAtMs, ...rest } = f;
    const data = {
      ...rest,
      company: f.company.trim(),
      title: f.title.trim(),
      jobId: (f.jobId || '').trim(),
      url: (f.url || '').trim(),
      officialUrl: (f.officialUrl || '').trim(),
      priority: f.priority === '' || f.priority == null ? '' : Number(f.priority),
      urlType: f.url ? urlType : '',
    };
    if (dup) {
      if (!isNew) return setErr(`連結或職缺代碼跟「${jobLabel(dup)}」一樣。同一個職缺請改那一筆，不要重複。`);
      if (!window.confirm(`已經有同一個職缺：「${jobLabel(dup)}」（連結或職缺代碼相同）。\n要把這次有填的欄位更新到那一筆，而不是新增一筆嗎？\n（那一筆的申請狀態、履歷狀態不會被改）`)) return;
      const filled = (k) => data[k] !== '' && data[k] != null;
      const patch = {};
      for (const k of LISTING_FIELDS) if (filled(k)) patch[k] = data[k];
      // 同一個網址只是參數不同：保留原本的
      for (const k of ['url', 'officialUrl']) if (patch[k] && jobUrlKey(patch[k]) === jobUrlKey(dup[k])) delete patch[k];
      for (const k of ['startDate', 'daysPerWeek', 'note', 'checkedAt', 'updates']) if (filled(k) && !dup[k]) patch[k] = data[k];
      if (data.attachments.length) patch.attachments = [...(dup.attachments || []), ...data.attachments];
      api.update(`inbox/${dup.id}`, patch);
      added.current = [];
      return onClose();
    }
    if (isNew) api.add('inbox', data);
    else api.update(`inbox/${item.id}`, data);
    close(true);
  };

  const remove = () => {
    if (!window.confirm(`刪除「${jobLabel(item)}」？附件也會一起刪掉。`)) return;
    const ops = [{ remove: `inbox/${item.id}` }, ...(item.attachments || []).filter((a) => a.fileId).map((a) => ({ remove: `jobFiles/${a.fileId}` }))];
    api.batch(ops);
    added.current.forEach((fid) => api.remove(`jobFiles/${fid}`));
    onClose();
  };

  return (
    <Sheet title={isNew ? '新增職缺' : '職缺'} onClose={() => close(false)}>
      <form className="form job-form" onSubmit={save}>
        <Field label="公司">
          <input value={f.company} onChange={set('company')} placeholder="例：台灣賓士" />
        </Field>
        <Field label="職稱">
          <input value={f.title} onChange={set('title')} />
        </Field>
        <div className="row gap wrap">
          <label className="mini">
            分類
            <select value={f.track || ''} onChange={set('track')}>
              <option value="">未分類</option>
              {TRACK_ORDER.map((k) => (
                <option key={k} value={k}>
                  {JOB_TRACKS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="mini">
            優先順序
            <input type="number" min="1" inputMode="numeric" value={f.priority ?? ''} onChange={set('priority')} />
          </label>
          <label className="mini">
            職缺代碼
            <input value={f.jobId || ''} onChange={set('jobId')} placeholder="沒有就留空" />
          </label>
        </div>
        <div className="row gap wrap">
          <label className="mini">
            申請狀態
            <select value={f.status} onChange={set('status')}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {LEGACY_APPLY_STATUSES.includes(s) ? `${s}（舊）` : s}
                </option>
              ))}
            </select>
          </label>
          <label className="mini">
            履歷完成狀態
            <select value={f.resumeStatus} onChange={set('resumeStatus')}>
              {resumeStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="mini">
            截止日
            <input type="date" value={f.deadline || ''} onChange={set('deadline')} />
          </label>
        </div>
        <Field label="職缺連結" hint={f.url ? `類型：${LINK_TYPES[urlType] || '其他連結'}${urlType === 'linkedin' ? '（不是正式投遞入口）' : ''}` : ''}>
          <input type="url" value={f.url || ''} onChange={(e) => setF({ ...f, url: e.target.value, urlType: guessLinkType(e.target.value) === 'linkedin' ? 'linkedin' : f.urlType === 'linkedin' ? '' : f.urlType })} placeholder="https://" />
        </Field>
        {f.url && urlType !== 'linkedin' && (
          <label className="mini">
            這個連結是
            <select value={f.urlType || guessLinkType(f.url)} onChange={set('urlType')}>
              {['company', 'board', 'other'].map((k) => (
                <option key={k} value={k}>
                  {LINK_TYPES[k]}
                </option>
              ))}
            </select>
          </label>
        )}
        <Field label="正式投遞入口（公司官網）" hint={officialErr || (f.officialUrl ? '' : '還不知道就留空，清單上會顯示「待補」。')}>
          <input type="url" value={f.officialUrl || ''} onChange={set('officialUrl')} placeholder="https://" />
        </Field>
        <JobLinks it={f} />
        {dup && <p className="hint warn">這個連結或職缺代碼跟「{jobLabel(dup)}」一樣。</p>}

        {f.track === 'excluded' && (
          <Field label="排除原因">
            <input value={f.excludeReason || ''} onChange={set('excludeReason')} />
          </Field>
        )}
        <Field label="履歷版本">
          <input value={f.resumeVersion || ''} onChange={set('resumeVersion')} placeholder="例：IBM_商業顧問校園招募_履歷" />
        </Field>
        <Field label="履歷強調">
          <textarea rows={2} value={f.resumeFocus || ''} onChange={set('resumeFocus')} />
        </Field>
        <Field label="能力缺口（最需補強）">
          <input value={f.gap || ''} onChange={set('gap')} />
        </Field>
        <Field label="已知條件（職缺有寫的）">
          <textarea rows={2} value={f.known || ''} onChange={set('known')} />
        </Field>
        <Field label="待確認事項">
          <textarea rows={2} value={f.toConfirm || ''} onChange={set('toConfirm')} />
        </Field>
        <div className="row gap wrap">
          <label className="mini grow">
            到職日期
            <input value={f.startDate || ''} onChange={set('startDate')} placeholder={TBD} />
          </label>
          <label className="mini grow">
            每週可出勤天數
            <input value={f.daysPerWeek || ''} onChange={set('daysPerWeek')} placeholder={TBD} />
          </label>
        </div>
        <div className="form-field">
          <span>履歷附件</span>
          <Attachments list={f.attachments} onChange={(attachments) => setF({ ...f, attachments })} added={added} />
        </div>
        <Field label="備註">
          <textarea rows={2} value={f.note || ''} onChange={set('note')} />
        </Field>
        <details className="job-more">
          <summary>後續更新</summary>
          <div className="form">
            <p className="muted small">{f.asOf ? `職缺資訊整理於 ${f.asOf.replaceAll('-', '/')}，不保證仍開放。` : '手動新增的職缺。'}</p>
            <label className="mini">
              最後確認職缺還開著的日期
              <input type="date" value={f.checkedAt || ''} onChange={set('checkedAt')} />
            </label>
            <label>
              更新紀錄
              <textarea rows={3} value={f.updates || ''} onChange={set('updates')} placeholder="例：11/02 官網改截止日、收到 HR 來信" />
            </label>
          </div>
        </details>
        {err && <p className="hint over">{err}</p>}
        <p className="muted small">有截止日的會出現在週曆和月曆上。這裡只記錄，不會寄信或投遞。</p>
        <div className="row gap">
          <button className="btn primary" type="submit">
            儲存
          </button>
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove}>
              刪除
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
