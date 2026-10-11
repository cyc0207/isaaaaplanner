import { useEffect, useRef, useState } from 'react';
import { wheelSegments, pickSegment } from '../lib/meals.js';
import { money } from './ui.jsx';

const COLORS = ['var(--wheel-1)', 'var(--wheel-2)', 'var(--wheel-3)', 'var(--wheel-4)'];
const SPIN_MS = 2600;

function arc(cx, cy, r, a0, a1) {
  // 0 度在正上方，順時針
  const p = (a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1} Z`;
}

const short = (s) => (s.length > 7 ? `${s.slice(0, 6)}…` : s);

// 轉盤：轉完呼叫 onResult(meal)。點轉盤可以直接跳到結果。
export default function Wheel({ options, onResult }) {
  const segs = wheelSegments(options);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const target = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const finish = () => {
    clearTimeout(timer.current);
    setSpinning(false);
    if (target.current) onResult(target.current);
    target.current = null;
  };

  const spin = () => {
    if (spinning) return finish();
    if (segs.length < 2) return;
    const seg = pickSegment(segs, Math.random());
    target.current = seg.meal;
    // 指針在正上方：把那一格的中間轉到 0 度
    const mid = (seg.start + seg.end) / 2;
    const base = rotation - (rotation % 360);
    setRotation(base + 360 * 5 + (360 - mid));
    setSpinning(true);
    timer.current = setTimeout(finish, SPIN_MS);
  };

  const size = 260;
  const c = size / 2;
  const r = c - 6;
  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden="true" />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="wheel"
        onClick={spinning ? finish : undefined}
        style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.8, 0.2, 1)` : 'none' }}
        role="img"
        aria-label={`轉盤：${options.map((m) => m.name).join('、')}`}
      >
        {segs.map((s, i) => {
          const mid = (s.start + s.end) / 2;
          const tr = r * 0.62;
          const x = c + tr * Math.sin((mid * Math.PI) / 180);
          const y = c - tr * Math.cos((mid * Math.PI) / 180);
          return (
            <g key={s.meal.id}>
              <path d={segs.length === 1 ? '' : arc(c, c, r, s.start, s.end)} fill={COLORS[i % COLORS.length]} className="wheel-seg" />
              <text x={x} y={y} transform={`rotate(${mid < 180 ? mid - 90 : mid + 90} ${x} ${y})`} textAnchor="middle" dominantBaseline="central" className="wheel-text">
                {short(s.meal.name)}
              </text>
            </g>
          );
        })}
        <circle cx={c} cy={c} r={r} className="wheel-rim" />
        <circle cx={c} cy={c} r="14" fill="var(--mustard)" stroke="var(--line)" strokeWidth="2" />
      </svg>
      <button className="btn primary big" onClick={spin} disabled={segs.length < 2}>
        {spinning ? '直接看結果' : '轉！'}
      </button>
      <p className="muted small center">{options.length} 個選項・符合一餐盤原則的格子大一倍</p>
    </div>
  );
}

export function MealLine({ meal }) {
  return (
    <span className="meal-line">
      <strong>{meal.name}</strong>
      <span className="muted">
        {money(meal.price)}
        {Number(meal.kcal) > 0 && `・${meal.isSample ? '約 ' : ''}${meal.kcal} 大卡`}
        {Number(meal.protein) > 0 && `・蛋白質 ${meal.protein}g`}
        {meal.where && `・${meal.where}`}
      </span>
    </span>
  );
}
