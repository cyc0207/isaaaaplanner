import { Link, useNavigate } from 'react-router-dom';
import { serverTimestamp } from 'firebase/firestore';
import { useData } from '../data.jsx';
import { today } from '../lib/date.js';
import { lastReconcile } from '../lib/plan.js';
import BalanceCheck from '../components/BalanceCheck.jsx';

export default function ReconcilePage() {
  const { reconcile, reconcileLog, api } = useData();
  const nav = useNavigate();
  const day = today();
  const last = lastReconcile(reconcileLog, day);
  const doneToday = reconcileLog.includes(day);
  return (
    <div className="page">
      <header className="page-head">
        <h1>對帳</h1>
        <span className="muted">{last ? `上次對帳：${last.daysAgo} 天前` : '還沒有對帳紀錄'}</span>
      </header>
      <ol className="steps">
        <li>
          <h3>打開 App 看消費紀錄</h3>
          <div className="shortcuts">
            {(reconcile.shortcuts || []).map((s) => (
              <a key={s.name + s.url} href={s.url} className="btn">
                {s.name}
              </a>
            ))}
          </div>
          {!(reconcile.shortcuts || []).length && (
            <Link to="/settings#reconcile" className="link">
              到設定新增捷徑（名稱＋網址）
            </Link>
          )}
        </li>
        <li>
          <h3>補記漏掉的</h3>
          <Link to="/money" className="btn">
            去記一筆
          </Link>
        </li>
        <li>
          <h3>每個帳戶的實際餘額和網站比對</h3>
          <BalanceCheck />
        </li>
        <li>
          <h3>完成</h3>
          {doneToday ? (
            <p className="hint ok">今天已經對過帳了。</p>
          ) : (
            <button
              className="btn primary big"
              onClick={() => {
                api.set(`reconcileLog/${day}`, { doneAt: serverTimestamp() }, false);
                nav('/');
              }}
            >
              對帳完成
            </button>
          )}
        </li>
      </ol>
    </div>
  );
}
