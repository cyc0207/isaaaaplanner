import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today, addDays, shortLabel } from '../lib/date.js';
import { photoStreak, DAYS } from '../lib/foodlog.js';
import { compressPhoto } from '../lib/photo.js';
import { Sheet } from './ui.jsx';
import WeekRecap from './WeekRecap.jsx';

// 每日穿搭：一天一張，文件 id 就是日期，重拍會蓋掉
export function useOotdLog(from) {
  const { uid } = useData();
  const [items, setItems] = useState(null);
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'ootdLog'), where('date', '>=', from));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setItems([]));
  }, [uid, from]);
  return items;
}

function usePickPhoto(onPhoto) {
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    try {
      onPhoto(await compressPhoto(file));
    } catch {
      setErr('這張照片讀不出來，換一張試試。');
    }
  };
  return { pick, err };
}

export default function OotdLog() {
  const t = today();
  const items = useOotdLog(addDays(t, -(DAYS - 1)));
  const [draft, setDraft] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [recap, setRecap] = useState(false);
  const { pick, err } = usePickPhoto((photo) => setDraft({ ...photo, note: todayItem?.note || '' }));
  if (!items) return <p className="muted">載入中…</p>;
  const todayItem = items.find((i) => i.date === t);
  const sorted = items.slice().sort((a, b) => b.date.localeCompare(a.date));
  const streak = photoStreak(items.map((i) => i.date), t);

  return (
    <section className="section">
      <div className="card snap-head">
        <div>
          <div className="stat-line">
            <span className="snap-count">{streak}</span> 天連續 OOTD
          </div>
          <div className="muted small">{todayItem ? '今天拍好了' : '今天還沒拍'}</div>
        </div>
        <label className="btn primary big snap-btn">
          {todayItem ? '重拍今天' : '拍今天的穿搭'}
          <input type="file" accept="image/*" onChange={pick} hidden />
        </label>
      </div>
      {err && <p className="hint warn">{err}</p>}
      {items.length > 0 && (
        <button className="btn wide recap-btn" onClick={() => setRecap(true)}>
          一週穿什麼：做成 IG 圖
        </button>
      )}
      {!sorted.length && <p className="muted">還沒有穿搭照。出門前對著鏡子拍一張，一週後就能排成一張圖。</p>}
      <div className="ootd-grid">
        {sorted.map((it) => (
          <button key={it.id} className="ootd" onClick={() => setViewing(it)} aria-label={`${shortLabel(it.date)} 穿搭 ${it.note || ''}`}>
            <img src={it.thumb} alt="" />
            <span className="snap-tag">{it.date === t ? '今天' : shortLabel(it.date)}</span>
          </button>
        ))}
      </div>
      <p className="muted small">只顯示最近 {DAYS} 天。一天一張，重拍會換掉當天那張。</p>

      {draft && <OotdEditor draft={draft} setDraft={setDraft} replacing={!!todayItem} onClose={() => setDraft(null)} />}
      {recap && <WeekRecap kind="ootd" items={items} onClose={() => setRecap(false)} />}
      {viewing && <OotdViewer item={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

function OotdEditor({ draft, setDraft, replacing, onClose }) {
  const { api } = useData();
  const save = (e) => {
    e.preventDefault();
    const day = today();
    api.batch([
      { set: `ootdPhotos/${day}`, merge: false, data: { data: draft.full } },
      { set: `ootdLog/${day}`, merge: false, data: { date: day, note: draft.note.trim(), thumb: draft.thumb, createdAtMs: Date.now() } },
    ]);
    onClose();
  };
  return (
    <Sheet title="今天的 OOTD" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <img className="ootd-preview" src={draft.full} alt="穿搭照片預覽" />
        <label>
          穿了什麼（可不填）
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="例：古著襯衫＋牛仔褲" />
        </label>
        {replacing && <p className="hint warn">今天已經拍過一張，儲存會換成這張。</p>}
        <button className="btn primary big" type="submit">儲存</button>
      </form>
    </Sheet>
  );
}

function OotdViewer({ item, onClose }) {
  const { uid, api } = useData();
  const [full, setFull] = useState(null);
  const [note, setNote] = useState(item.note || '');
  useEffect(() => {
    getDoc(doc(db, 'users', uid, 'ootdPhotos', item.id)).then((d) => setFull(d.data()?.data || item.thumb)).catch(() => setFull(item.thumb));
  }, [uid, item]);
  const remove = () => {
    if (!window.confirm('刪除這天的穿搭照？')) return;
    api.batch([{ remove: `ootdLog/${item.id}` }, { remove: `ootdPhotos/${item.id}` }]);
    onClose();
  };
  return (
    <Sheet title={`${shortLabel(item.date)} 的 OOTD`} onClose={onClose}>
      <img className="ootd-preview" src={full || item.thumb} alt="穿搭照片" />
      <form className="add-task compact" onSubmit={(e) => { e.preventDefault(); api.update(`ootdLog/${item.id}`, { note: note.trim() }); onClose(); }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="穿了什麼" aria-label="穿了什麼" />
        <button className="btn" type="submit">存</button>
      </form>
      <button className="btn danger wide" onClick={remove}>刪除</button>
    </Sheet>
  );
}

// 首頁用：今天的穿搭
export function OotdTodayCard() {
  const t = today();
  const items = useOotdLog(addDays(t, -(DAYS - 1)));
  if (!items) return null;
  const todayItem = items.find((i) => i.date === t);
  const streak = photoStreak(items.map((i) => i.date), t);
  return (
    <Link to="/food?tab=snap&what=ootd" className="reminder ootd-home">
      {todayItem ? <img src={todayItem.thumb} alt="今天的穿搭" /> : <span className="ootd-empty">OOTD</span>}
      <span className="grow">
        <strong>{todayItem ? '今天的 OOTD 拍好了' : '今天的 OOTD 還沒拍'}</strong>
        <span className="muted small">{streak > 0 ? `連續 ${streak} 天` : '出門前拍一張'}</span>
      </span>
      <span>→</span>
    </Link>
  );
}
