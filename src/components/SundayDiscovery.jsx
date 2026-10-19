import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today, weekday } from '../lib/date.js';
import { logError } from '../lib/errlog.js';
import { LEVELS, habitEntry, mergeItems, nextAlternative, parseDiscoveryJSON, pickFor, sundayOf, swapOps } from '../lib/discovery.js';

// 只在英文「今天」頁讀，不放進全域訂閱
function useDiscovery(uid) {
  const [docs, setDocs] = useState(null);
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'users', uid, 'discovery'),
        (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => {
          logError('讀取週日聽力', e, { show: false });
          setDocs([]);
        },
      ),
    [uid],
  );
  return docs;
}

const md = (d) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8))}` : '');

// Sunday English Discovery：週日顯示一個選好的影片；其他天收起來，可以看清單、貼新的
export default function SundayDiscovery() {
  const { uid, api, englishLog } = useData();
  const docs = useDiscovery(uid);
  const t = today();
  const isSunday = weekday(t) === 0;
  const sunday = sundayOf(t);
  if (!docs) return null;
  const items = mergeItems(docs);
  const pick = pickFor(items, sunday);
  const save = (id, data) => api.set(`discovery/${id}`, data);

  if (!isSunday) {
    return (
      <details className="section discovery">
        <summary className="strong">
          Sunday English Discovery
          <span className="muted small">（{pick ? `${md(sunday)}：${pick.title}` : `${md(sunday)} 還沒有教材`}）</span>
        </summary>
        <Pool items={items} save={save} />
      </details>
    );
  }

  const swap = () => {
    const alt = nextAlternative(items, pick, sunday);
    if (!alt) return;
    api.batch(swapOps(pick, alt, sunday).map((o) => ({ set: `discovery/${o.id}`, data: o.data })));
  };
  const finish = (data) => {
    save(pick.id, { ...data, status: 'done', doneOn: t, date: sunday });
    api.set(`englishLog/${t}`, habitEntry(englishLog[t], pick));
  };

  return (
    <section className="section discovery">
      <h2>Sunday English Discovery</h2>
      {pick ? (
        <PickCard
          key={pick.id} item={pick} canSwap={!!nextAlternative(items, pick, sunday)} onSwap={swap} onFinish={finish}
          habitDone={!!englishLog[t]}
        />
      ) : (
        <p className="hint warn">這週日還沒有選好的教材。下面可以貼新的清單 JSON 進來，App 不會自己找或編連結。</p>
      )}
      <details>
        <summary className="muted small">全部教材、貼新的清單</summary>
        <Pool items={items} save={save} />
      </details>
    </section>
  );
}

function PickCard({ item, canSwap, onSwap, onFinish, habitDone }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ note: item.note || '', myLevel: item.myLevel || '', fun: item.fun || 0 });
  const done = item.status === 'done';
  const transcript = item.transcriptUrl || (item.transcriptOnPage ? item.url : '');
  return (
    <div className="card disc-card">
      <div className="type-chips">
        {[item.source, item.topic, item.level, item.minutes && `約 ${item.minutes} 分鐘`].filter(Boolean).map((x) => (
          <span key={x} className="chip">{x}</span>
        ))}
        {done && <span className="chip ok">完成了</span>}
      </div>
      <p className="disc-title">{item.title}</p>
      {item.speaker && <p className="muted small">{item.speaker}</p>}
      {item.segment && <p className="small"><span className="word-tag">只聽這段</span>{item.segment}</p>}
      <div className="row gap wrap disc-btns">
        <a className="btn primary" href={item.url} target="_blank" rel="noopener noreferrer">開始聽</a>
        {transcript ? (
          <a className="btn" href={transcript} target="_blank" rel="noopener noreferrer">看逐字稿</a>
        ) : (
          <button className="btn" disabled>沒有逐字稿</button>
        )}
        <button className="btn" onClick={() => setOpen(!open)}>{done ? '改心得' : '完成練習'}</button>
        {!done && (
          <button className="btn" disabled={!canSwap} onClick={onSwap}>{canSwap ? '換一個' : '沒有別的可換'}</button>
        )}
      </div>
      {transcript && !item.transcriptUrl && <p className="muted small">逐字稿在官方頁面上，點影片下方的 Transcript。建議先不看字幕聽一次，再開逐字稿聽第二次。</p>}
      {open && (
        <form
          className="disc-form"
          onSubmit={(e) => {
            e.preventDefault();
            onFinish({ note: f.note.trim(), myLevel: f.myLevel, fun: f.fun });
            setOpen(false);
          }}
        >
          <label>
            我的英文心得（2～3 句就好）
            <textarea className="paste" rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="The talk says that…" />
          </label>
          <div className="row gap wrap">
            <span className="small">我覺得難度</span>
            {LEVELS.map((l) => (
              <button type="button" key={l} className={`btn small ${f.myLevel === l ? 'primary' : ''}`} onClick={() => setF({ ...f, myLevel: l })}>{l}</button>
            ))}
          </div>
          <div className="row gap wrap">
            <span className="small">有趣程度</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} className={`btn small ${f.fun === n ? 'primary' : ''}`} onClick={() => setF({ ...f, fun: n })}>{n}</button>
            ))}
          </div>
          <button className="btn primary">存起來</button>
        </form>
      )}
      {done && !open && (
        <>
          {item.note && <p className="flash-example">{item.note}</p>}
          <p className="muted small">
            {[item.myLevel && `難度：${item.myLevel}`, item.fun && `有趣：${item.fun}/5`].filter(Boolean).join('・')}
            {habitDone ? '　首頁的英文已經打勾。' : ''}
          </p>
        </>
      )}
    </div>
  );
}

const EXAMPLE = `[
  {
    "date": "2026-11-15",
    "title": "影片標題",
    "speaker": "講者",
    "source": "TED / YouTube / Podcast",
    "url": "官方連結（必填）",
    "topic": "主題",
    "level": "入門",
    "minutes": 5,
    "segment": "可選，例如 0:00–4:30",
    "transcriptUrl": "可選，英文逐字稿連結"
  }
]`;

// 全部教材＋貼 JSON 加新的
function Pool({ items, save }) {
  const { api } = useData();
  const t = today();
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState('');
  const upcoming = items.filter((x) => x.status !== 'done' && (!x.date || x.date >= sundayOf(t)));

  const doImport = () => {
    const rows = preview.rows.filter((r) => r.status === 'ok');
    api.batch(rows.map((r) => ({ add: 'discovery', data: { ...r.item, custom: true, status: '' } })));
    setMsg(rows.length ? `加了 ${rows.length} 筆教材。` : '沒有可以加的。');
    setPreview(null);
    setRaw('');
  };

  return (
    <div className="disc-pool">
      {upcoming.length < 2 && <p className="hint warn">還沒聽的教材只剩 {upcoming.length} 筆，記得補新的清單。</p>}
      <ul className="list">
        {items.map((x) => (
          <li key={x.id} className="row between gap">
            <span className="grow small">
              <span className="num">{md(x.date) || '未排'}</span> {x.title}
              {x.speaker && <span className="muted">（{x.speaker}）</span>}
            </span>
            {x.status === 'done' ? <span className="chip ok">完成</span> : x.custom && (
              <button className="btn small" onClick={() => window.confirm(`移除「${x.title}」？`) && save(x.id, { removed: true })}>移除</button>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">新的清單貼在下面（JSON）。只會用你貼的連結，日期要是星期日，沒寫日期的會排在教材不夠時補上。</p>
      <details>
        <summary className="muted small">格式範例</summary>
        <pre className="disc-example">{EXAMPLE}</pre>
      </details>
      <textarea className="paste" rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder='[{"title": "...", "url": "https://..."}]' />
      <button className="btn small" disabled={!raw.trim()} onClick={() => { setMsg(''); setPreview(parseDiscoveryJSON(raw, items)); }}>檢查</button>
      {preview?.error && <p className="hint over">{preview.error}</p>}
      {preview?.rows && (
        <>
          <ul className="list">
            {preview.rows.map((r, i) => (
              <li key={i} className="small">
                <strong>{r.item.title || '（沒有標題）'}</strong> {md(r.item.date)}
                <span className="muted">
                  {r.status === 'ok' ? '　可以加' : r.status === 'duplicate' ? '　已經有這個連結' : r.status === 'taken' ? '　這個週日已經排了別的' : `　${r.errors.join('；')}`}
                </span>
              </li>
            ))}
          </ul>
          <button className="btn small primary" disabled={!preview.rows.some((r) => r.status === 'ok')} onClick={doImport}>
            加入 {preview.rows.filter((r) => r.status === 'ok').length} 筆
          </button>
        </>
      )}
      {msg && <p className="hint ok">{msg}</p>}
    </div>
  );
}
