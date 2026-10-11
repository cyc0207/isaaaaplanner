import { useMemo, useState } from 'react';
import { useData } from '../data.jsx';
import { today } from '../lib/date.js';
import {
  TYPES, GPT_PROMPT, buildEnglishPreview, dueItems, practicable, review, newItem, splitTags, toEnglishCSV,
} from '../lib/english.js';
import { gmailLink } from '../lib/gmail.js';
import { auth } from '../firebase.js';
import { Sheet } from '../components/ui.jsx';
import { useGmailSync, SyncButton, QueryEditor } from '../components/Gmail.jsx';

const TABS = [
  ['practice', '練習'],
  ['library', '卡片'],
  ['letters', '英文信'],
  ['import', '匯入'],
];

export default function EnglishPage() {
  const [tab, setTab] = useState('practice');
  const [editing, setEditing] = useState(null);
  return (
    <div className="page">
      <header className="page-head">
        <h1>英文</h1>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'practice' && <Practice goImport={() => setTab('import')} />}
      {tab === 'library' && <Library onEdit={setEditing} />}
      {tab === 'letters' && <Letters onAdd={setEditing} />}
      {tab === 'import' && <Import />}
      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ---- 練習：翻卡片，記得就隔久一點再出現 ----
function Practice({ goImport }) {
  const { englishItems, englishLog, api } = useData();
  const t = today();
  const [dir, setDir] = useState('en');
  const [extra, setExtra] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [doneIds, setDoneIds] = useState([]);
  const due = useMemo(() => dueItems(englishItems, t), [englishItems, t]);
  const queue = (extra || due).filter((it) => !doneIds.includes(it.id));
  const card = queue[0];

  const answer = (ok) => {
    if (!extra) api.update(`englishItems/${card.id}`, review(card, ok, t));
    const done = [...doneIds, card.id];
    setDoneIds(done);
    setFlipped(false);
    // 練滿 10 張，首頁的「英文」習慣自動打勾
    if (done.length >= 10 && !englishLog[t]) api.set(`englishLog/${t}`, { minutes: 15, note: `網站練習 ${done.length} 張` });
  };

  const more = () => {
    const pool = englishItems.filter(practicable);
    const pick = pool.sort(() => Math.random() - 0.5).slice(0, 10);
    setDoneIds([]);
    setExtra(pick);
  };

  if (!englishItems.length) {
    return (
      <div className="card empty-eng">
        <p>還沒有任何卡片。</p>
        <p className="muted small">先把 ChatGPT 整理的英文資源匯進來，或在「卡片」自己加。</p>
        <button className="btn primary" onClick={goImport}>
          去匯入
        </button>
      </div>
    );
  }

  return (
    <div className="practice">
      <div className="row between">
        <span className="muted small">
          {extra ? '加練（不影響複習排程）' : `今天要複習 ${due.length} 張`}・已練 <span className="num">{doneIds.length}</span> 張
        </span>
        <div className="seg two-mini">
          <button className={dir === 'en' ? 'on' : ''} onClick={() => setDir('en')}>
            看英文
          </button>
          <button className={dir === 'zh' ? 'on' : ''} onClick={() => setDir('zh')}>
            看中文
          </button>
        </div>
      </div>

      {card ? (
        <div className={`flash ${flipped ? 'flipped' : ''}`} onClick={() => !flipped && setFlipped(true)}>
          <div className="flash-meta">
            <span className="chip">{TYPES[card.type]}</span>
            {(card.tags || []).slice(0, 3).map((x) => (
              <span key={x} className="chip">
                {x}
              </span>
            ))}
          </div>
          {card.type === 'fix' && <p className="muted small">這句哪裡錯？</p>}
          <p className="flash-front">{dir === 'en' || card.type === 'fix' || !card.back ? card.front : card.back}</p>
          {flipped ? (
            <div className="flash-back">
              <p className="flash-answer">{dir === 'en' || card.type === 'fix' || !card.back ? card.back || '（沒有寫意思）' : card.front}</p>
              {card.example && <p className="flash-example">{card.example}</p>}
              {card.note && <p className="muted small">{card.note}</p>}
              <div className="row gap flash-btns">
                <button className="btn grow" onClick={(e) => {
                    e.stopPropagation();
                    answer(false);
                  }}>
                  忘了
                </button>
                <button className="btn primary grow" onClick={(e) => {
                    e.stopPropagation();
                    answer(true);
                  }}>
                  記得
                </button>
              </div>
            </div>
          ) : (
            <p className="muted small flash-tap">點一下看答案</p>
          )}
        </div>
      ) : (
        <div className="card empty-eng">
          <p className="strong">{doneIds.length ? `練完了，共 ${doneIds.length} 張。` : '今天沒有要複習的。'}</p>
          {englishLog[t] && <p className="muted small">首頁的英文已經打勾。</p>}
          <button className="btn" onClick={more}>
            隨機加練 10 張
          </button>
        </div>
      )}
      <p className="muted small">記得的卡片會隔 1、3、7、14、30、60 天再出現；忘了就明天再來。</p>
    </div>
  );
}

// ---- 卡片庫：搜尋、篩選、編輯 ----
function Library({ onEdit }) {
  const { englishItems } = useData();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const s = q.trim().toLowerCase();
  const shown = englishItems
    .filter((it) => (!type || it.type === type) && (!s || [it.front, it.back, it.example, ...(it.tags || [])].some((x) => (x || '').toLowerCase().includes(s))))
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const counts = englishItems.reduce((c, it) => ({ ...c, [it.type]: (c[it.type] || 0) + 1 }), {});

  return (
    <div>
      <div className="row gap">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋英文、中文或主題" />
        <button className="btn primary" onClick={() => onEdit({ type: type || 'word' })}>
          新增
        </button>
      </div>
      <div className="type-chips">
        <button className={`chip-btn ${!type ? 'on' : ''}`} onClick={() => setType('')}>
          全部 {englishItems.length}
        </button>
        {Object.entries(TYPES).map(([k, l]) =>
          counts[k] ? (
            <button key={k} className={`chip-btn ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>
              {l} {counts[k]}
            </button>
          ) : null,
        )}
      </div>
      {!shown.length && <p className="muted">{englishItems.length ? '找不到。' : '還沒有卡片。'}</p>}
      <ul className="list">
        {shown.map((it) => (
          <li key={it.id} className="task eng-row" onClick={() => onEdit(it)}>
            <div className="task-body">
              <div className="task-title">
                <span className="eng-front">{it.front}</span>
                {it.back && (
                  <span className="muted">
                    ・
                    {it.type === 'link' && /^https?:\/\//.test(it.back) ? (
                      <a href={it.back} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        打開
                      </a>
                    ) : (
                      it.back
                    )}
                  </span>
                )}
              </div>
              <div className="task-meta">
                <span className="chip">{TYPES[it.type]}</span>
                {(it.tags || []).map((x) => (
                  <span key={x}>#{x}</span>
                ))}
                {practicable(it) && it.reps > 0 && <span>練過 {it.reps} 次</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemEditor({ item, onClose }) {
  const { api } = useData();
  const [f, setF] = useState({ ...newItem(item, today()), ...item, tagsText: (item.tags || []).join('|') });
  const isNew = !item.id;
  const save = (e) => {
    e.preventDefault();
    if (!f.front.trim()) return;
    const data = {
      type: f.type, front: f.front.trim(), back: f.back.trim(), example: f.example.trim(),
      tags: splitTags(f.tagsText), source: f.source, note: f.note.trim(),
    };
    if (isNew) api.add('englishItems', newItem(data, today()));
    else api.update(`englishItems/${item.id}`, data);
    onClose();
  };
  const labels = f.type === 'fix' ? ['寫錯的句子', '正確的句子'] : f.type === 'link' ? ['資源名稱', '網址'] : ['英文', '中文意思'];
  return (
    <Sheet title={isNew ? '新增卡片' : '編輯卡片'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          種類
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {Object.entries(TYPES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          {labels[0]}
          <textarea rows={2} value={f.front} onChange={(e) => setF({ ...f, front: e.target.value })} autoFocus={isNew && !f.front} />
        </label>
        <label>
          {labels[1]}
          <textarea rows={2} value={f.back} onChange={(e) => setF({ ...f, back: e.target.value })} />
        </label>
        {f.type !== 'link' && (
          <label>
            例句
            <textarea rows={2} value={f.example} onChange={(e) => setF({ ...f, example: e.target.value })} />
          </label>
        )}
        <label>
          主題（用 | 分開）
          <input value={f.tagsText} onChange={(e) => setF({ ...f, tagsText: e.target.value })} placeholder="email|比賽" />
        </label>
        <label>
          備註
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
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
                if (window.confirm(`刪除「${item.front}」？`)) {
                  api.remove(`englishItems/${item.id}`);
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

// ---- 英文信：從 Gmail 收進來，讀的時候把不會的字選起來加成卡片 ----
function Letters({ onAdd }) {
  const { mail, api } = useData();
  const g = useGmailSync();
  const [open, setOpen] = useState(null);
  const letters = mail.filter((m) => m.box === 'english');
  const email = auth.currentUser?.email;

  const addSelection = () => {
    const sel = (window.getSelection?.().toString() || '').trim();
    if (!sel) {
      window.alert('先在信裡用手指長按或滑鼠選起不會的字句，再按這個按鈕。');
      return;
    }
    const body = open.body || '';
    const at = body.indexOf(sel);
    // 例句：選取文字所在的那一句
    let example = '';
    if (at >= 0) {
      const start = Math.max(body.lastIndexOf('.', at), body.lastIndexOf('\n', at)) + 1;
      const ends = ['.', '!', '?', '\n'].map((c) => body.indexOf(c, at + sel.length)).filter((i) => i >= 0);
      const end = ends.length ? Math.min(...ends) + 1 : body.length;
      example = body.slice(start, end).trim().slice(0, 300);
    }
    onAdd({ type: sel.includes(' ') ? 'phrase' : 'word', front: sel, example: example === sel ? '' : example, source: 'gmail', note: open.subject, tags: ['英文信'] });
  };

  return (
    <div>
      <div className="card">
        <SyncButton g={g} />
        {!g.queries.english && <p className="hint warn">還沒設定固定英文信的寄件人，在下面「只收哪些信」填 from:寄件人信箱。</p>}
        <QueryEditor queries={g.queries} />
      </div>
      {!letters.length && <p className="muted">還沒有英文信。</p>}
      <ul className="list letters">
        {letters.map((m) => (
          <li
            key={m.id}
            className={`task mail-row ${m.status === 'new' ? 'unread' : ''}`}
            onClick={() => {
              setOpen(m);
              if (m.status === 'new') api.update(`mail/${m.id}`, { status: 'read' });
            }}
          >
            <div className="task-body">
              <div className="task-title">{m.subject}</div>
              <div className="task-meta">
                <span>{m.from}</span>
                <span>{m.date}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {open && (
        <Sheet title={open.subject} onClose={() => setOpen(null)}>
          <div className="task-meta">
            <span>{open.from}</span>
            <span>{open.date}</span>
            <a href={gmailLink(open, email)} target="_blank" rel="noreferrer">
              在 Gmail 打開
            </a>
          </div>
          <div className="letter-body" lang="en">
            {open.body || open.snippet}
          </div>
          <div className="letter-actions">
            <button className="btn primary" onMouseDown={(e) => e.preventDefault()} onClick={addSelection}>
              把選起來的字加成卡片
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ---- 匯入：貼上 ChatGPT 給的 CSV ----
const STATUS_LABEL = { ok: '新的', duplicate: '重複', error: '有錯' };

function Import() {
  const { englishItems, api } = useData();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(GPT_PROMPT);
      setCopied(true);
    } catch {
      window.prompt('複製下面這段', GPT_PROMPT);
    }
  };

  const check = (raw) => {
    setResult('');
    setPreview(buildEnglishPreview(raw, englishItems));
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
    setPreview({ ...preview, rows: preview.rows.map((r, j) => (j === i && r.status !== 'error' ? { ...r, selected: !r.selected } : r)) });

  const confirm = () => {
    const t = today();
    const rows = preview.rows.filter((r) => r.selected && r.status !== 'error');
    const ops = rows.map((r) => ({ add: 'englishItems', data: newItem(r, t) }));
    for (let i = 0; i < ops.length; i += 400) api.batch(ops.slice(i, i + 400));
    const skipped = preview.rows.length - rows.length;
    setResult(`已匯入 ${rows.length} 張卡片${skipped ? `，略過 ${skipped} 筆` : ''}。`);
    setPreview(null);
    setText('');
  };

  const exportCSV = () => {
    const blob = new Blob([toEnglishCSV(englishItems)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `english_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const counts = preview?.rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}) || {};
  const selectedCount = preview?.rows.filter((r) => r.selected).length || 0;

  return (
    <div>
      <section className="section">
        <h2>1. 請 ChatGPT 整理</h2>
        <p className="muted small">複製這段貼給 ChatGPT，它會把記得的英文資源整理成 CSV。</p>
        <button className="btn" onClick={copyPrompt}>
          {copied ? '已複製' : '複製 prompt'}
        </button>
      </section>
      <section className="section">
        <h2>2. 貼上結果</h2>
        <textarea className="paste" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'type,front,back,example,tags,source,note\nword,deadline,截止日期,The deadline is Friday.,比賽,chat,'} />
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
                    <th>種類</th>
                    <th>英文</th>
                    <th>中文</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className={`st-${r.status}`}>
                      <td>
                        <input type="checkbox" checked={r.selected} disabled={r.status === 'error'} onChange={() => toggle(i)} />
                      </td>
                      <td>{r.status === 'error' ? r.errors.join('；') : STATUS_LABEL[r.status]}</td>
                      <td>{TYPES[r.type] || r.rawType}</td>
                      <td>{r.front}</td>
                      <td>{r.back}</td>
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
      <section className="section">
        <h2>備份</h2>
        <p className="muted small">把所有卡片匯出成同樣格式的 CSV。</p>
        <button className="btn" onClick={exportCSV} disabled={!englishItems.length}>
          匯出 {englishItems.length} 張卡片
        </button>
      </section>
    </div>
  );
}
