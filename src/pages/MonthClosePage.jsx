import { useParams, useNavigate, Link } from 'react-router-dom';
import { serverTimestamp } from 'firebase/firestore';
import { useData } from '../data.jsx';
import { monthRange, monthLabel, shortLabel, dayInMonth } from '../lib/date.js';
import { fixedPaidId } from '../lib/plan.js';
import { money } from '../components/ui.jsx';
import { payFixed } from '../components/editors.jsx';
import { MonthSummary } from './MoneyPage.jsx';
import BalanceCheck from '../components/BalanceCheck.jsx';
import { runExport } from '../lib/exporters.js';

export default function MonthClosePage() {
  const { month } = useParams();
  const data = useData();
  const { fixedItems, fixedPaid, monthClose, api } = data;
  const nav = useNavigate();
  if (!/^\d{4}-\d{2}$/.test(month)) return <div className="page">月份格式不對</div>;
  const { from, to } = monthRange(month);
  const unpaid = fixedItems.filter((f) => !fixedPaid.has(fixedPaidId(month, f.id)));
  const closed = monthClose[month];

  return (
    <div className="page">
      <header className="page-head">
        <h1>{month.slice(0, 4)} 年 {monthLabel(month)}月結</h1>
        {closed && <span className="chip ok">已結帳</span>}
      </header>
      <ol className="steps">
        <li>
          <h3>對帳：每個帳戶到 {shortLabel(to)} 的餘額</h3>
          <BalanceCheck date={to} />
        </li>
        <li>
          <h3>檢查固定支出</h3>
          {unpaid.length ? (
            <ul className="list">
              {unpaid.map((f) => (
                <li key={f.id} className="row between">
                  <span>
                    {f.name} <span className="muted">{shortLabel(dayInMonth(month, f.day))}</span>
                  </span>
                  <span className="row gap">
                    <span className="num">{money(f.amount)}</span>
                    <button className="btn small" onClick={() => payFixed(data, f, month)}>
                      已付
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint ok">{monthLabel(month)}的固定支出都付了。</p>
          )}
        </li>
        <li>
          <h3>{monthLabel(month)}總結</h3>
          <MonthSummary mKey={month} />
        </li>
        <li>
          <h3>匯出{monthLabel(month)}的記帳 CSV</h3>
          <button className="btn" onClick={() => runExport(data, 'ledger', from, to)}>
            匯出 {from} ～ {to}
          </button>
        </li>
        <li>
          <h3>完成</h3>
          {closed ? (
            <p className="hint ok">這個月已經結帳。之後修改這個月的紀錄會先確認一次。</p>
          ) : (
            <button
              className="btn primary big"
              onClick={() => {
                api.set(`monthClose/${month}`, { doneAt: serverTimestamp() }, false);
                nav('/');
              }}
            >
              {monthLabel(month)}帳已完成
            </button>
          )}
        </li>
      </ol>
      <Link to="/" className="link">
        回今天
      </Link>
    </div>
  );
}
