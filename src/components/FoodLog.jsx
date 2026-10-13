import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today, addDays, shortLabel } from '../lib/date.js';
import { Link } from 'react-router-dom';
import { SUGARS, SIZES } from '../lib/meals.js';
import { DEFAULT_EXPENSE_CATEGORIES, DRINK } from '../lib/budget.js';
import {
  LOG_SLOTS, DRINK_SLOT, slotCategory, weekSlotCounts, DAYS, slotNow, photoStreak, WHEEL_SOURCES, lastSpin, forgetSpin, wheelLabel, ateAt, differsFromPick,
  RATINGS, RATING_TAG, reviewKey, toReview, reviewUpdate, slotsOf, hasSlot, slotLabel, slotFields, toggleSlot, todayChoice, forgetChoice, startHow, HOWS, howOf,
  nameFromMapsUrl, isUrl, favByUrl, favoritesOf,
} from '../lib/foodlog.js';
import { compressPhoto } from '../lib/photo.js';
import { money, Sheet } from './ui.jsx';
import WeekRecap from './WeekRecap.jsx';

// 只抓最近 30 天的縮圖，大圖點開才讀
export function useFoodLog(uid, from) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'foodLog'), where('date', '>=', from));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setItems([]));
  }, [uid, from]);
  return items;
}

export default function FoodLog() {
  const { uid, budget } = useData();
  const t = today();
  const [only, setOnly] = useState(null);
  const items = useFoodLog(uid, addDays(t, -(DAYS - 1)));
  const [draft, setDraft] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [err, setErr] = useState('');
  const [recap, setRecap] = useState(false);
  const [choice, setChoice] = useState(() => todayChoice());

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    try {
      const photo = await compressPhoto(file);
      const spin = lastSpin();
      const pickNow = todayChoice();
      const first = pickNow?.kind === 'drink' && !(spin && spin.at > pickNow.at) ? DRINK_SLOT : slotNow(new Date(), spin);
      setDraft({ ...photo, slots: [first], sugar: '', size: '中', amount: '', ...startHow(spin, pickNow) });
    } catch {
      setErr('這張照片讀不出來，換一張試試。');
    }
  };

  if (!items) return <p className="muted">載入中…</p>;
  const counts = weekSlotCounts(items, t);
  const drinkCat = (budget?.categories || []).find((c) => c.name === DRINK);
  const drinkLimit = Number(drinkCat?.perWeekCount) || 0;
  const sorted = items.filter((i) => !only || hasSlot(i, only)).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs || 0) - (a.createdAtMs || 0));
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
      {choice && (
        <p className="hint choice-hint">
          今天選了「{choice.name}」，拍照打卡會直接帶進去。
          <button className="link" onClick={() => { forgetChoice(); setChoice(null); }}>不吃了</button>
        </p>
      )}
      {err && <p className="hint warn">{err}</p>}
      {items.length > 0 && (
        <button className="btn wide recap-btn" onClick={() => setRecap(true)}>
          一週吃什麼：做成 IG 圖
        </button>
      )}
      {items.length > 0 && (
        <div className="snap-filter">
          <span className="small strong">這週打卡</span>
          <div className="snap-stats">
            {Object.entries(LOG_SLOTS).map(([k, l]) => {
              const n = counts[k];
              const isDrink = k === DRINK_SLOT;
              if (!n && !isDrink) return null;
              const over = isDrink && drinkLimit > 0 && n >= drinkLimit;
              return (
                <button key={k} type="button" className={`snap-stat ${isDrink ? 'drink' : ''} ${over ? 'over' : ''}`}
                  aria-pressed={only === k} onClick={() => setOnly(only === k ? null : k)}>
                  {l} {n}{isDrink && drinkLimit ? `／${drinkLimit}` : ''} {isDrink ? '杯' : '次'}{only === k ? '（只看這類）' : ''}
                </button>
              );
            })}
          </div>
          {drinkLimit > 0 && counts[DRINK_SLOT] >= drinkLimit && (
            <p className="hint warn">這週飲料已經 {counts[DRINK_SLOT]} 杯，到了設定的每週 {drinkLimit} 杯。<Link to="/food?tab=drink">轉轉看今天要不要喝</Link></p>
          )}
        </div>
      )}
      <ReviewQueue items={toReview(items)} />

      {only && !byDay.length && <p className="muted">最近 {DAYS} 天沒有{LOG_SLOTS[only]}的打卡。</p>}
      {!only && !byDay.length && <p className="muted">還沒有打卡。吃之前拍一張，之後回頭看吃了什麼。</p>}
      {byDay.map((g) => (
        <div key={g.date} className="snap-day">
          <h3>{g.date === t ? '今天' : shortLabel(g.date)}</h3>
          <div className="snap-grid">
            {g.items.map((it) => (
              <button key={it.id} className="snap" onClick={() => setViewing(it)} aria-label={`${slotLabel(it)} ${it.note || ''}`}>
                <img src={it.thumb} alt="" />
                <span className="snap-tag">{slotLabel(it) || '其他'}</span>
                {it.fromWheel && <span className="snap-wheel">轉盤</span>}
                {howOf(it) === 'today' && <span className="snap-wheel">今天選</span>}
                {it.rating && <span className={`snap-rate rate-tag ${it.rating}`}>{RATING_TAG[it.rating]}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="muted small">只顯示最近 {DAYS} 天。照片縮小後存在你自己的帳號裡。</p>

      {draft && <SnapEditor draft={draft} setDraft={setDraft} onClose={() => setDraft(null)} onSaved={() => setChoice(null)} />}
      {recap && <WeekRecap items={items} onClose={() => setRecap(false)} />}
      {viewing && <SnapViewer item={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

function SnapEditor({ draft, setDraft, onClose, onSaved }) {
  const { uid, api, defaultAccount, confirmClosed, budget, placeReviews } = useData();
  const [saving, setSaving] = useState(false);
  const isDrink = draft.slots.includes(DRINK_SLOT);
  // 記帳只記一筆：記在主要那類（晚餐＋飲料就記晚餐）
  const { slot: main } = slotFields(draft.slots);
  const category = slotCategory(main, budget.expenseCategories || DEFAULT_EXPENSE_CATEGORIES);
  const favs = [...favoritesOf(placeReviews || {}, 'food'), ...favoritesOf(placeReviews || {}, 'drink')];
  const setHow = (how) => {
    if (how === 'wheel') setDraft({ ...draft, how, fromWheel: true });
    else setDraft({ ...draft, how, fromWheel: false });
  };
  // 貼網址：收藏裡有的就用收藏的店名，Google 地圖網址就從網址抓店名
  const pasteUrl = (url) => {
    const fav = favByUrl(favs, url);
    const name = fav?.name || nameFromMapsUrl(url);
    const keepNote = draft.note.trim() && draft.note.trim() !== draft.wheelPick;
    setDraft({ ...draft, url, wheelPick: name, placeId: fav?.id && fav.id !== fav.key ? fav.id : null, note: keepNote ? draft.note : name });
  };
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
          date: day, amount: Math.round(amount), type: 'expense', category, account: defaultAccount,
          toAccount: null, fixedItemId: null, note: draft.note.trim() || '拍照打卡', createdAtMs: Date.now(),
          ...(isDrink && category === DRINK ? { drink: { size: draft.size, sugar: draft.sugar || '未選' } } : {}),
        },
      });
    }
    const id = doc(collection(db, 'users', uid, 'foodLog')).id;
    ops.push({ set: `foodPhotos/${id}`, merge: false, data: { data: draft.full } });
    ops.push({
      set: `foodLog/${id}`, merge: false,
      data: {
        date: day, ...slotFields(draft.slots), note: draft.note.trim(), thumb: draft.thumb, expenseId, createdAtMs: Date.now(),
        how: draft.how, fromWheel: draft.how === 'wheel', wheelSource: draft.how === 'wheel' ? draft.wheelSource : null,
        // wheelPick：轉盤轉到的，或今天選的那家；評分用它找店
        wheelPick: draft.how === 'self' ? '' : draft.wheelPick || '',
        placeId: draft.how === 'self' ? null : draft.placeId || null,
        url: draft.how === 'today' && isUrl(draft.url) ? draft.url.trim() : '',
        ...(isDrink ? { sugar: draft.sugar || null, size: draft.size } : {}),
      },
    });
    api.batch(ops);
    forgetSpin();
    forgetChoice();
    onSaved?.();
    onClose();
  };
  return (
    <Sheet title="食物打卡" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <img className="snap-preview" src={draft.full} alt="剛拍的照片" />
        <span className="small strong">吃的是哪一類？（可以多選，例：晚餐＋飲料）</span>
        <SlotPicker value={draft.slots} onChange={(slots) => setDraft({ ...draft, slots })} />
        {isDrink && (
          <div className="snap-how">
            <span className="small strong">甜度</span>
            <div className="seg four">
              {SUGARS.map((x) => (
                <button type="button" key={x} className={draft.sugar === x ? 'on' : ''} onClick={() => setDraft({ ...draft, sugar: x })}>
                  {x}
                </button>
              ))}
            </div>
            <div className="seg two">
              {SIZES.map((x) => (
                <button type="button" key={x} className={draft.size === x ? 'on' : ''} onClick={() => setDraft({ ...draft, size: x })}>
                  {x}杯
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="snap-how">
          <span className="small strong">這餐怎麼決定的？</span>
          <div className="seg three">
            {HOWS.map(([k, l]) => (
              <button type="button" key={k} className={draft.how === k ? 'on' : ''} aria-pressed={draft.how === k} onClick={() => setHow(k)}>
                {l}
              </button>
            ))}
          </div>
          {draft.how === 'wheel' && draft.wheelSource && (
            <span className="muted small">剛剛{WHEEL_SOURCES[draft.wheelSource]}轉到「{draft.wheelPick}」</span>
          )}
          {draft.how === 'wheel' && !draft.wheelSource && <span className="muted small">最近 3 小時沒轉過，記成轉盤打卡。</span>}
          {draft.how === 'today' && (
            <label className="snap-url">
              店家網址（可貼 Google 地圖連結）
              <input type="url" inputMode="url" value={draft.url} onChange={(e) => pasteUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" />
              {draft.wheelPick
                ? <span className="muted small">今天選「{draft.wheelPick}」{favByUrl(favs, draft.url) ? '（收藏的店）' : ''}</span>
                : draft.url && <span className="muted small">網址看不出店名，下面寫一下吃哪家。</span>}
              {!draft.url && favs.length > 0 && (
                <span className="choice-favs">
                  {favs.slice(0, 8).map((f) => (
                    <button type="button" key={f.key} className="btn small" onClick={() => setDraft({ ...draft, url: f.url || '', wheelPick: f.name, placeId: f.id !== f.key ? f.id : null, note: f.name })}>
                      {f.name}
                    </button>
                  ))}
                </span>
              )}
            </label>
          )}
        </div>
        <label>
          吃了什麼（可不填）
          <input
            value={draft.note}
            onChange={(e) => {
              const note = e.target.value;
              // 改寫成別家，就不算轉盤打卡
              const off = draft.how === 'wheel' && differsFromPick(note, draft.wheelPick) && !differsFromPick(draft.note, draft.wheelPick);
              setDraft({ ...draft, note, ...(off ? { how: 'self', fromWheel: false } : {}) });
            }}
            placeholder="例：自助餐三菜一肉"
          />
          {draft.how !== 'self' && draft.wheelPick && differsFromPick(draft.note, draft.wheelPick) && (
            <span className="muted small">你寫的不是{draft.how === 'wheel' ? '轉盤轉到' : '今天選'}的「{draft.wheelPick}」，評分會記在「{draft.note.trim()}」。</span>
          )}
        </label>
        <label>
          順便記帳：金額（可不填）
          <input inputMode="numeric" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^\d]/g, '') })} placeholder="不填就只打卡" />
        </label>
        <button className="btn primary big" type="submit" disabled={saving}>
          打卡{Number(draft.amount) > 0 ? `，記 ${category} ${money(Number(draft.amount))}` : ''}
        </button>
      </form>
    </Sheet>
  );
}

function SnapViewer({ item, onClose }) {
  const { uid, api } = useData();
  const [full, setFull] = useState(null);
  const [slots, setSlots] = useState(() => slotsOf(item));
  const [how, setHow] = useState(() => howOf(item));
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
    <Sheet title={`${shortLabel(item.date)} ${slotLabel(item)}`} onClose={onClose}>
      <img className="snap-preview" src={full || item.thumb} alt={item.note || '食物照片'} />
      {item.note && <p className="strong">{item.note}</p>}
      <SlotPicker value={slots} onChange={(next) => { setSlots(next); api.set(`foodLog/${item.id}`, slotFields(next)); }} />
      {slots.includes(DRINK_SLOT) && item.sugar && <p className="muted small">{item.size || ''}杯・{item.sugar}</p>}
      <p className="muted small">
        {how === 'wheel' ? `轉盤打卡（${wheelLabel({ ...item, fromWheel: true })}）` : how === 'today' ? `今天選擇${item.wheelPick ? `（${item.wheelPick}）` : ''}` : '自己選的'}
        {item.url && <a className="link" href={item.url} target="_blank" rel="noreferrer">地圖</a>}
      </p>
      <div className="seg three">
        {HOWS.map(([k, l]) => (
          <button type="button" key={k} className={how === k ? 'on' : ''} aria-pressed={how === k}
            onClick={() => { setHow(k); api.set(`foodLog/${item.id}`, { how: k, fromWheel: k === 'wheel' }); }}>
            {l}
          </button>
        ))}
      </div>
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
    // merge：收藏過的店評分後還是收藏（以前整份蓋掉，收藏會不見）
    if (key) ops.push({ set: `placeReviews/${key}`, data: { ...reviewUpdate(placeReviews[key], { name, placeId, rating }), ...(item.url && !placeReviews[key]?.url ? { url: item.url } : {}) } });
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
              <span className="muted small">{shortLabel(it.date)} {slotLabel(it)}{it.fromWheel ? '・轉盤' : howOf(it) === 'today' ? '・今天選' : ''}</span>
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

// 可以多選；至少留一類
function SlotPicker({ value, onChange }) {
  return (
    <div className="seg slots" role="group" aria-label="類別（可多選）">
      {Object.entries(LOG_SLOTS).map(([k, l]) => (
        <button type="button" key={k} className={value.includes(k) ? 'on' : ''} aria-pressed={value.includes(k)} onClick={() => onChange(toggleSlot(value, k))}>
          {l}
        </button>
      ))}
    </div>
  );
}
