import { useState } from 'react';
import { useData } from '../data.jsx';
import { accountBalances, ADJUST } from '../lib/budget.js';
import { money } from './ui.jsx';
import { today } from '../lib/date.js';

// 每個帳戶：網站上的餘額 vs. 實際餘額，不一致就記一筆「調整」
export default function BalanceCheck({ date = today() }) {
  const { accounts, expenses, api, confirmClosed } = useData();
  const bal = accountBalances(accounts, expenses.filter((e) => e.date <= date));
  const [actual, setActual] = useState({});
  const [notes, setNotes] = useState({});

  const adjust = (a) => {
    const real = Number(actual[a.id]);
    const diff = real - bal[a.id];
    if (!Number.isFinite(real) || diff === 0) return;
    if (!confirmClosed(date)) return;
    api.add('expenses', {
      date, amount: Math.abs(diff), type: diff > 0 ? 'income' : 'expense', category: ADJUST, account: a.id,
      toAccount: null, fixedItemId: null, note: notes[a.id] || '對帳調整',
    });
    setActual({ ...actual, [a.id]: '' });
    setNotes({ ...notes, [a.id]: '' });
  };

  return (
    <ul className="list balance-check">
      {accounts.map((a) => {
        const v = actual[a.id] ?? '';
        const diff = v === '' ? 0 : Number(v) - bal[a.id];
        return (
          <li key={a.id}>
            <div className="row between">
              <strong>{a.name}</strong>
              <span className="muted">網站上：<span className="num">{money(bal[a.id])}</span></span>
            </div>
            <div className="row gap">
              <input
                inputMode="numeric"
                placeholder="實際餘額"
                value={v}
                onChange={(e) => setActual({ ...actual, [a.id]: e.target.value.replace(/[^\d-]/g, '') })}
                aria-label={`${a.name} 實際餘額`}
              />
              {v !== '' && diff === 0 && <span className="chip ok">一致</span>}
            </div>
            {v !== '' && diff !== 0 && (
              <div className="row gap wrap adjust">
                <span className="hint warn">差 {money(diff)}</span>
                <input className="grow" placeholder="備註（例：漏記的晚餐）" value={notes[a.id] || ''} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} />
                <button className="btn small" onClick={() => adjust(a)}>
                  記一筆調整
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
