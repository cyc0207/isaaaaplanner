import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { useData } from '../data.jsx';
import { today, monthKey, monthRange, WEEKDAY_NAMES, WEEKDAY_KEYS } from '../lib/date.js';
import {
  categoryBudgets, allocation, parseRatio, formatRatio, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES,
} from '../lib/budget.js';
import { parseRule } from '../lib/plan.js';
import { money, Icon } from '../components/ui.jsx';
import ImportExport from '../components/ImportExport.jsx';
import { REMINDER_TIMES, DEFAULT_TIME, icsPath, googleCalendarUrl } from '../lib/reminder.js';
import { isAndroid } from '../lib/inapp.js';
import { ScheduleEditor, ScheduleReminder } from '../components/Mission.jsx';
import { getSchedule } from '../lib/mission.js';

export default function SettingsPage({ user }) {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);
  return (
    <div className="page">
      <header className="page-head">
        <h1>設定</h1>
      </header>
      <nav className="settings-nav">
        {[
          ['reminder', '每天提醒'], ['english', '英文課表'], ['accounts', '帳戶'], ['budget', '預算'], ['fixed', '固定支出'], ['reconcile', '對帳'],
          ['habits', '每日固定'], ['recurring', '每週固定'], ['import', '匯入／匯出'], ['errors', '錯誤紀錄'],
        ].map(([id, l]) => (
          <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}>
            {l}
          </a>
        ))}
      </nav>
      <ReminderSettings />
      <EnglishScheduleSettings />
      <AccountsSettings />
      <BudgetSettings />
      <FixedSettings />
      <ReconcileSettings />
      <HabitSettings />
      <RecurringSettings />
      <section className="section" id="import">
        <h2>匯入／匯出</h2>
        <ImportExport />
      </section>
      <ErrorSettings />
      <section className="section">
        <h2>帳號</h2>
        <p className="muted">已登入：{user.email}</p>
        <button className="btn" onClick={() => signOut(auth)}>
          登出
        </button>
        <p className="muted small">測試用：網址後面加 <code>?today=2026-11-01</code> 可以假裝今天是那一天。</p>
      </section>
    </div>
  );
}

// Android Chrome 會先送出「可以安裝」事件，存起來讓按鈕叫出安裝視窗
let installEvent = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
}

function EnglishScheduleSettings() {
  const { englishSchedule } = useData();
  return (
    <section className="section" id="english">
      <h2>英文課表</h2>
      <p className="muted">每天的英文任務照這張表派。首頁和「學習 › 英文 › 任務」會顯示今天要做的事。</p>
      <ScheduleEditor />
      <ScheduleReminder schedule={getSchedule(englishSchedule)} />
    </section>
  );
}

function ReminderSettings() {
  const [time, setTime] = useState(() => {
    try { return localStorage.getItem('reminderTime') || DEFAULT_TIME; } catch { return DEFAULT_TIME; }
  });
  const [canInstall, setCanInstall] = useState(!!installEvent);
  useEffect(() => {
    const on = () => setCanInstall(true);
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  const pick = (t) => {
    setTime(t);
    try { localStorage.setItem('reminderTime', t); } catch { /* 無痕模式存不了也沒關係 */ }
  };
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  const android = isAndroid();
  return (
    <section className="section open-reminder" id="reminder">
      <h2>每天提醒我開 app</h2>
      <p className="muted">提醒放進手機行事曆，每天時間到會跳通知，點通知就打開這裡。不用一直開著網頁。</p>
      <label className="row gap">
        <span>每天幾點</span>
        <select value={time} onChange={(e) => pick(e.target.value)} aria-label="提醒時間">
          {REMINDER_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="muted small">台灣時間</span>
      </label>
      <div className="row gap wrap open-reminder-btns">
        <a className={`btn ${android ? '' : 'primary'}`} href={icsPath(time)}>
          加到 iPhone 行事曆
        </a>
        <a className={`btn ${android ? 'primary' : ''}`} href={googleCalendarUrl(time)} target="_blank" rel="noreferrer">
          加到 Google 日曆
        </a>
      </div>
      <p className="muted small">
        iPhone：點了選「加入所有」。Google 日曆：按「儲存」，通知時間用日曆預設（可在活動裡改成「活動開始時」）。要換時間就先在行事曆刪掉舊的提醒再加一次。
      </p>
      <h3>放到主畫面，一點就開</h3>
      {installed ? (
        <p className="hint ok">已經從主畫面打開了 ✓</p>
      ) : canInstall ? (
        <button className="btn" onClick={async () => { await installEvent?.prompt(); installEvent = null; setCanInstall(false); }}>
          加到主畫面
        </button>
      ) : (
        <p className="muted small">
          {android ? 'Chrome 右上角「⋮」→「加到主畫面」。' : 'Safari 下面的「分享」→「加入主畫面」。'}
        </p>
      )}
    </section>
  );
}

function AccountsSettings() {
  const { accounts, api } = useData();
  const [name, setName] = useState('');
  const setDefault = (id) => api.batch(accounts.map((a) => ({ set: `accounts/${a.id}`, data: { isDefault: a.id === id } })));
  return (
    <section className="section" id="accounts">
      <h2>帳戶</h2>
      <ul className="list settings-list">
        {accounts.map((a) => (
          <li key={a.id} className="row gap wrap">
            <input className="grow" defaultValue={a.name} onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && api.update(`accounts/${a.id}`, { name: e.target.value.trim() })} aria-label="帳戶名稱" />
            <label className="mini">
              初始餘額
              <input
                inputMode="numeric"
                defaultValue={a.initialBalance}
                onBlur={(e) => api.update(`accounts/${a.id}`, { initialBalance: Number(e.target.value.replace(/[^\d-]/g, '')) || 0 })}
              />
            </label>
            <label className="inline">
              <input type="radio" name="defaultAccount" checked={!!a.isDefault} onChange={() => setDefault(a.id)} />
              預設
            </label>
            <button className="icon-btn" aria-label="刪除帳戶" onClick={() => window.confirm(`刪除帳戶「${a.name}」？已記的紀錄不會刪掉，但會找不到這個帳戶。`) && api.remove(`accounts/${a.id}`)}>
              <Icon name="trash" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row gap"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          api.add('accounts', { name: name.trim(), initialBalance: 0, isDefault: false, order: accounts.length });
          setName('');
        }}
      >
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="新帳戶名稱" />
        <button className="btn">新增帳戶</button>
      </form>
    </section>
  );
}

const KIND_LABEL = { perDay: '每餐／每天', perWeek: '每杯 × 每週杯數', perMonth: '每月金額' };

function BudgetSettings() {
  const { budget, fixedItems, accounts, api } = useData();
  const [b, setB] = useState(() => structuredClone(budget));
  const [ratioText, setRatioText] = useState(() => formatRatio(budget.investment?.ratio ?? 1 / 3));
  const [newCat, setNewCat] = useState({ name: '', kind: 'perMonth' });
  const [newExpCat, setNewExpCat] = useState('');
  const [newIncCat, setNewIncCat] = useState('');
  const [saved, setSaved] = useState(false);
  const mKey = monthKey(today());

  const ratio = parseRatio(ratioText);
  const draft = { ...b, investment: { ...b.investment, ratio: Number.isFinite(ratio) ? ratio : b.investment?.ratio } };
  const a = allocation(draft, fixedItems);
  const cb = categoryBudgets(draft, fixedItems, mKey);
  const ratioBad = b.investment?.mode !== 'fixed' && !(ratio >= 0 && ratio <= 1);
  const canSave = cb.over === 0 && !ratioBad;

  const setCat = (i, patch) => setB({ ...b, categories: b.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const num = (v) => Number(String(v).replace(/[^\d]/g, '')) || 0;
  const expenseCats = b.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  const incomeCats = b.incomeCategories || DEFAULT_INCOME_CATEGORIES;

  const save = () => {
    if (!canSave) return;
    api.set('settings/budget', draft, false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="section" id="budget">
      <h2>薪水與預算</h2>
      <div className="form">
        <div className="row gap wrap">
          <label className="mini">
            發薪日（每月幾號）
            <input inputMode="numeric" value={b.payday ?? ''} onChange={(e) => setB({ ...b, payday: Math.min(31, num(e.target.value)) || 1 })} />
          </label>
          <label className="mini">
            薪水
            <input inputMode="numeric" value={b.salary ?? ''} onChange={(e) => setB({ ...b, salary: num(e.target.value) })} />
          </label>
          <label className="mini">
            薪資戶
            <select value={b.salaryAccount || ''} onChange={(e) => setB({ ...b, salaryAccount: e.target.value })}>
              {accounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row gap wrap">
          <label className="mini">
            定期定額
            <select value={b.investment?.mode || 'ratio'} onChange={(e) => setB({ ...b, investment: { ...b.investment, mode: e.target.value } })}>
              <option value="ratio">薪水的比例</option>
              <option value="fixed">固定金額</option>
            </select>
          </label>
          {b.investment?.mode === 'fixed' ? (
            <label className="mini">
              金額
              <input inputMode="numeric" value={b.investment?.amount ?? ''} onChange={(e) => setB({ ...b, investment: { ...b.investment, amount: num(e.target.value) } })} />
            </label>
          ) : (
            <label className="mini">
              比例（1/3、25%、0.3）
              <input value={ratioText} onChange={(e) => setRatioText(e.target.value)} className={ratioBad ? 'bad' : ''} />
            </label>
          )}
          <label className="mini">
            轉到
            <select value={b.investment?.toAccount || ''} onChange={(e) => setB({ ...b, investment: { ...b.investment, toAccount: e.target.value } })}>
              {accounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="alloc">
          <div className="row between sub"><span>定期定額（捨去到百位）</span><span className="num">{money(a.investment)}</span></div>
          <div className="row between sub"><span>固定支出</span><span className="num">{money(a.fixed)}</span></div>
          <div className={`row between ${a.living < 0 ? 'neg' : ''}`}><strong>生活費</strong><strong className="num">{money(a.living)}</strong></div>
        </div>
        {a.living < 0 && <p className="hint over">固定支出太多，生活費是負的。</p>}

        <h3>分類預算（{Number(mKey.slice(5))} 月，{monthRange(mKey).to.slice(8)} 天）</h3>
        <ul className="list settings-list">
          {b.categories?.map((c, i) => (
            <li key={i} className="cat-budget">
              <div className="row between">
                <strong>{c.name}</strong>
                <span className="muted">{KIND_LABEL[c.kind]}</span>
              </div>
              <div className="row gap wrap">
                {c.kind === 'perWeek' ? (
                  <>
                    <label className="mini">每杯<input inputMode="numeric" value={c.perItem ?? ''} onChange={(e) => setCat(i, { perItem: num(e.target.value) })} /></label>
                    <label className="mini">每週杯數<input inputMode="numeric" value={c.perWeekCount ?? ''} onChange={(e) => setCat(i, { perWeekCount: num(e.target.value) })} /></label>
                  </>
                ) : (
                  <label className="mini">
                    {c.kind === 'perDay' ? '每餐' : '每月'}
                    <input inputMode="numeric" value={c.amount ?? ''} onChange={(e) => setCat(i, { amount: num(e.target.value) })} />
                  </label>
                )}
                <span className="grow num right">月預算 {money(cb.cats[i]?.budget || 0)}</span>
                <button className="icon-btn" aria-label="刪除分類預算" onClick={() => setB({ ...b, categories: b.categories.filter((_, j) => j !== i) })}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
          <li className="row between">
            <strong>彈性</strong>
            <span className={`num ${cb.flex < 0 ? 'neg' : ''}`}>{money(cb.flex)}</span>
          </li>
        </ul>
        <div className="row gap wrap">
          <input className="grow" placeholder="新增分類預算（例：交通）" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <select value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value })}>
            <option value="perMonth">每月金額</option>
            <option value="perDay">每天</option>
            <option value="perWeek">每週次數</option>
          </select>
          <button
            className="btn"
            onClick={() => {
              const name = newCat.name.trim();
              if (!name || b.categories?.some((c) => c.name === name)) return;
              const cat = newCat.kind === 'perWeek' ? { name, kind: 'perWeek', perItem: 0, perWeekCount: 0 } : { name, kind: newCat.kind, amount: 0 };
              setB({ ...b, categories: [...(b.categories || []), cat], expenseCategories: expenseCats.includes(name) ? expenseCats : [...expenseCats, name] });
              setNewCat({ name: '', kind: 'perMonth' });
            }}
          >
            新增
          </button>
        </div>

        <h3>記帳分類按鈕</h3>
        <div className="chips-edit">
          {expenseCats.map((c) => (
            <span key={c} className="chip">
              {c}
              <button aria-label={`移除 ${c}`} onClick={() => setB({ ...b, expenseCategories: expenseCats.filter((x) => x !== c) })}>×</button>
            </span>
          ))}
        </div>
        <div className="row gap">
          <input className="grow" value={newExpCat} onChange={(e) => setNewExpCat(e.target.value)} placeholder="新增支出分類" />
          <button className="btn" onClick={() => { const n = newExpCat.trim(); if (n && !expenseCats.includes(n)) setB({ ...b, expenseCategories: [...expenseCats, n] }); setNewExpCat(''); }}>新增</button>
        </div>
        <h3>收入分類</h3>
        <div className="chips-edit">
          {incomeCats.map((c) => (
            <span key={c} className="chip">
              {c}
              <button aria-label={`移除 ${c}`} onClick={() => setB({ ...b, incomeCategories: incomeCats.filter((x) => x !== c) })}>×</button>
            </span>
          ))}
        </div>
        <div className="row gap">
          <input className="grow" value={newIncCat} onChange={(e) => setNewIncCat(e.target.value)} placeholder="新增收入分類" />
          <button className="btn" onClick={() => { const n = newIncCat.trim(); if (n && !incomeCats.includes(n)) setB({ ...b, incomeCategories: [...incomeCats, n] }); setNewIncCat(''); }}>新增</button>
        </div>
        <p className="muted small">記帳時也可以直接按「＋ 新增」加分類。沒有設預算的分類，花費都從彈性扣。改完記得按下面的儲存。</p>

        {cb.over > 0 && <p className="hint over">分類預算加總 {money(cb.sum)}，超過生活費 {money(cb.over)}，不能儲存。</p>}
        {ratioBad && <p className="hint over">比例看不懂，請輸入 1/3、25% 或 0.3。</p>}
        <button className="btn primary big" disabled={!canSave} onClick={save}>
          {saved ? '已儲存' : '儲存預算'}
        </button>
      </div>
    </section>
  );
}

function FixedSettings() {
  const { fixedItems, accounts, defaultAccount, api } = useData();
  const [f, setF] = useState({ name: '', amount: '', day: '', account: '' });
  const items = fixedItems.slice().sort((a, b) => (a.day || 0) - (b.day || 0));
  return (
    <section className="section" id="fixed">
      <h2>固定支出</h2>
      <ul className="list settings-list">
        {items.map((x) => (
          <li key={x.id} className="row gap wrap">
            <input className="grow" defaultValue={x.name} onBlur={(e) => e.target.value.trim() && api.update(`fixedItems/${x.id}`, { name: e.target.value.trim() })} aria-label="名稱" />
            <label className="mini">金額<input inputMode="numeric" defaultValue={x.amount} onBlur={(e) => api.update(`fixedItems/${x.id}`, { amount: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} /></label>
            <label className="mini">扣款日<input inputMode="numeric" defaultValue={x.day} onBlur={(e) => api.update(`fixedItems/${x.id}`, { day: Math.min(31, Number(e.target.value.replace(/[^\d]/g, '')) || 1) })} /></label>
            <label className="mini">
              帳戶
              <select value={x.account || ''} onChange={(e) => api.update(`fixedItems/${x.id}`, { account: e.target.value })}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <button className="icon-btn" aria-label="刪除" onClick={() => window.confirm(`刪除「${x.name}」？`) && api.remove(`fixedItems/${x.id}`)}>
              <Icon name="trash" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row gap wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.name.trim() || !(Number(f.amount) > 0)) return;
          api.add('fixedItems', { name: f.name.trim(), amount: Number(f.amount), day: Math.min(31, Number(f.day) || 1), account: f.account || defaultAccount });
          setF({ name: '', amount: '', day: '', account: '' });
        }}
      >
        <input className="grow" placeholder="名稱（例：房租）" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input inputMode="numeric" placeholder="金額" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, '') })} style={{ width: '6rem' }} />
        <input inputMode="numeric" placeholder="幾號" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value.replace(/[^\d]/g, '') })} style={{ width: '4rem' }} />
        <select value={f.account || defaultAccount || ''} onChange={(e) => setF({ ...f, account: e.target.value })} aria-label="扣款帳戶">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button className="btn">新增</button>
      </form>
      <p className="muted small">每月扣款日前 3 天會出現在首頁，按「已付」就記成一筆支出。</p>
    </section>
  );
}

function ReconcileSettings() {
  const { reconcile, api } = useData();
  const [s, setS] = useState({ name: '', url: '' });
  const shortcuts = reconcile.shortcuts || [];
  const save = (patch) => api.set('settings/reconcile', { ...reconcile, ...patch }, false);
  return (
    <section className="section" id="reconcile">
      <h2>對帳</h2>
      <div className="row gap wrap">
        <label className="mini">
          週期
          <select value={reconcile.cycle} onChange={(e) => save({ cycle: e.target.value, day: e.target.value === 'weekly' ? 0 : 1 })}>
            <option value="weekly">每週</option>
            <option value="monthly">每月</option>
          </select>
        </label>
        {reconcile.cycle === 'weekly' ? (
          <label className="mini">
            星期
            <select value={reconcile.day} onChange={(e) => save({ day: Number(e.target.value) })}>
              {WEEKDAY_NAMES.map((n, i) => <option key={i} value={i}>週{n}</option>)}
            </select>
          </label>
        ) : (
          <label className="mini">
            每月幾號
            <input inputMode="numeric" defaultValue={reconcile.day} onBlur={(e) => save({ day: Math.min(31, Number(e.target.value) || 1) })} />
          </label>
        )}
      </div>
      <h3>對帳捷徑</h3>
      <ul className="list settings-list">
        {shortcuts.map((x, i) => (
          <li key={i} className="row gap between">
            <a href={x.url} className="btn small">{x.name}</a>
            <span className="muted small grow ellipsis">{x.url}</span>
            <button className="icon-btn" aria-label="刪除捷徑" onClick={() => save({ shortcuts: shortcuts.filter((_, j) => j !== i) })}>
              <Icon name="trash" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row gap wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (!s.name.trim() || !s.url.trim()) return;
          save({ shortcuts: [...shortcuts, { name: s.name.trim(), url: s.url.trim() }] });
          setS({ name: '', url: '' });
        }}
      >
        <input placeholder="名稱（例：LINE Pay）" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        <input className="grow" placeholder="網址（自己貼上並實際點點看）" value={s.url} onChange={(e) => setS({ ...s, url: e.target.value })} />
        <button className="btn">新增</button>
      </form>
      <p className="muted small">網址請自己貼上，加好後點一下上面的按鈕測試能不能打開 App。</p>
    </section>
  );
}

function HabitSettings() {
  const { habits, api } = useData();
  const [name, setName] = useState('');
  const save = (items) => api.set('settings/habits', { items }, false);
  return (
    <section className="section" id="habits">
      <h2>每日固定打勾</h2>
      <div className="chips-edit">
        {habits.map((h) => (
          <span key={h} className="chip">
            {h}
            <button aria-label={`移除 ${h}`} onClick={() => window.confirm(`移除「${h}」？`) && save(habits.filter((x) => x !== h))}>×</button>
          </span>
        ))}
      </div>
      <form className="row gap" onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (n && !habits.includes(n)) save([...habits, n]); setName(''); }}>
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="新增每日項目" />
        <button className="btn">新增</button>
      </form>
    </section>
  );
}

function RecurringSettings() {
  const { recurring, api } = useData();
  const [f, setF] = useState({ title: '', rule: 'weekly:mon' });
  const editable = recurring.filter((r) => !r.special);
  return (
    <section className="section" id="recurring">
      <h2>每週／每月固定事項</h2>
      <ul className="list settings-list">
        {editable.map((r) => {
          const p = parseRule(r.rule);
          return (
            <li key={r.id} className="row gap wrap">
              <span className="grow">{r.title}</span>
              <select
                value={r.rule}
                onChange={(e) => api.update(`recurring/${r.id}`, { rule: e.target.value })}
                aria-label="哪一天"
              >
                {WEEKDAY_KEYS.map((k, i) => <option key={k} value={`weekly:${k}`}>每週{WEEKDAY_NAMES[i]}</option>)}
                {p.kind === 'monthly' && <option value={r.rule}>每月 {p.day} 號</option>}
              </select>
              <button className="icon-btn" aria-label="刪除" onClick={() => window.confirm(`刪除「${r.title}」？`) && api.remove(`recurring/${r.id}`)}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          );
        })}
      </ul>
      <form className="row gap wrap" onSubmit={(e) => { e.preventDefault(); if (!f.title.trim()) return; api.add('recurring', { title: f.title.trim(), rule: f.rule, special: null }); setF({ ...f, title: '' }); }}>
        <input className="grow" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="例：看企業倫理線上課程影片" />
        <select value={f.rule} onChange={(e) => setF({ ...f, rule: e.target.value })}>
          {WEEKDAY_KEYS.map((k, i) => <option key={k} value={`weekly:${k}`}>每週{WEEKDAY_NAMES[i]}</option>)}
        </select>
        <button className="btn">新增</button>
      </form>
      <p className="muted small">另外固定會有：每天英文 15 分鐘、每週日排下週、每月 1 號作上個月的帳。</p>
    </section>
  );
}

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  if (m < 60 * 24) return `${Math.round(m / 60)} 小時前`;
  return `${Math.round(m / 60 / 24)} 天前`;
}

function ErrorSettings() {
  const { errorLog, api } = useData();
  const [open, setOpen] = useState(null);
  const unseen = errorLog.filter((e) => !e.seen);
  return (
    <section className="section" id="errors">
      <div className="row between">
        <h2>錯誤紀錄{unseen.length > 0 && <span className="chip warn">{unseen.length} 個新的</span>}</h2>
        {unseen.length > 0 && (
          <button className="btn small" onClick={() => api.batch(unseen.map((e) => ({ set: `errorLog/${e.id}`, data: { seen: true } })))}>
            都看過了
          </button>
        )}
      </div>
      {errorLog.length === 0 ? (
        <p className="muted">目前沒有錯誤，一切正常。網站出錯時會記在這裡，右上角齒輪會出現紅點。</p>
      ) : (
        <>
          <ul className="list settings-list error-log">
            {errorLog.map((e) => (
              <li key={e.id} className={e.seen ? '' : 'new'}>
                <button className="link error-head" onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <span className="chip">{e.source}</span>
                  <span className="grow">{e.message}</span>
                </button>
                <p className="muted small">
                  {ago(e.lastAt)}・共 {e.count || 1} 次・在 {e.page || '/'}
                </p>
                {open === e.id && (
                  <>
                    {e.stack && <pre className="error-stack">{e.stack}</pre>}
                    <p className="muted small">{e.ua}</p>
                  </>
                )}
              </li>
            ))}
          </ul>
          <button className="btn small danger" onClick={() => window.confirm('清空所有錯誤紀錄？') && api.batch(errorLog.map((e) => ({ remove: `errorLog/${e.id}` })))}>
            清空紀錄
          </button>
        </>
      )}
    </section>
  );
}
