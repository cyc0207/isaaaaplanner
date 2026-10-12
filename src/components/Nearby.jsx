import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Wheel from './Wheel.jsx';
import { Sheet } from './ui.jsx';
import { RADII, PRICES, searchNearby, getPosition, findPlace, normalize, groupCounts } from '../lib/places.js';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
const MAX_ON_WHEEL = 12;

const dist = (m) => (m == null ? '' : m < 1000 ? `${m} 公尺` : `${(m / 1000).toFixed(1)} 公里`);

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

  const load = async (r = radius, from = origin) => {
    setState({ status: 'loading', list: [], error: '' });
    setResult(null);
    setExcluded([]);
    try {
      const here = from ? { latitude: from.latitude, longitude: from.longitude } : await getPosition();
      const { places, cached } = await searchNearby({ key: KEY, ...here, radius: r, kind });
      setState({ status: 'ok', list: normalize(places, here, kind, r), error: '', cached });
    } catch (e) {
      setState({ status: 'error', list: [], error: e.message });
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
    setPicking({ status: 'idle', list: [], error: '' });
    load(radius, o);
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
  const list = priceOn ? all.filter((p) => !priceOff.includes(p.price)) : all;
  const groups = groupCounts(list);
  const shown = list.filter((p) => !off.includes(p.group));
  const groupOptions = groups.filter((g) => !off.includes(g.name) && !excluded.includes(`g:${g.name}`)).map((g) => ({ id: `g:${g.name}`, name: g.name, group: g.name }));
  const placeOptions = shown.filter((p) => !excluded.includes(p.id)).slice(0, MAX_ON_WHEEL);
  const options = mode === 'group' ? groupOptions : placeOptions;

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
        <span className="muted small">用 Google 地圖找{origin ? '那附近' : '你附近'}的{kind === 'drink' ? '飲料店（手搖飲、咖啡、果汁）' : '餐廳'}，依類型分好放進轉盤。</span>
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
              <button className="link" onClick={useMine}>改回我的位置</button>
            </>
          ) : (
            <span className="muted">📍 目前用你現在的位置</span>
          )}
        </div>
        {picking.status === 'error' && <p className="hint warn">查不到這個地方：{picking.error}</p>}
        {picking.status === 'none' && <p className="hint warn">找不到「{where}」，換個寫法試試（加上區或城市）。</p>}
        {picking.status === 'ok' && (
          <ul className="list near-picks" aria-label="選一個地點">
            {picking.list.map((o) => (
              <li key={o.id}>
                <button className="pick" onClick={() => choose(o)}>
                  <strong>{o.label}</strong>
                  <span className="muted small">{o.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="row gap wrap near-controls">
          <select value={radius} onChange={(e) => { const r = Number(e.target.value); setRadius(r); if (state.status === 'ok') load(r); }} aria-label="範圍">
            {RADII.map((r) => (
              <option key={r} value={r}>
                {dist(r)}內
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={() => load()} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? '找找看…' : state.status === 'ok' ? '重新找' : kind === 'drink' ? '找附近的飲料店' : '找附近的店'}
          </button>
        </div>
      </div>
      {state.status === 'error' && <p className="hint warn">找不到附近的店：{state.error}</p>}
      {state.status === 'ok' && !all.length && <p className="hint warn">{kind === 'drink' ? '這個範圍內沒有找到飲料店' : '這個範圍內沒有找到餐廳'}，把範圍加大試試。</p>}

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

      {list.length > 0 && (
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
              options={options}
              onResult={setResult}
              caption={mode === 'group' ? `${options.length} 種類型` : `最近的 ${options.length} 家${shown.length > MAX_ON_WHEEL ? `（共 ${shown.length} 家）` : ''}`}
            />
          )}

          <h3>附近的店（{shown.length}）</h3>
          <ul className="list">
            {shown.map((p) => (
              <PlaceRow key={p.id} p={p} />
            ))}
          </ul>
          <p className="muted small">資料來自 Google 地圖{state.cached ? '（6 小時內查過，用上次的結果）' : ''}。</p>
        </>
      )}

      {result && (
        <Sheet title="就決定是你了" onClose={() => setResult(null)}>
          {mode === 'group' ? (
            <>
              <p className="wheel-result">{kind === 'drink' ? '喝' : '吃'}{result.name}</p>
              <ul className="list">
                {shown.filter((p) => p.group === result.name).map((p) => (
                  <PlaceRow key={p.id} p={p} />
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="wheel-result">
                <strong>{result.name}</strong>
                <div className="muted small">{[result.typeLabel || result.group, result.priceLabel, dist(result.distance), result.address].filter(Boolean).join('・')}</div>
              </div>
              <a className="btn primary big wide" href={result.url} target="_blank" rel="noreferrer">
                在 Google 地圖打開
              </a>
              {kind === 'drink' && (
                <Link className="btn big wide" to={`/money?drink=1&note=${encodeURIComponent(result.name)}`}>
                  買了，記一筆飲料
                </Link>
              )}
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

function PlaceRow({ p }) {
  return (
    <li className="meal-choice">
      <span className="meal-line">
        <strong>{p.name}</strong>
        <span className="muted">{[p.group, p.priceLabel, dist(p.distance), p.address].filter(Boolean).join('・')}</span>
      </span>
      <a className="btn small" href={p.url} target="_blank" rel="noreferrer">
        地圖
      </a>
    </li>
  );
}
