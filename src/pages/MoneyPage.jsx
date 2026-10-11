import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, monthKey, prevMonthKey, nextMonthKey, monthRange, shortLabel, dayInMonth, monthLabel } from '../lib/date.js';
import {
  orderCategories, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, accountBalances, budgetProgress,
  livingSummary, monthTotals, allocation, ADJUST,
} from '../lib/budget.js';
import { fixedPaidId } from '../lib/plan.js';
import { money, Bar, Sheet, Icon } from '../components/ui.jsx';
import { payFixed } from '../components/editors.jsx';

const TABS = [
  ['add', '記一筆'],
  ['overview', '總覽'],
  ['accounts', '帳戶'],
  ['fixed', '固定支出'],
  ['alloc', '薪資分配'],
];

export default function MoneyPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'add';
  return (
    <div className="page">
      <header className="page-head">
        <h1>記帳</h1>
        <Link to="/money/reconcile" className="btn small">
          對帳
        </Link>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setParams(k === 'add' ? {} : { tab: k })}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'add' && <QuickAdd />}
      {tab === 'overview' && <Overview />}
      {tab === 'accounts' && <Accounts />}
      {tab === 'fixed' && <Fixed />}
      {tab === 'alloc' && <Allocation />}
    </div>
  );
}

export function deleteExpense(data, e) {
  const { api, confirmClosed } = data;
  if (!confirmClosed(e.date)) return false;
  if (!window.confirm('刪除這筆紀錄？')) return false;
  const ops = [{ remove: `expenses/${e.id}` }];
  if (e.fixedItemId && e.id.startsWith('fixed-')) ops.push({ remove: `fixedPaid/${e.id.slice(6)}` });
  api.batch(ops);
  return true;
}

function AccountSelect({ value, onChange, label, exclude }) {
  const { accounts } = useData();
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {accounts
        .filter((a) => a.id !== exclude)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
    </select>
  );
}

function QuickAdd() {
  const data = useData();
  const { api, budget, defaultAccount, confirmClosed, expenses, accountsById } = data;
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState(defaultAccount);
  const [toAccount, setToAccount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const [toast, setToast] = useState(null);
  const [editing, setEditing] = useState(null);
  const amountRef = useRef(null);

  useEffect(() => {
    amountRef.current?.focus();
  }, [type]);
  useEffect(() => {
    if (!account && defaultAccount) setAccount(defaultAccount);
  }, [defaultAccount, account]);

  const cats =
    type === 'income'
      ? budget.incomeCategories || DEFAULT_INCOME_CATEGORIES
      : orderCategories(budget.expenseCategories || DEFAULT_EXPENSE_CATEGORIES);
  const amt = Math.round(Number(amount));
  const valid = amt > 0;

  const save = (category) => {
    if (!valid) {
      amountRef.current?.focus();
      return;
    }
    if (!confirmClosed(date)) return;
    const to = type === 'transfer' ? toAccount || data.accounts.find((a) => a.id !== account)?.id : null;
    if (type === 'transfer' && (!to || to === account)) return;
    const id = api.add('expenses', {
      date, amount: amt, type, category: type === 'transfer' ? '' : category, account, toAccount: to,
      fixedItemId: null, note: note.trim(),
    });
    setToast({ id, text: type === 'transfer' ? `已轉帳 ${money(amt)}` : `已記：${category} ${money(amt)}` });
    setAmount('');
    setNote('');
    amountRef.current?.focus();
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const recent = expenses
    .filter((e) => e.date <= today())
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .slice(0, 30);

  return (
    <>
      <section className="quick card">
        <div className="seg">
          {[
            ['expense', '支出'],
            ['income', '收入'],
            ['transfer', '轉帳'],
          ].map(([k, l]) => (
            <button key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="amount-row">
          <span className="currency">$</span>
          <input
            ref={amountRef}
            className="amount"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && type === 'transfer' && save('')}
            aria-label="金額"
          />
        </div>
        {type === 'transfer' ? (
          <>
            <div className="row gap wrap">
              <label className="mini">
                從
                <AccountSelect value={account} onChange={setAccount} label="轉出帳戶" />
              </label>
              <label className="mini">
                到
                <AccountSelect
                  value={toAccount || data.accounts.find((a) => a.id !== account)?.id}
                  onChange={setToAccount}
                  label="轉入帳戶"
                  exclude={account}
                />
              </label>
            </div>
            <button className="btn primary big" disabled={!valid} onClick={() => save('')}>
              完成轉帳
            </button>
          </>
        ) : (
          <div className="cat-grid">
            {cats.map((c) => (
              <button key={c} className="cat" disabled={!valid} onClick={() => save(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="row gap wrap quick-extra">
          {type !== 'transfer' && (
            <label className="mini">
              帳戶
              <AccountSelect value={account} onChange={setAccount} label="帳戶" />
            </label>
          )}
          <label className="mini">
            日期
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
          </label>
          <input className="grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註（可不填）" />
        </div>
      </section>

      {toast && (
        <div className="toast">
          {toast.text}
          <button className="link" onClick={() => { api.remove(`expenses/${toast.id}`); setToast(null); }}>
            復原
          </button>
        </div>
      )}

      <section className="section">
        <h2>最近的紀錄</h2>
        <ExpenseList items={recent} onEdit={setEditing} accountsById={accountsById} />
        <Link to="/money?tab=overview" className="link">
          看本月總覽 →
        </Link>
      </section>
      {editing && <ExpenseEditor expense={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function ExpenseList({ items, onEdit, accountsById }) {
  if (!items.length) return <p className="muted">還沒有紀錄。</p>;
  return (
    <ul className="list ledger">
      {items.map((e) => (
        <li key={e.id} onClick={() => onEdit(e)} className={`ledger-row ${e.type}`}>
          <span className="ld-date">{shortLabel(e.date)}</span>
          <span className="ld-cat">
            {e.type === 'transfer'
              ? `${accountsById[e.account]?.name || '?'} → ${accountsById[e.toAccount]?.name || '?'}`
              : e.category}
            {e.note && <span className="muted"> ・{e.note}</span>}
          </span>
          <span className="ld-amt num">
            {e.type === 'income' ? '+' : e.type === 'expense' ? '−' : ''}
            {money(e.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ExpenseEditor({ expense, onClose }) {
  const data = useData();
  const { api, budget, confirmClosed } = data;
  const [f, setF] = useState({ ...expense, amount: String(expense.amount) });
  const cats =
    f.type === 'income' ? budget.incomeCategories || DEFAULT_INCOME_CATEGORIES : [...(budget.expenseCategories || DEFAULT_EXPENSE_CATEGORIES), ADJUST, '固定支出'];
  const save = (e) => {
    e.preventDefault();
    const amount = Math.round(Number(f.amount));
    if (!(amount > 0)) return;
    if (!confirmClosed(expense.date) || (f.date !== expense.date && !confirmClosed(f.date))) return;
    api.update(`expenses/${expense.id}`, {
      date: f.date, amount, type: f.type, category: f.type === 'transfer' ? '' : f.category, account: f.account,
      toAccount: f.type === 'transfer' ? f.toAccount : null, note: f.note || '',
    });
    onClose();
  };
  return (
    <Sheet title="編輯紀錄" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          類型
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
            <option value="transfer">轉帳</option>
          </select>
        </label>
        <label>
          金額
          <input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, '') })} />
        </label>
        <label>
          日期
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </label>
        {f.type !== 'transfer' && (
          <label>
            分類
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {[...new Set([f.category, ...cats])].filter(Boolean).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          {f.type === 'transfer' ? '從' : '帳戶'}
          <AccountSelect value={f.account} onChange={(account) => setF({ ...f, account })} />
        </label>
        {f.type === 'transfer' && (
          <label>
            到
            <AccountSelect value={f.toAccount} onChange={(toAccount) => setF({ ...f, toAccount })} exclude={f.account} />
          </label>
        )}
        <label>
          備註
          <input value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
        <div className="row gap">
          <button className="btn primary" type="submit">
            儲存
          </button>
          <button type="button" className="btn danger" onClick={() => deleteExpense(data, expense) && onClose()}>
            刪除
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function MonthSwitch({ mKey, setMKey }) {
  return (
    <div className="month-switch">
      <button className="icon-btn" onClick={() => setMKey(prevMonthKey(mKey))} aria-label="上個月">
        <Icon name="chevL" />
      </button>
      <strong>
        {mKey.slice(0, 4)} 年 {Number(mKey.slice(5))} 月
      </strong>
      <button className="icon-btn" onClick={() => setMKey(nextMonthKey(mKey))} aria-label="下個月">
        <Icon name="chevR" />
      </button>
    </div>
  );
}

export function MonthSummary({ mKey }) {
  const { budget, fixedItems, expenses } = useData();
  const t = today();
  const isCurrent = mKey === monthKey(t);
  const { to } = monthRange(mKey);
  const living = livingSummary(budget, fixedItems, expenses, isCurrent ? t : to);
  const totals = monthTotals(expenses, mKey, budget.investment?.toAccount);
  const progress = budgetProgress(budget, fixedItems, expenses, mKey);
  return (
    <>
      <div className="summary-grid">
        <div className="card stat">
          <div className="big">{money(living.spent)}</div>
          <div className="label">生活費已花</div>
        </div>
        <div className={`card stat ${living.left < 0 ? 'over' : ''}`}>
          <div className="big">{money(living.left)}</div>
          <div className="label">生活費剩下</div>
        </div>
        {isCurrent && (
          <div className="card stat">
            <div className="big">{money(living.perDay)}</div>
            <div className="label">平均每天還能花（剩 {living.daysLeft} 天）</div>
          </div>
        )}
        <div className="card stat">
          <div className="big">{money(totals.invested)}</div>
          <div className="label">定期定額已轉</div>
        </div>
        <div className="card stat">
          <div className="big">{money(totals.income)}</div>
          <div className="label">總收入</div>
        </div>
        <div className="card stat">
          <div className="big">{money(totals.expense)}</div>
          <div className="label">總支出</div>
        </div>
        <div className={`card stat ${totals.net < 0 ? 'over' : ''}`}>
          <div className="big">{money(totals.net)}</div>
          <div className="label">結餘</div>
        </div>
      </div>
      <h3>分類預算</h3>
      <div className="bars">
        {progress.rows.map((r) => (
          <Bar key={r.name} row={r} />
        ))}
      </div>
    </>
  );
}

function Overview() {
  const { expenses, accountsById } = useData();
  const [mKey, setMKey] = useState(monthKey(today()));
  const [editing, setEditing] = useState(null);
  const { from, to } = monthRange(mKey);
  const items = expenses
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return (
    <section className="section">
      <MonthSwitch mKey={mKey} setMKey={setMKey} />
      <MonthSummary mKey={mKey} />
      <h3>這個月的紀錄（{items.length} 筆）</h3>
      <ExpenseList items={items} onEdit={setEditing} accountsById={accountsById} />
      {editing && <ExpenseEditor expense={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function Accounts() {
  const { accounts, expenses } = useData();
  const bal = accountBalances(accounts, expenses);
  const total = Object.values(bal).reduce((s, v) => s + v, 0);
  return (
    <section className="section">
      <ul className="list accounts">
        {accounts.map((a) => (
          <li key={a.id} className="row between">
            <span>
              {a.name}
              {a.isDefault && <span className="chip">預設</span>}
            </span>
            <span className={`num ${bal[a.id] < 0 ? 'neg' : ''}`}>{money(bal[a.id])}</span>
          </li>
        ))}
        <li className="row between total">
          <strong>合計</strong>
          <strong className="num">{money(total)}</strong>
        </li>
      </ul>
      <p className="muted">餘額 = 初始餘額 + 收入 − 支出 ± 轉帳。帳戶和初始餘額在設定頁修改。</p>
    </section>
  );
}

function Fixed() {
  const data = useData();
  const { fixedItems, fixedPaid } = data;
  const mKey = monthKey(today());
  const items = fixedItems.slice().sort((a, b) => (a.day || 0) - (b.day || 0));
  return (
    <section className="section">
      <h2>{monthLabel(mKey)}固定支出</h2>
      {!items.length && <p className="muted">還沒有固定支出。到設定頁新增房租、電話費、訂閱…</p>}
      <ul className="list">
        {items.map((f) => {
          const paid = fixedPaid.has(fixedPaidId(mKey, f.id));
          return (
            <li key={f.id} className="row between fixed-row">
              <span>
                <strong>{f.name}</strong> <span className="muted">每月 {f.day} 號・{shortLabel(dayInMonth(mKey, f.day))}</span>
              </span>
              <span className="row gap">
                <span className="num">{money(f.amount)}</span>
                {paid ? (
                  <span className="chip ok">已付</span>
                ) : (
                  <button className="btn small" onClick={() => payFixed(data, f, mKey)}>
                    已付
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <Link to="/settings#fixed" className="link">
        編輯固定支出 →
      </Link>
    </section>
  );
}

function Allocation() {
  const { budget, fixedItems, allocations, accountsById, api, expenses } = useData();
  const mKey = monthKey(today());
  const a = allocation(budget, fixedItems);
  const done = allocations[mKey];
  const { from, to } = monthRange(mKey);
  const hasSalary = expenses.some((e) => e.type === 'income' && e.category === '薪水' && e.date >= from && e.date <= to);
  const [recordSalary, setRecordSalary] = useState(!hasSalary);
  const inv = budget.investment || {};
  const ready = a.salary > 0 && budget.salaryAccount && inv.toAccount;

  const run = () => {
    if (a.living < 0 || done || !ready) return;
    const ops = [];
    const date = today();
    if (recordSalary) {
      ops.push({
        add: 'expenses', id: `alloc-${mKey}-salary`,
        data: { date, amount: a.salary, type: 'income', category: '薪水', account: budget.salaryAccount, toAccount: null, fixedItemId: null, note: '薪水' },
      });
    }
    if (a.investment > 0) {
      ops.push({
        add: 'expenses', id: `alloc-${mKey}-invest`,
        data: { date, amount: a.investment, type: 'transfer', category: '', account: budget.salaryAccount, toAccount: inv.toAccount, fixedItemId: null, note: '定期定額' },
      });
    }
    ops.push({ set: `allocations/${mKey}`, data: { doneAt: new Date(), ...a }, merge: false });
    api.batch(ops);
  };

  return (
    <section className="section">
      <h2>{monthLabel(mKey)}薪資分配</h2>
      <div className="alloc">
        <div className="row between">
          <span>薪水（{accountsById[budget.salaryAccount]?.name || '未設定帳戶'}）</span>
          <strong className="num">{money(a.salary)}</strong>
        </div>
        <div className="row between sub">
          <span>
            定期定額 → {accountsById[inv.toAccount]?.name || '未設定'}
          </span>
          <span className="num">{money(a.investment)}</span>
        </div>
        <div className="row between sub">
          <span>固定支出（{fixedItems.length} 項）</span>
          <span className="num">{money(a.fixed)}</span>
        </div>
        <div className={`row between sub ${a.living < 0 ? 'neg' : ''}`}>
          <strong>生活費</strong>
          <strong className="num">{money(a.living)}</strong>
        </div>
      </div>
      {!ready && (
        <p className="hint warn">
          先到 <Link to="/settings#budget">設定</Link> 填薪水、薪資戶和定期定額要轉到的帳戶。
        </p>
      )}
      {a.living < 0 && <p className="hint over">固定支出太多：生活費是 {money(a.living)}，不能執行分配。</p>}
      {done ? (
        <p className="hint ok">這個月已經分配過了。</p>
      ) : (
        <>
          <label className="inline">
            <input type="checkbox" checked={recordSalary} onChange={(e) => setRecordSalary(e.target.checked)} />
            同時記一筆薪水收入 {money(a.salary)}
            {hasSalary && <span className="muted">（這個月已經記過薪水）</span>}
          </label>
          <button className="btn primary big" disabled={a.living < 0 || !ready} onClick={run}>
            執行分配
          </button>
        </>
      )}
    </section>
  );
}
