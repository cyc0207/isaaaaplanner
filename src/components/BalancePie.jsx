import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { balancePie } from '../lib/budget.js';
import { money } from './ui.jsx';

const COLORS = ['var(--accent)', 'var(--mustard)', 'var(--teal)', 'var(--over)', 'var(--muted)'];

// 首頁的「目前餘額」甜甜圈：實色、細墨線分隔
export default function BalancePie({ day }) {
  const { accounts, expenses } = useData();
  const pie = balancePie(accounts, expenses, day);
  const size = 128;
  const r = 46;
  const c = 2 * Math.PI * r;
  const sum = pie.slices.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  const title = pie.mode === 'balance' ? '目前餘額' : '本月支出';
  return (
    <Link to={pie.mode === 'balance' ? '/money?tab=accounts' : '/money'} className="card stat wide balance-pie" aria-label={`${title} ${money(pie.total)}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pie" role="img" aria-label={pie.slices.map((s) => `${s.name} ${money(s.value)}`).join('、') || '沒有資料'}>
        <circle cx={size / 2} cy={size / 2} r={r} className="pie-bg" strokeWidth="22" fill="none" />
        {sum > 0 && pie.slices.map((s, i) => {
          const len = (s.value / sum) * c;
          const el = (
            <circle key={s.id} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="22"
              stroke={COLORS[i % COLORS.length]} className="pie-seg"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
          acc += len;
          return el;
        })}
        <circle cx={size / 2} cy={size / 2} r={r + 11} className="pie-rim" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r - 11} className="pie-rim" fill="none" />
        <text x="50%" y="46%" textAnchor="middle" className="pie-total">{money(pie.total)}</text>
        <text x="50%" y="62%" textAnchor="middle" className="pie-cap">{pie.mode === 'balance' ? '總餘額' : '本月花了'}</text>
      </svg>
      <div className="pie-side">
        <div className="label">{title}</div>
        {pie.slices.length ? (
          <ul className="pie-legend">
            {pie.slices.map((s, i) => (
              <li key={s.id}>
                <i style={{ background: COLORS[i % COLORS.length] }} />
                <span className="pie-name">{s.name}</span>
                <span className="pie-amt">{money(s.value)}<small>{Math.round((s.value / sum) * 100)}%</small></span>
              </li>
            ))}
            {pie.negative.map((s) => (
              <li key={s.id} className="neg">
                <i className="pie-neg" />
                <span className="pie-name">{s.name}</span>
                <span className="pie-amt">{money(s.value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pie-note">還沒有餘額或支出，先到記帳的「帳戶」填初始餘額。</p>
        )}
        {pie.mode === 'spend' && pie.slices.length > 0 && <p className="pie-note">帳戶還沒有餘額，先顯示本月支出分類。</p>}
      </div>
    </Link>
  );
}
