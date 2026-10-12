import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Wheel from './Wheel.jsx';
import { useData } from '../data.jsx';
import { reviewOf, reviewKey, reviewUpdate, placeInfo, favoritesOf, RATING_TAG } from '../lib/foodlog.js';
import { Sheet } from './ui.jsx';
import { logError } from '../lib/errlog.js';
import { RADII, PRICES, searchNearby, searchAlong, getPosition, findPlace, normalize, groupCounts, randomArea, mergePlaces, sample } from '../lib/places.js';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
const MAX_ON_WHEEL = 12;

const dist = (m) => (m == null ? '' : m < 1000 ? `${m} 公尺` : `${+(m / 1000).toFixed(m < 10000 ? 1 : 0)} 公里`);

// 附近餐廳轉盤：先抓定位，再用 Google 地圖找附近的店，依類型分組
export default function Nearby() {
  const [params, setParams] = useSearchParams();
  const kind = params.get('kind') === 'drink' ? 'drink' : 'food';
  const [radius, setRadius] = useState(1000);
  const [state, setState] = useState({ status: 'idle', list: [], error: '' });
  const [mode, setMode] = useState('group');
  const [off, setOff] = useState([]);
  const [result, setResult] = useState(null);
  const [excluded, setExcluded] = useState([]);
  const [priceOff, setPriceOff] = useState([]);
  // 從哪裡找：null = 我的位置；否則是輸入的街道／地標
  const [origin, setOrigin] = useState(null);
  const [where, setWhere] = useState('');
  const [picking, setPicking] = useState({ status: 'idle', list: [], error: '' });
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  // 再抓一批後預設只轉新抓到的；換一批時不重複上過轉盤的店
  const [onlyNew, setOnlyNew] = useState(false);
  const [seen, setSeen] = useState([]);
  const [more, setMore] = useState({ status: 'idle', msg: '' });
  // 查到的是一條路時，預設只放這條路上的店
  const [roadOnly, setRoadOnly] = useState(true);
  const [withBad, setWithBad] = useState(false);
  const { placeReviews, api } = useData();
  const [favSpin, setFavSpin] = useState(false);
  const [showFavs, setShowFavs] = useState(false);

  if (!KEY) {
    return (
      <section className="section">
        <p className="hint warn">還沒設定 Google 地圖的金鑰，附近餐廳轉盤暫時不能用。設定步驟在交接說明（README 的「Google 地圖」）。</p>
      </section>
    );
  }

  const switchKind = (k) => {
    setParams(k === 'drink' ? { tab: 'near', kind: 'drink' } : { tab: 'near' });
    setState({ status: 'idle', list: [], error: '' });
    setOff([]);
    setResult(null);
    setExcluded([]);
    setPriceOff([]);
  };

  const load = async (r = radius, from = origin, ro = roadOnly) => {
    setState({ status: 'loading', list: [], error: '' });
    setResult(null);
    setExcluded([]);
    try {
      const here = from ? { latitude: from.latitude, longitude: from.longitude } : await getPosition();
      const road = from?.road && ro ? from.road : null;
      const res = road
        ? await searchAlong({ key: KEY, road, ...here, kind })
        : await searchNearby({ key: KEY, ...randomArea(here, r), kind, rank: 'DISTANCE' });
      setState({ status: 'ok', list: normalize(res.places, here, kind, road ? null : r), error: '', cached: res.cached, here, radius: r, road, batch: 0, more: !!res.more });
      setOnlyNew(false);
      setSeen([]);
      setMore({ status: 'idle', msg: '' });
    } catch (e) {
      // 沒開定位權限是正常狀況，不算網站錯誤
      if (!/定位/.test(e.message)) logError('附近餐廳', e, { show: false });
      setState({ status: 'error', list: [], error: e.message });
    }
  };

  // 在範圍內隨機挑一個點再找一批，跟原本的合併（Google 一次最多給 20 家）
  const loadMore = async () => {
    const { here, radius: r, road } = state;
    setMore({ status: 'loading', msg: '' });
    try {
      let places;
      let next = {};
      if (road) {
        // 沿著路：換下一組關鍵字
        const res = await searchAlong({ key: KEY, road, ...here, kind, batch: state.batch + 1 });
        places = res.places;
        next = { batch: state.batch + 1, more: res.more };
      } else {
        places = (await searchNearby({ key: KEY, ...randomArea(here, r), kind, rank: 'DISTANCE' })).places;
      }
      const merged = mergePlaces(state.list, normalize(places, here, kind, road ? null : r).map((p) => ({ ...p, fresh: true })));
      // 新的少於 2 家轉不起來，就先不切
      if (merged.added >= 2) setOnlyNew(true);
      setSeen([]);
      setState((s) => ({ ...s, ...next, list: merged.list }));
      setSeed((x) => x + 1);
      setMore({ status: 'idle', msg: merged.added ? `多了 ${merged.added} 家，現在共 ${merged.list.length} 家` : road ? (next.more ? '這次抓到的都看過了，再按一次換別的關鍵字' : '這條路上能找的都找過了') : '這次抓到的都看過了，再按一次換別的地方' });
    } catch (e) {
      logError('附近餐廳', e, { show: false });
      setMore({ status: 'idle', msg: `沒抓到：${e.message}` });
    }
  };

  const lookup = async (e) => {
    e.preventDefault();
    if (!where.trim()) return;
    setPicking({ status: 'loading', list: [], error: '' });
    try {
      const found = await findPlace({ key: KEY, text: where });
      if (found.length === 1) return choose(found[0]);
      setPicking({ status: found.length ? 'ok' : 'none', list: found, error: '' });
    } catch (err) {
      setPicking({ status: 'error', list: [], error: err.message });
    }
  };
  const choose = (o) => {
    setOrigin(o);
    setRoadOnly(!!o.road);
    setPicking({ status: 'idle', list: [], error: '' });
    load(radius, o, !!o.road);
  };
  const useMine = () => {
    setOrigin(null);
    setWhere('');
    setPicking({ status: 'idle', list: [], error: '' });
    if (state.status === 'ok' || origin) load(radius, null);
  };

  const all = state.list;
  const prices = PRICES.map(([k, label]) => ({ key: k, label, count: all.filter((p) => p.price === k).length })).filter((p) => p.count);
  // 全部都同一級（常見是都沒標價）就不顯示價位篩選
  const priceOn = prices.length > 1;
  const freshCount = all.filter((p) => p.fresh).length;
  const priced = priceOn ? all.filter((p) => !priceOff.includes(p.price)) : all;
  const list = onlyNew && freshCount ? priced.filter((p) => p.fresh) : priced;
  const groups = groupCounts(list);
  // 評過的店：負評預設不上轉盤，好吃的格子大一倍
  const rated = list.map((p) => { const r = reviewOf(placeReviews, p); return { ...p, rating: r?.rating || null, fav: !!r?.fav }; });
  const favs = favoritesOf(placeReviews, kind).map((p) => ({ ...p, fav: true }));

  // 收藏／負評：一按就存，再按一次取消
  const keyOf = (p) => reviewKey({ placeId: p.placeId || p.id, name: p.name });
  const toggleFav = (p) => {
    const k = keyOf(p);
    const on = !(placeReviews[k]?.fav);
    api.set(`placeReviews/${k}`, { ...placeInfo(p, kind), fav: on, updatedAtMs: Date.now() });
    if (result?.id === p.id) setResult({ ...result, fav: on });
  };
  const toggleBad = (p) => {
    const k = keyOf(p);
    const prev = placeReviews[k];
    const data = prev?.rating === 'bad'
      ? { rating: null, updatedAtMs: Date.now() }
      : { ...placeInfo(p, kind), ...reviewUpdate(prev, { name: p.name, placeId: p.placeId || p.id, rating: 'bad' }) };
    api.set(`placeReviews/${k}`, data);
    if (result?.id === p.id) setResult({ ...result, rating: data.rating });
  };
  const act = { toggleFav, toggleBad };
  const badCount = rated.filter((p) => p.rating === 'bad').length;
  // 收藏過的店不放進來（在「我的收藏」轉）
  const favHidden = rated.filter((p) => p.fav).length;
  const shown = rated.filter((p) => !p.fav && !off.includes(p.group) && (withBad || p.rating !== 'bad'));
  const groupOptions = groups.filter((g) => !off.includes(g.name) && !excluded.includes(`g:${g.name}`)).map((g) => ({ id: `g:${g.name}`, name: g.name, group: g.name }));
  // 店太多時隨機挑 12 家上轉盤，可以換一批
  const pool = shown.filter((p) => !excluded.includes(p.id));
  const unseen = pool.filter((p) => !seen.includes(p.id));
  const placeOptions = sample(unseen.length >= 2 ? unseen : pool, MAX_ON_WHEEL, seed)
    .map((p) => ({ ...p, placeId: p.id, weight: p.rating === 'good' ? 2 : 1 }));
  const favOptions = favs.filter((p) => !excluded.includes(p.id)).map((p) => ({ ...p, placeId: p.id, weight: p.rating === 'good' ? 2 : 1 }));
  const options = favSpin ? favOptions : mode === 'group' ? groupOptions : placeOptions;

  return (
    <section className="section">
      <div className="card next-head">
        <div className="seg two">
          <button className={kind === 'food' ? 'on' : ''} onClick={() => switchKind('food')}>
            找餐廳
          </button>
          <button className={kind === 'drink' ? 'on' : ''} onClick={() => switchKind('drink')}>
            找飲料店
          </button>
        </div>
        <strong>{kind === 'drink' ? '附近喝什麼' : '附近吃什麼'}</strong>
        <span className="muted small">用 Google 地圖找{origin?.road && roadOnly ? `${origin.road}上` : origin ? '那附近' : '你附近'}的{kind === 'drink' ? '飲料店（手搖飲、咖啡、果汁）' : '餐廳'}，依類型分好放進轉盤。</span>
        <form className="row gap near-where" onSubmit={lookup}>
          <input
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="輸入街道、地址或地標，例如 永康街"
            aria-label="查街道"
            enterKeyHint="search"
          />
          <button className="btn" disabled={!where.trim() || picking.status === 'loading'}>
            {picking.status === 'loading' ? '查…' : '查'}
          </button>
        </form>
        <div className="near-origin small">
          {origin ? (
            <>
              <span>📍 {origin.label}{origin.address ? `（${origin.address}）` : ''}</span>
              {!origin.road && origin.food !== false && <FavButton p={origin} act={act} reviews={placeReviews} />}
              <button className="link" onClick={useMine}>改回我的位置</button>
            </>
          ) : (
            <span className="muted">📍 目前用你現在的位置</span>
          )}
        </div>
        {origin?.road && (
          <label className="near-road">
            <input type="checkbox" checked={roadOnly} onChange={(e) => { setRoadOnly(e.target.checked); load(radius, origin, e.target.checked); }} />
            只要「{origin.road}」上的店
          </label>
        )}
        {picking.status === 'error' && <p className="hint warn">查不到這個地方：{picking.error}</p>}
        {picking.status === 'none' && <p className="hint warn">找不到「{where}」，換個寫法試試（加上區或城市）。</p>}
        {picking.status === 'ok' && (
          <ul className="list near-picks" aria-label="選一個地點">
            {picking.list.map((o) => (
              <li key={o.id} className="pick-row">
                <button className="pick" onClick={() => choose(o)}>
                  <strong>{o.label}</strong>
                  <span className="muted small">{o.address}</span>
                </button>
                {!o.road && o.food !== false && <FavButton p={{ ...o, address: o.address }} act={act} reviews={placeReviews} />}
              </li>
            ))}
          </ul>
        )}
        <div className="row gap wrap near-controls">
          {origin?.road && roadOnly ? (
            <span className="chip">沿著{origin.road}</span>
          ) : (
            <select value={radius} onChange={(e) => { const r = Number(e.target.value); setRadius(r); if (state.status === 'ok') load(r); }} aria-label="範圍">
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {dist(r)}內
                </option>
              ))}
            </select>
          )}
          <button className="btn primary" onClick={() => load()} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? '找找看…' : state.status === 'ok' ? '重新找' : kind === 'drink' ? '找附近的飲料店' : '找附近的店'}
          </button>
        </div>
      </div>
      {favs.length > 0 && (
        <div className="card fav-box">
          <div className="row between">
            <button className="link strong" onClick={() => setShowFavs(!showFavs)} aria-expanded={showFavs}>
              我的收藏（{favs.length}）{showFavs ? '收起' : '打開'}
            </button>
            {favs.length >= 2 && (
              <button className={`btn small ${favSpin ? 'primary' : ''}`} onClick={() => { setFavSpin(!favSpin); setExcluded([]); setResult(null); }}>
                {favSpin ? '回到附近的店' : '轉我的收藏'}
              </button>
            )}
          </div>
          {showFavs && (
            <ul className="list">
              {favs.map((p) => <PlaceRow key={p.id} p={p} act={act} />)}
            </ul>
          )}
        </div>
      )}
      {favSpin && (
        favOptions.length < 2 ? (
          <p className="hint warn">能轉的收藏只剩 {favOptions.length} 家。<button className="link" onClick={() => setExcluded([])}>把拿掉的放回去</button></p>
        ) : (
          <Wheel key="fav" source={kind === 'drink' ? 'drink' : 'near'} options={favOptions} onResult={setResult} caption={`收藏的 ${favOptions.length} 家`} />
        )
      )}
      {state.status === 'error' && <p className="hint warn">找不到附近的店：{state.error}</p>}
      {state.status === 'ok' && !all.length && state.road && <p className="hint warn">「{state.road}」上沒找到{kind === 'drink' ? '飲料店' : '餐廳'}，把「只要這條路上的店」關掉改找附近試試。</p>}
      {state.status === 'ok' && !all.length && !state.road && <p className="hint warn">{kind === 'drink' ? '這個範圍內沒有找到飲料店' : '這個範圍內沒有找到餐廳'}，把範圍加大試試。</p>}

      {priceOn && (
        <>
          <h3>價位（點一下可以拿掉）</h3>
          <div className="row gap wrap near-prices">
            {prices.map((p) => (
              <button
                key={p.key}
                className={`chip-btn ${priceOff.includes(p.key) ? 'off' : ''}`}
                aria-pressed={!priceOff.includes(p.key)}
                onClick={() => { setPriceOff(priceOff.includes(p.key) ? priceOff.filter((x) => x !== p.key) : [...priceOff, p.key]); setExcluded([]); }}
              >
                {p.label} {p.count}
              </button>
            ))}
          </div>
          {all.length > 0 && !list.length && <p className="hint warn">這個價位沒有店，把價位加回來試試。</p>}
        </>
      )}

      {!favSpin && list.length > 0 && (
        <>
          <h3>類型（點一下可以拿掉）</h3>
          <div className="row gap wrap near-groups">
            {groups.map((g) => (
              <button
                key={g.name}
                className={`chip-btn ${off.includes(g.name) ? 'off' : ''}`}
                aria-pressed={!off.includes(g.name)}
                onClick={() => { setOff(off.includes(g.name) ? off.filter((x) => x !== g.name) : [...off, g.name]); setExcluded([]); }}
              >
                {g.name} {g.count}
              </button>
            ))}
          </div>

          {freshCount > 0 && (
            <button className={`chip-btn near-new ${onlyNew ? '' : 'off'}`} aria-pressed={onlyNew} onClick={() => { setOnlyNew(!onlyNew); setSeen([]); setExcluded([]); }}>
              {onlyNew ? `只轉新抓到的 ${freshCount} 家（原本的不放）` : `原本的也一起轉（共 ${all.length} 家）`}
            </button>
          )}
          {favHidden > 0 && <p className="muted small">收藏過的 {favHidden} 家沒放進來，要轉它們按上面的「轉我的收藏」。</p>}
          {badCount > 0 && (
            <button className={`chip-btn ${withBad ? '' : 'off'} near-bad`} aria-pressed={withBad} onClick={() => { setWithBad(!withBad); setExcluded([]); }}>
              {withBad ? `負評的 ${badCount} 家也放進來了` : `負評的 ${badCount} 家沒放進轉盤`}
            </button>
          )}

          <div className="seg two">
            <button className={mode === 'group' ? 'on' : ''} onClick={() => { setMode('group'); setExcluded([]); }}>
              轉類型
            </button>
            <button className={mode === 'place' ? 'on' : ''} onClick={() => { setMode('place'); setExcluded([]); }}>
              轉店家
            </button>
          </div>

          {options.length < 2 ? (
            <p className="hint warn">
              能轉的只剩 {options.length} 個。
              {excluded.length > 0 && <button className="link" onClick={() => setExcluded([])}>把拿掉的放回去</button>}
            </p>
          ) : (
            <Wheel
              key={mode}
              source={kind === 'drink' ? 'drink' : 'near'}
              options={options}
              onResult={setResult}
              caption={mode === 'group' ? `${options.length} 種類型` : `${shown.length > MAX_ON_WHEEL ? `隨機 ${options.length} 家（共 ${shown.length} 家）` : `${options.length} 家`}${options.some((o) => o.rating === 'good') ? '・複評好吃的格子大一倍' : ''}`}
            />
          )}
          {mode === 'place' && shown.length > MAX_ON_WHEEL && (
            <button className="btn wide" onClick={() => { setSeen(unseen.length - placeOptions.length >= 2 ? [...seen, ...placeOptions.map((p) => p.id)] : []); setSeed((x) => x + 1); setExcluded([]); }}>
              換一批上轉盤（不重複）
            </button>
          )}

          {(!state.road || state.more) && (
            <button className="btn wide" onClick={loadMore} disabled={more.status === 'loading'}>
              {more.status === 'loading' ? '抓抓看…' : state.road ? '換別的關鍵字，再抓一批' : '隨機換個地方，再抓一批'}
            </button>
          )}
          {more.msg && <p className="hint">{more.msg}</p>}
          <h3>{state.road ? `${state.road}上的店` : '附近的店'}（{shown.length}）</h3>
          <ul className="list">
            {shown.map((p) => (
              <PlaceRow key={p.id} p={p} act={act} />
            ))}
          </ul>
          <p className="muted small">資料來自 Google 地圖{state.cached ? '（6 小時內查過，用上次的結果）' : ''}。</p>
        </>
      )}

      {result && (
        <Sheet title="就決定是你了" onClose={() => setResult(null)}>
          {mode === 'group' && !favSpin ? (
            <>
              <p className="wheel-result">{kind === 'drink' ? '喝' : '吃'}{result.name}</p>
              <ul className="list">
                {shown.filter((p) => p.group === result.name).map((p) => (
                  <PlaceRow key={p.id} p={p} act={act} />
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="wheel-result">
                <strong>{result.name}</strong>
                <div className="muted small">{[result.typeLabel || result.group, result.priceLabel, dist(result.distance), result.address].filter(Boolean).join('・')}</div>
              </div>
              <div className="row gap place-acts">
                <button className={`btn grow ${result.fav ? 'on-fav' : ''}`} onClick={() => toggleFav(result)} aria-pressed={!!result.fav}>
                  {result.fav ? '已收藏' : '收藏'}
                </button>
                <button className={`btn grow ${result.rating === 'bad' ? 'on-bad' : ''}`} onClick={() => toggleBad(result)} aria-pressed={result.rating === 'bad'}>
                  {result.rating === 'bad' ? '已負評' : '負評'}
                </button>
              </div>
              {result.url && (
                <a className="btn primary big wide" href={result.url} target="_blank" rel="noreferrer">
                  在 Google 地圖打開
                </a>
              )}
              {kind === 'drink' && (
                <Link className="btn big wide" to={`/money?drink=1&note=${encodeURIComponent(result.name)}`}>
                  買了，記一筆飲料
                </Link>
              )}
              <Link className="btn big wide" to="/food?tab=snap">拍照打卡（記成轉盤打卡）</Link>
            </>
          )}
          <button
            className="btn big wide"
            onClick={() => {
              setExcluded([...excluded, result.id]);
              setResult(null);
            }}
          >
            再轉一次
          </button>
        </Sheet>
      )}
    </section>
  );
}

function PlaceRow({ p, act }) {
  return (
    <li className="meal-choice place-row">
      <span className="meal-line">
        <strong>
          {p.name}
          {p.fav && <span className="rate-tag fav">收藏</span>}
          {p.rating && <span className={`rate-tag ${p.rating}`}>{RATING_TAG[p.rating]}</span>}
        </strong>
        <span className="muted">{[p.group, p.priceLabel, dist(p.distance), p.address].filter(Boolean).join('・')}</span>
        {act && (
          <span className="row-acts">
            <button className="link small" onClick={() => act.toggleFav(p)}>{p.fav ? '取消收藏' : '收藏'}</button>
            <button className="link small" onClick={() => act.toggleBad(p)}>{p.rating === 'bad' ? '取消負評' : '負評'}</button>
          </span>
        )}
      </span>
      {p.url && (
        <a className="btn small" href={p.url} target="_blank" rel="noreferrer">
          地圖
        </a>
      )}
    </li>
  );
}

// 查出來的那家店（不是路）也能直接收藏
function FavButton({ p, act, reviews }) {
  p = { ...p, name: p.name || p.label };
  const on = !!reviewOf(reviews, p)?.fav;
  return (
    <button className={`btn small fav-btn ${on ? 'on-fav' : ''}`} aria-pressed={on} onClick={() => act.toggleFav(p)}>
      {on ? '已收藏' : '收藏'}
    </button>
  );
}
