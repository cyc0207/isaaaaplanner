import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, addDays, shortLabel } from '../lib/date.js';
import {
  SLOTS, SLOT_KEYS, nextMeal, slotBudgetLeft, kcalToday, recentlyEaten, mealCandidates, rankMeals, cheapestForSlot, mealExpense,
} from '../lib/meals.js';
import { ACTIVITY, latestWeight, calorieTarget, weightTrend, trendLabel } from '../lib/body.js';
import { money, Sheet } from '../components/ui.jsx';
import Wheel, { MealLine } from '../components/Wheel.jsx';

const TABS = [
  ['next', '下一餐'],
  ['list', '常吃清單'],
  ['body', '體重'],
];

export default function FoodPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'next';
  return (
    <div className="page">
      <header className="page-head">
        <h1>吃什麼</h1>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setParams(k === 'next' ? {} : { tab: k })}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'next' && <NextMeal wheel={params.get('wheel') === '1'} />}
      {tab === 'list' && <MealList />}
      {tab === 'body' && <Body />}
    </div>
  );
}

// 首頁卡片和吃什麼頁共用：算出下一餐的選項
export function useNextMeal({ onlyPlate = false, where = '' } = {}) {
  const { meals, budget, expenses, body, weightLog } = useData();
  const now = new Date();
  const t = today();
  const nm = nextMeal(now);
  const day = nm.tomorrow ? addDays(t, 1) : t;
  const budgetLeft = slotBudgetLeft(budget, expenses, nm.slot, day);
  const target = calorieTarget(body, latestWeight(weightLog, t));
  const kcalLeft = target && !nm.tomorrow ? target.target - kcalToday(expenses, day) : null;
  const eaten = recentlyEaten(expenses, day);
  const candidates = mealCandidates({ meals, slot: nm.slot, budgetLeft, eaten, kcalLeft, onlyPlate, where });
  return {
    ...nm, day, budgetLeft, kcalLeft, target, candidates,
    top: rankMeals(candidates).slice(0, 3),
    cheapest: cheapestForSlot(meals, nm.slot),
    slotName: SLOTS[nm.slot],
  };
}

export function useEatMeal() {
  const { api, defaultAccount, confirmClosed } = useData();
  return (meal, slot, day) => {
    if (!confirmClosed(day)) return null;
    return api.add('expenses', mealExpense(meal, slot, day, defaultAccount));
  };
}

function NextMeal({ wheel }) {
  const { meals } = useData();
  const [onlyPlate, setOnlyPlate] = useState(false);
  const [where, setWhere] = useState('');
  const [excluded, setExcluded] = useState([]);
  const [result, setResult] = useState(null);
  const [eatenMsg, setEatenMsg] = useState('');
  const [showWheel, setShowWheel] = useState(wheel);
  const nm = useNextMeal({ onlyPlate, where });
  const eat = useEatMeal();
  const stores = [...new Set(meals.filter((m) => (m.slots || []).includes(nm.slot) && m.where).map((m) => m.where))];
  const wheelOptions = nm.candidates.filter((m) => !excluded.includes(m.id));

  const doEat = (m) => {
    eat(m, nm.slot, nm.day);
    setEatenMsg(`已記：${nm.slotName} ${m.name} ${money(m.price)}`);
    setResult(null);
    setExcluded([]);
  };

  return (
    <section className="section">
      <div className="card next-head">
        <strong>
          {nm.tomorrow ? '明天' : ''}
          {nm.slotName}
        </strong>
        <span className="muted">
          {nm.budgetLeft === null ? '沒有設這一餐的預算' : `這餐預算剩 ${money(nm.budgetLeft)}`}
          {nm.kcalLeft !== null && `・今天熱量還剩 ${Math.max(0, Math.round(nm.kcalLeft))} 大卡`}
        </span>
      </div>
      {eatenMsg && <p className="hint ok">{eatenMsg}</p>}

      <div className="row gap wrap filters">
        <label className="inline">
          <input type="checkbox" checked={onlyPlate} onChange={(e) => { setOnlyPlate(e.target.checked); setExcluded([]); }} />
          只看符合一餐盤
        </label>
        {stores.length > 1 && (
          <select value={where} onChange={(e) => { setWhere(e.target.value); setExcluded([]); }} aria-label="只看某家店">
            <option value="">所有店</option>
            {stores.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {!showWheel ? (
        <>
          <h2>建議</h2>
          <MealChoices nm={nm} onEat={doEat} />
          <button className="btn big wide" onClick={() => setShowWheel(true)}>
            用轉盤決定
          </button>
        </>
      ) : (
        <>
          <h2>轉盤</h2>
          {wheelOptions.length < 2 ? (
            <p className="hint warn">
              清單裡符合的只有 {wheelOptions.length} 個，<Link to="/food?tab=list">去新增常吃清單</Link>
              {excluded.length > 0 && (
                <>
                  ，或<button className="link" onClick={() => setExcluded([])}>把拿掉的放回去</button>
                </>
              )}
            </p>
          ) : (
            <Wheel options={wheelOptions} onResult={setResult} />
          )}
          <button className="link center-block" onClick={() => setShowWheel(false)}>
            回到建議
          </button>
        </>
      )}

      {result && (
        <Sheet title="就決定是你了" onClose={() => setResult(null)}>
          <div className="wheel-result">
            <MealLine meal={result} />
          </div>
          <div className="row gap">
            <button className="btn primary big grow" onClick={() => doEat(result)}>
              就吃這個
            </button>
            <button
              className="btn big grow"
              onClick={() => {
                // 再轉一次：上一個結果先拿掉
                setExcluded([...excluded, result.id]);
                setResult(null);
              }}
            >
              再轉一次
            </button>
          </div>
          <p className="muted small">按「就吃這個」會記一筆 {nm.slotName} {money(result.price)}。</p>
        </Sheet>
      )}
    </section>
  );
}

export function MealChoices({ nm, onEat, compact }) {
  if (!nm.top.length) {
    return (
      <div className="hint warn">
        {nm.budgetLeft !== null ? `這餐預算剩 ${money(nm.budgetLeft)}，清單裡沒有符合的。` : '清單裡沒有符合的。'}
        {nm.cheapest && (
          <div>
            清單裡最便宜的：<MealLine meal={nm.cheapest} />
          </div>
        )}
        {!compact && (
          <div>
            <Link to="/food?tab=list">去新增常吃清單</Link>
          </div>
        )}
      </div>
    );
  }
  return (
    <ul className="list meal-choices">
      {nm.top.map((m) => (
        <li key={m.id} className="meal-choice">
          <MealLine meal={m} />
          <button className="btn small primary" onClick={() => onEat(m)}>
            吃這個
          </button>
        </li>
      ))}
    </ul>
  );
}

const EMPTY = { name: '', slots: [], price: '', kcal: '', protein: '', where: '', plateOk: false };

function MealList() {
  const { meals } = useData();
  const [editing, setEditing] = useState(null);
  return (
    <section className="section">
      <p className="muted small">
        熱量和蛋白質照包裝標示填；不知道就留空。一餐盤原則：澱粉 1 拳、蛋白質 1 掌（豆魚蛋肉）、青菜 2 拳以上。
      </p>
      {SLOT_KEYS.map((slot) => {
        const list = meals.filter((m) => (m.slots || []).includes(slot));
        return (
          <div key={slot}>
            <h3>
              {SLOTS[slot]}（{list.length}）
            </h3>
            <ul className="list">
              {list.map((m) => (
                <li key={m.id} className="meal-choice" onClick={() => setEditing(m)}>
                  <MealLine meal={m} />
                  <span className="row gap">
                    {m.plateOk && <span className="chip ok">一餐盤</span>}
                    {m.isSample && <span className="chip warn">範例，請改</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <button className="btn primary big wide" onClick={() => setEditing({ ...EMPTY })}>
        新增常吃的
      </button>
      {editing && <MealEditor meal={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function MealEditor({ meal, onClose }) {
  const { api } = useData();
  const isNew = !meal.id;
  const [f, setF] = useState({
    ...meal,
    price: String(meal.price ?? ''),
    kcal: meal.kcal == null ? '' : String(meal.kcal),
    protein: meal.protein == null ? '' : String(meal.protein),
  });
  const num = (v) => v.replace(/[^\d]/g, '');
  const toggleSlot = (s) => setF({ ...f, slots: f.slots.includes(s) ? f.slots.filter((x) => x !== s) : [...f.slots, s] });
  const valid = f.name.trim() && f.slots.length && Number(f.price) > 0;
  const save = (e) => {
    e.preventDefault();
    if (!valid) return;
    const data = {
      name: f.name.trim(), slots: f.slots, price: Number(f.price), where: f.where.trim(), plateOk: !!f.plateOk,
      kcal: f.kcal ? Number(f.kcal) : null, protein: f.protein ? Number(f.protein) : null, isSample: false,
    };
    if (isNew) api.add('meals', data);
    else api.update(`meals/${meal.id}`, data);
    onClose();
  };
  return (
    <Sheet title={isNew ? '新增常吃的' : '編輯'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        {meal.isSample && <p className="hint warn">這是範例，熱量是約略值，請照包裝修改。</p>}
        <label>
          名稱
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="例：7-11 雞胸肉＋地瓜" autoFocus={isNew} />
        </label>
        <div>
          <div className="mini">哪一餐（可複選）</div>
          <div className="seg">
            {SLOT_KEYS.map((s) => (
              <button type="button" key={s} className={f.slots.includes(s) ? 'on' : ''} onClick={() => toggleSlot(s)}>
                {SLOTS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="row gap wrap">
          <label className="mini">
            價格
            <input inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: num(e.target.value) })} />
          </label>
          <label className="mini">
            熱量（大卡，可不填）
            <input inputMode="numeric" value={f.kcal} onChange={(e) => setF({ ...f, kcal: num(e.target.value) })} />
          </label>
          <label className="mini">
            蛋白質（克，可不填）
            <input inputMode="numeric" value={f.protein} onChange={(e) => setF({ ...f, protein: num(e.target.value) })} />
          </label>
        </div>
        <label>
          在哪買
          <input value={f.where} onChange={(e) => setF({ ...f, where: e.target.value })} placeholder="例：便利商店、學餐" />
        </label>
        <label className="inline">
          <input type="checkbox" checked={!!f.plateOk} onChange={(e) => setF({ ...f, plateOk: e.target.checked })} />
          符合一餐盤原則（澱粉 1 拳、蛋白質 1 掌、青菜 2 拳）
        </label>
        <div className="row gap">
          <button className="btn primary" type="submit" disabled={!valid}>
            儲存
          </button>
          {!isNew && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (window.confirm(`刪除「${meal.name}」？`)) {
                  api.remove(`meals/${meal.id}`);
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

function Body() {
  const { body, weightLog, api } = useData();
  const t = today();
  const [f, setF] = useState(() => ({ heightCm: '', age: '', sex: '', activity: 1.2, deficit: 400, ...(body || {}) }));
  const [kg, setKg] = useState('');
  const [saved, setSaved] = useState(false);
  const weight = latestWeight(weightLog, t);
  const target = calorieTarget(f, weight);
  const trend = weightTrend(weightLog, t);

  const saveBody = () => {
    api.set('settings/body', {
      heightCm: Number(f.heightCm) || null, age: Number(f.age) || null, sex: f.sex || null,
      activity: Number(f.activity) || 1.2, deficit: Math.min(500, Math.max(300, Number(f.deficit) || 400)),
    }, false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const logWeight = (e) => {
    e.preventDefault();
    const v = Number(kg);
    if (!(v > 20 && v < 300)) return;
    api.set(`weightLog/${t}`, { kg: Math.round(v * 10) / 10 }, false);
    setKg('');
  };

  return (
    <section className="section">
      <p className="muted small">這頁都可以不填，不填的話其他功能照常可以用。資料只存在你自己的帳號裡。</p>

      <h2>量體重</h2>
      <p className="muted small">每週量一次就好（例：週一早上）。看 4 週的趨勢，不要看單次的增減，一天的水分變化很正常。</p>
      <form className="row gap" onSubmit={logWeight}>
        <input className="grow" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d.]/g, ''))} placeholder="今天的體重（公斤）" />
        <button className="btn primary">記錄</button>
      </form>
      <div className="card trend">
        <TrendChart trend={trend} day={t} />
        <div className="row between">
          <strong>近 4 週：{trendLabel(trend.perWeek)}</strong>
          {weight && <span className="muted small">上次量：{shortLabel(weight.date)}</span>}
        </div>
      </div>

      <h2>每日熱量目標</h2>
      <div className="form">
        <div className="row gap wrap">
          <label className="mini">
            身高（公分）
            <input inputMode="numeric" value={f.heightCm ?? ''} onChange={(e) => setF({ ...f, heightCm: e.target.value.replace(/[^\d]/g, '') })} />
          </label>
          <label className="mini">
            年齡
            <input inputMode="numeric" value={f.age ?? ''} onChange={(e) => setF({ ...f, age: e.target.value.replace(/[^\d]/g, '') })} />
          </label>
          <label className="mini">
            性別（公式用）
            <select value={f.sex || ''} onChange={(e) => setF({ ...f, sex: e.target.value })}>
              <option value="">不填</option>
              <option value="female">女</option>
              <option value="male">男</option>
            </select>
          </label>
        </div>
        <label className="mini">
          活動量
          <select value={f.activity} onChange={(e) => setF({ ...f, activity: Number(e.target.value) })}>
            {ACTIVITY.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mini">
          每天少吃多少大卡（300～500）：{f.deficit}
          <input type="range" min="300" max="500" step="50" value={f.deficit} onChange={(e) => setF({ ...f, deficit: Number(e.target.value) })} />
        </label>
        {!weight && <p className="hint warn">先記一次體重，才算得出熱量目標。</p>}
        {target && (
          <div className="alloc">
            <div className="row between sub"><span>基礎代謝</span><span className="num">{target.bmr} 大卡</span></div>
            <div className="row between sub"><span>每日消耗</span><span className="num">{target.tdee} 大卡</span></div>
            <div className="row between"><strong>每日熱量目標</strong><strong className="num">{target.target} 大卡</strong></div>
            {target.floored && <p className="hint warn">每日消耗減 {target.deficit} 會低於基礎代謝，所以用基礎代謝當下限。吃太少會掉肌肉、更容易復胖。</p>}
          </div>
        )}
        <button className="btn primary" onClick={saveBody}>
          {saved ? '已儲存' : '儲存'}
        </button>
        <p className="muted small">用 Mifflin-St Jeor 公式估算，是參考值。</p>
      </div>
    </section>
  );
}

function TrendChart({ trend, day }) {
  const { pts } = trend;
  const w = 300;
  const h = 110;
  const pad = 26;
  if (!pts.length) return <p className="muted small">還沒有紀錄。</p>;
  const kgs = pts.map((p) => p.kg);
  const lo = Math.floor(Math.min(...kgs) - 0.5);
  const hi = Math.ceil(Math.max(...kgs) + 0.5);
  const x = (p) => pad + (p.x / 27) * (w - pad - 8);
  const y = (kg) => 8 + ((hi - kg) / (hi - lo || 1)) * (h - 30);
  const startLabel = shortLabel(addDays(day, -27));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trend-chart" role="img" aria-label={`近 4 週體重 ${pts.length} 筆`}>
      <text x="2" y={y(hi) + 4} className="axis">{hi}</text>
      <text x="2" y={y(lo) + 4} className="axis">{lo}</text>
      <line x1={pad} x2={w - 8} y1={y(lo)} y2={y(lo)} className="grid" />
      <polyline points={pts.map((p) => `${x(p)},${y(p.kg)}`).join(' ')} className="trend-line" fill="none" />
      {pts.map((p) => (
        <circle key={p.date} cx={x(p)} cy={y(p.kg)} r="3" className="trend-dot" />
      ))}
      <text x={pad} y={h - 4} className="axis">{startLabel}</text>
      <text x={w - 8} y={h - 4} className="axis" textAnchor="end">今天</text>
    </svg>
  );
}

