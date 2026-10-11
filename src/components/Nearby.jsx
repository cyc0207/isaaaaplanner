import { useState } from 'react';
import Wheel from './Wheel.jsx';
import { Sheet } from './ui.jsx';
import { RADII, searchNearby, getPosition, normalize, groupCounts } from '../lib/places.js';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
const MAX_ON_WHEEL = 12;

const dist = (m) => (m == null ? '' : m < 1000 ? `${m} 公尺` : `${(m / 1000).toFixed(1)} 公里`);

// 附近餐廳轉盤：先抓定位，再用 Google 地圖找附近的店，依類型分組
export default function Nearby() {
  const [radius, setRadius] = useState(1000);
  const [state, setState] = useState({ status: 'idle', list: [], error: '' });
  const [mode, setMode] = useState('group');
  const [off, setOff] = useState([]);
  const [result, setResult] = useState(null);
  const [excluded, setExcluded] = useState([]);

  if (!KEY) {
    return (
      <section className="section">
        <p className="hint warn">還沒設定 Google 地圖的金鑰，附近餐廳轉盤暫時不能用。設定步驟在交接說明（README 的「Google 地圖」）。</p>
      </section>
    );
  }

  const load = async (r = radius) => {
    setState({ status: 'loading', list: [], error: '' });
    setResult(null);
    setExcluded([]);
    try {
      const here = await getPosition();
      const { places, cached } = await searchNearby({ key: KEY, ...here, radius: r });
      setState({ status: 'ok', list: normalize(places, here), error: '', cached });
    } catch (e) {
      setState({ status: 'error', list: [], error: e.message });
    }
  };

  const list = state.list;
  const groups = groupCounts(list);
  const shown = list.filter((p) => !off.includes(p.group));
  const groupOptions = groups.filter((g) => !off.includes(g.name) && !excluded.includes(`g:${g.name}`)).map((g) => ({ id: `g:${g.name}`, name: g.name, group: g.name }));
  const placeOptions = shown.filter((p) => !excluded.includes(p.id)).slice(0, MAX_ON_WHEEL);
  const options = mode === 'group' ? groupOptions : placeOptions;

  return (
    <section className="section">
      <div className="card next-head">
        <strong>附近吃什麼</strong>
        <span className="muted small">用 Google 地圖找你附近的餐廳，依類型分好放進轉盤。</span>
        <div className="row gap wrap near-controls">
          <select value={radius} onChange={(e) => { const r = Number(e.target.value); setRadius(r); if (state.status === 'ok') load(r); }} aria-label="範圍">
            {RADII.map((r) => (
              <option key={r} value={r}>
                {dist(r)}內
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={() => load()} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? '找找看…' : state.status === 'ok' ? '重新找' : '找附近的店'}
          </button>
        </div>
      </div>
      {state.status === 'error' && <p className="hint warn">找不到附近的店：{state.error}</p>}
      {state.status === 'ok' && !list.length && <p className="hint warn">這個範圍內沒有找到餐廳，把範圍加大試試。</p>}

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
              <p className="wheel-result">吃{result.name}</p>
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
                <div className="muted small">{[result.typeLabel || result.group, dist(result.distance), result.address].filter(Boolean).join('・')}</div>
              </div>
              <a className="btn primary big wide" href={result.url} target="_blank" rel="noreferrer">
                在 Google 地圖打開
              </a>
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
        <span className="muted">{[p.group, dist(p.distance), p.address].filter(Boolean).join('・')}</span>
      </span>
      <a className="btn small" href={p.url} target="_blank" rel="noreferrer">
        地圖
      </a>
    </li>
  );
}
