import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, weekStart } from '../lib/date.js';
import { useFoodLog } from './FoodLog.jsx';
import { drinkOdds, drinkSegments } from '../lib/drinks.js';
import Wheel from './Wheel.jsx';
import { Sheet } from './ui.jsx';

// 今天要不要喝飲料：預算快用完、全糖喝太多時，「不喝」的格子會變多
export default function DrinkWheel() {
  const { budget, expenses, uid } = useData();
  const day = today();
  const logs = useFoodLog(uid, weekStart(day)) || [];
  const odds = drinkOdds({ budget, expenses, day, logs });
  const segs = drinkSegments(odds);
  const [result, setResult] = useState(null);
  const total = odds.drink + odds.skip;

  return (
    <section className="section">
      <div className="card next-head">
        <strong>今天要不要喝飲料？</strong>
        <span className="muted small">
          喝 {odds.drink} 格・不喝 {odds.skip} 格（喝的機率約 {Math.round((odds.drink / total) * 100)}%）
        </span>
        <ul className="drink-reasons">
          {odds.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <Wheel key={segs.length} options={segs} onResult={setResult} caption="格子比例依本週飲料預算、杯數（含飲料打卡）和全糖杯數調整" />
      {result && (
        <Sheet title={result.yes ? '喝！' : '今天不喝'} onClose={() => setResult(null)}>
          {result.yes ? (
            <>
              <p className="wheel-result">
                今天可以喝一杯。
                {odds.fullSugar >= 2 ? '這週全糖喝比較多，這杯選無糖或微糖。' : ''}
              </p>
              <Link className="btn primary big wide" to="/food?tab=near&kind=drink">
                轉附近的飲料店
              </Link>
              <Link className="btn big wide" to="/money?drink=1">
                已經買了，記一筆飲料
              </Link>
            </>
          ) : (
            <>
              <p className="wheel-result">
                今天喝水或無糖茶{odds.perItem ? `，省下大約 $${odds.perItem}` : ''}。
              </p>
              <button className="btn big wide" onClick={() => setResult(null)}>
                好吧
              </button>
            </>
          )}
        </Sheet>
      )}
    </section>
  );
}
