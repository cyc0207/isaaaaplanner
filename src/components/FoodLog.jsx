import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today, addDays, shortLabel } from '../lib/date.js';
import { SLOTS } from '../lib/meals.js';
import { LOG_SLOTS, DAYS, slotNow, photoStreak, WHEEL_SOURCES, lastSpin, forgetSpin, wheelLabel, ateAt, differsFromPick, RATINGS, RATING_TAG, reviewKey, toReview, reviewUpdate } from '../lib/foodlog.js';
import { compressPhoto } from '../lib/photo.js';
import { money, Sheet } from './ui.jsx';

// 只抓最近 30 天的縮圖，大圖點開才讀
function useFoodLog(uid, from) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'foodLog'), where('date', '>=', from));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setItems([]));
  }, [uid, from]);
  return items;
}

export default function FoodLog() {
  const { uid } = useData();
  const t = today();
  const items = useFoodLog(uid, addDays(t, -(DAYS - 1)));
  const [draft, setDraft] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [err, setErr] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    try {
      const photo = await compressPhoto(file);
      const spin = lastSpin();
      setDraft({ ...photo, slot: slotNow(), note: spin?.name || '', amount: '', fromWheel: !!spin, wheelSource: spin?.source || null, wheelPick: spin?.name || '', placeId: spin?.placeId || null });
    } catch {
      setErr('這張照片讀不出來，換一張試試。');
    }
  };

  if (!items) return <p className="muted">載入中…</p>;
  const sorted = items.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const byDay = [];
  for (const it of sorted) {
    const g = byDay[byDay.length - 1];
    if (g && g.date === it.date) g.items.push(it);
    else byDay.push({ date: it.date, items: [it] });
  }
  const streak = photoStreak(items.map((i) => i.date), t);
  const todayCount = items.filter((i) => i.date === t).length;
  const wheelCount = items.filter((i) => i.fromWheel).length;

  return (
    <section className="section">
      <div className="card snap-head">
        <div>
          <div className="stat-line">
            <span className="snap-count">{streak}</span> 天連續打卡
          </div>
          <div className="muted small">今天拍了 {todayCount} 張</div>
          {items.length > 0 && <div className="muted small">轉盤打卡 {wheelCount}／{items.length} 次</div>}
        </div>
        <label className="btn primary big snap-btn">
          拍照或選照片
          <input type="file" accept="image/*" onChange={pick} hidden />
        </label>
      </div>
      {err && <p className="hint warn">{err}</p>}
      <ReviewQueue items={toReview(items)} />

      {!byDay.length && <p className="muted">還沒有打卡。吃之前拍一張，之後回頭看吃了什麼。</p>}
      {byDay.map((g) => (
        <div key={g.date} className="snap-day">
          <h3>{g.date === t ? '今天' : shortLabel(g.date)}</h3>
          <div className="snap-grid">
            {g.items.map((it) => (
              <button key={it.id} className="snap" onClick={() => setViewing(it)} aria-label={`${LOG_SLOTS[it.slot] || ''} ${it.note || ''}`}>
                <img src={it.thumb} alt="" />
                <span className="snap-tag">{LOG_SLOTS[it.slot] || '其他'}</span>
                {it.fromWheel && <span className="snap-wheel">轉盤</span>}
                {it.rating && <span className={`snap-rate rate-tag ${it.rating}`}>{RATING_TAG[it.rating]}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="muted small">只顯示最近 {DAYS} 天。照片縮小後存在你自己的帳號裡。</p>

      {draft && <SnapEditor draft={draft} setDraft={setDraft} onClose={() => setDraft(null)} />}
      {viewing && <SnapViewer item={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

function SnapEditor({ draft, setDraft, onClose }) {
  const { uid, api, defaultAccount, confirmClosed } = useData();
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    const day = today();
    const amount = Number(draft.amount);
    if (amount > 0 && !confirmClosed(day)) return;
    setSaving(true);
    const ops = [];
    let expenseId = null;
    if (amount > 0) {
      expenseId = doc(collection(db, 'users', uid, 'expenses')).id;
      ops.push({
        set: `expenses/${expenseId}`, merge: false,
        data: {
          date: day, amount: Math.round(amount), type: 'expense', category: SLOTS[draft.slot] || '其他', account: defaultAccount,
          toAccount: null, fixedItemId: null, note: draft.note.trim() || '拍照打卡', createdAtMs: Date.now(),
        },
      });
    }
    const id = doc(collection(db, 'users', uid, 'foodLog')).id;
    ops.push({ set: `foodPhotos/${id}`, merge: false, data: { data: draft.full } });
    ops.push({
      set: `foodLog/${id}`, merge: false,
      data: {
        date: day, slot: draft.slot, note: draft.note.trim(), thumb: draft.thumb, expenseId, createdAtMs: Date.now(),
        fromWheel: draft.fromWheel, wheelSource: draft.fromWheel ? draft.wheelSource : null, wheelPick: draft.fromWheel ? draft.wheelPick : '',
        placeId: draft.fromWheel ? draft.placeId || null : null,
      },
    });
    api.batch(ops);
    forgetSpin();
    onClose();
  };
  return (
    <Sheet title="食物打卡" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <img className="snap-preview" src={draft.full} alt="剛拍的照片" />
        <div className="seg four">
          {Object.entries(LOG_SLOTS).map(([k, l]) => (
            <button type="button" key={k} className={draft.slot === k ? 'on' : ''} onClick={() => setDraft({ ...draft, slot: k })}>
              {l}
            </button>
          ))}
        </div>
        <div className="snap-how">
          <span className="small strong">這餐怎麼決定的？</span>
          <div className="seg two">
            <button type="button" className={draft.fromWheel ? 'on' : ''} onClick={() => setDraft({ ...draft, fromWheel: true })}>
              轉盤轉的
            </button>
            <button type="button" className={!draft.fromWheel ? 'on' : ''} onClick={() => setDraft({ ...draft, fromWheel: false })}>
              自己選的
            </button>
          </div>
          {draft.fromWheel && draft.wheelSource && (
            <span className="muted small">剛剛{WHEEL_SOURCES[draft.wheelSource]}轉到「{draft.wheelPick}」</span>
          )}
        </div>
        <label>
          吃了什麼（可不填）
          <input
            value={draft.note}
            onChange={(e) => {
              const note = e.target.value;
              // 改寫成別家，就不算轉盤打卡
              const off = draft.fromWheel && differsFromPick(note, draft.wheelPick) && !differsFromPick(draft.note, draft.wheelPick);
              setDraft({ ...draft, note, fromWheel: off ? false : draft.fromWheel });
            }}
            placeholder="例：自助餐三菜一肉"
          />
          {draft.wheelPick && differsFromPick(draft.note, draft.wheelPick) && (
            <span className="muted small">你寫的不是轉盤轉到的「{draft.wheelPick}」，評分會記在「{draft.note.trim()}」。</span>
          )}
        </label>
        <label>
          順便記帳：金額（可不填）
          <input inputMode="numeric" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^\d]/g, '') })} placeholder="不填就只打卡" />
        </label>
        <button className="btn primary big" type="submit" disabled={saving}>
          打卡{Number(draft.amount) > 0 ? `，記 ${LOG_SLOTS[draft.slot]} ${money(Number(draft.amount))}` : ''}
        </button>
      </form>
    </Sheet>
  );
}

function SnapViewer({ item, onClose }) {
  const { uid, api } = useData();
  const [full, setFull] = useState(null);
  useEffect(() => {
    getDoc(doc(db, 'users', uid, 'foodPhotos', item.id))
      .then((d) => setFull(d.data()?.data || item.thumb))
      .catch(() => setFull(item.thumb));
  }, [uid, item.id, item.thumb]);
  const remove = () => {
    const extra = item.expenseId ? '（記帳那一筆不會刪，要刪請到記帳）' : '';
    if (!window.confirm(`刪除這張打卡？${extra}`)) return;
    api.batch([{ remove: `foodLog/${item.id}` }, { remove: `foodPhotos/${item.id}` }]);
    onClose();
  };
  return (
    <Sheet title={`${shortLabel(item.date)} ${LOG_SLOTS[item.slot] || ''}`} onClose={onClose}>
      <img className="snap-preview" src={full || item.thumb} alt={item.note || '食物照片'} />
      {item.note && <p className="strong">{item.note}</p>}
      <p className="muted small">
        {item.fromWheel ? `轉盤打卡（${wheelLabel(item)}）` : '自己選的'}
        <button className="link" onClick={() => { api.set(`foodLog/${item.id}`, { fromWheel: !item.fromWheel }); onClose(); }}>
          {item.fromWheel ? '改成自己選的' : '改成轉盤轉的'}
        </button>
      </p>
      <div className="review-row">
        <span className="small strong">複評</span>
        <RateButtons item={item} onDone={onClose} />
      </div>
      {item.expenseId && <p className="muted small">這次有一起記帳。</p>}
      <button className="btn danger" onClick={remove}>
        刪除
      </button>
    </Sheet>
  );
}

// 用打卡的資料寫評分：foodLog 記這次的評分，placeReviews 累計這家店
export function useRate() {
  const { api, placeReviews } = useData();
  return (item, rating) => {
    const { name, placeId } = ateAt(item);
    const key = reviewKey({ placeId, name });
    const ops = [{ set: `foodLog/${item.id}`, data: { rating, reviewSkipped: false } }];
    if (key) ops.push({ set: `placeReviews/${key}`, merge: false, data: reviewUpdate(placeReviews[key], { name, placeId, rating }) });
    api.batch(ops);
  };
}

function RateButtons({ item, onDone }) {
  const rate = useRate();
  return (
    <div className="rate-btns">
      {RATINGS.map(([k, label]) => (
        <button key={k} type="button" className={`btn small rate-${k} ${item.rating === k ? 'on' : ''}`} onClick={() => { rate(item, k); onDone?.(); }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// 打卡頁上方：還沒評的那幾餐
function ReviewQueue({ items }) {
  const { api } = useData();
  if (!items.length) return null;
  return (
    <div className="card review-queue">
      <h3>複評：上次吃的怎麼樣？</h3>
      <p className="muted small">評過的店會記住：負評的不再上附近轉盤，好吃的格子大一倍。</p>
      <ul className="list">
        {items.map((it) => (
          <li key={it.id} className="review-item">
            <img src={it.thumb} alt="" />
            <div className="review-body">
              <strong>{ateAt(it).name}</strong>
              <span className="muted small">{shortLabel(it.date)} {LOG_SLOTS[it.slot] || ''}{it.fromWheel ? '・轉盤' : ''}</span>
              <RateButtons item={it} />
              <button className="link small" onClick={() => api.set(`foodLog/${it.id}`, { reviewSkipped: true })}>
                這餐不評
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
