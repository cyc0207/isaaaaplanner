import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, shortLabel } from '../lib/date.js';
import { investDashboard, INVEST_WORD } from '../lib/invest.js';
import { money } from './ui.jsx';

const pct = (r) => (r == null ? '—' : `${Math.round(r * 1000) / 10}%`);

// 投資儀表板：分類或備註有「定期定額」的支出，加上薪資分配轉到投資帳戶的錢
export default function InvestDashboard() {
  const { expenses, budget } = useData();
  const d = investDashboard({ expenses, budget, day: today() });
  const maxMonth = Math.max(...d.history.map((h) => h.amount), 1);
  const maxTarget = Math.max(...d.targets.map((t) => t.total), 1);

  return (
    <section className="section invest">
      <div className="summary-grid">
        <div className="card stat">
          <div className="big">{money(d.month)}</div>
          <div className="label">本月投入</div>
        </div>
        <div className="card stat">
          <div className="big">{money(d.total)}</div>
          <div className="label">累計投入</div>
        </div>
        <div className="card stat">
          <div className="big">{pct(d.salaryRatio)}</div>
          <div className="label">占薪水{d.salary ? `（${money(d.salary)}）` : '（還沒填薪水）'}</div>
        </div>
        <div className="card stat">
          <div className="big">{pct(d.outRatio)}</div>
          <div className="label">占本月花出去的錢（{money(d.monthOut)}）</div>
        </div>
      </div>
      {d.salaryRatio != null && (
        <div className="invest-meter" role="img" aria-label={`本月投入占薪水 ${pct(d.salaryRatio)}`}>
          <div className="invest-meter-fill" style={{ width: `${Math.min(100, d.salaryRatio * 100)}%` }} />
        </div>
      )}

      <h3>最近 6 個月</h3>
      <div className="card invest-chart" role="img" aria-label={d.history.map((h) => `${Number(h.key.slice(5))} 月 ${money(h.amount)}`).join('、')}>
        {d.history.map((h) => (
          <div key={h.key} className="invest-col" title={`${Number(h.key.slice(5))} 月 ${money(h.amount)}`}>
            <span className="invest-val">{h.amount ? money(h.amount) : ''}</span>
            <div className="invest-bar" style={{ height: `${(h.amount / maxMonth) * 100}%` }} />
            <span className="invest-mon">{Number(h.key.slice(5))} 月</span>
          </div>
        ))}
      </div>
      {d.avg > 0 && <p className="muted small">有投入的月份平均每月 {money(d.avg)}。</p>}

      <h3>各標的</h3>
      {d.targets.length ? (
        <ul className="invest-targets">
          {d.targets.map((t) => (
            <li key={t.name} className="card">
              <div className="row between">
                <strong>{t.name}</strong>
                <span className="num">{money(t.total)}</span>
              </div>
              <div className="invest-tbar">
                <div style={{ width: `${(t.total / maxTarget) * 100}%` }} />
              </div>
              <span className="muted small">
                共 {t.count} 筆・本月 {money(t.month)}・占累計 {pct(d.total ? t.total / d.total : null)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          還沒有投資紀錄。記帳時分類或備註寫「{INVEST_WORD}」（例如分類「0056 {INVEST_WORD}」），就會自動算進來。
        </p>
      )}

      {d.recent.length > 0 && (
        <>
          <h3>最近幾筆</h3>
          <ul className="list invest-recent">
            {d.recent.map((e) => (
              <li key={e.id} className="row between">
                <span>
                  {shortLabel(e.date)} {e.type === 'transfer' ? '薪資分配' : e.category}
                  {e.note && e.type !== 'transfer' ? <span className="muted small">・{e.note}</span> : null}
                </span>
                <span className="num">{money(e.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">
        分類或備註有「{INVEST_WORD}」的支出算投資，不算生活費；<Link to="/money?tab=alloc">薪資分配</Link>轉到投資帳戶的錢也算進來。
      </p>
    </section>
  );
}
