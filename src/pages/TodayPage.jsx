import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, weekday, weekDays, monthKey, monthLabel, dayInMonth, shortLabel, WEEKDAY_NAMES, addDays } from '../lib/date.js';
import {
  todayTasks, overdueTasks, weekCompletion, habitStreak, pendingWeekly, nextDeadline, deadlineReminders,
  monthToClose, isReconcileDay, lastReconcile, fixedDue, recurringDoneId, MAX_TODAY, captureTasks, splitCapture,
} from '../lib/plan.js';
import { todayMealLeft, weekDrinkLeft, livingSummary } from '../lib/budget.js';
import { ENGLISH_HABIT } from '../lib/seed.js';
import { TarotCard } from './TarotPage.jsx';
import { QuoteCard, OracleHomeCard } from './OraclePage.jsx';
import { eatLine } from '../lib/oracle.js';
import BalancePie from '../components/BalancePie.jsx';
import { Ring, TaskRow, Sheet, money, deadlineLabel } from '../components/ui.jsx';
import { AddTaskForm, TaskEditor, useTaskActions, payFixed } from '../components/editors.jsx';
import { useNextMeal, useEatMeal, MealChoices } from './FoodPage.jsx';
import { fullSugarCount, kcalToday } from '../lib/meals.js';
import { latestWeight, needsWeighIn } from '../lib/body.js';
import { useFoodLog } from '../components/FoodLog.jsx';
import { OotdTodayCard } from '../components/OotdLog.jsx';
import { StudyTodayCard } from './StudyPage.jsx';
import { photoStreak, slotLabel } from '../lib/foodlog.js';

export default function TodayPage() {
  const data = useData();
  const { tasks, deadlines, recurring, recurringDone, habits, habitLog, energyLog, api, budget, fixedItems, expenses, meta } = data;
  const day = today();
  const actions = useTaskActions();
  const [editing, setEditing] = useState(null);
  const [showOverflow, setShowOverflow] = useState(false);

  const { shown, overflow } = todayTasks(tasks, day);
  const overdue = overdueTasks(tasks, day);
  const doneToday = shown.filter((t) => t.done).length;
  // 圓環 = 今天的任務 + 每天固定，一起算
  const habitsDone = habits.filter((h) => habitLog[day]?.done?.[h]).length;
  const ringTotal = shown.length + habits.length || MAX_TODAY;
  const week = weekCompletion(tasks, weekDays(day));
  const meal = todayMealLeft(budget, expenses, day);
  const drink = weekDrinkLeft(budget, expenses, day);
  const living = livingSummary(budget, fixedItems, expenses, day);
  const next = nextDeadline(deadlines, day);
  const englishStreak = habitStreak(habitLog, ENGLISH_HABIT, day);
  const full = shown.length >= MAX_TODAY;
  const kcal = kcalToday(expenses, day);

  const tomorrow = addDays(day, 1);
  const captured = captureTasks(tasks);
  // 今天滿 3 件時要排進今天的那一件：{ title, project } 是新記的，{ task } 是從隨手記／之前沒做完拉過來的
  const [asking, setAsking] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const putOn = (item, date) =>
    item.task ? actions.move(item.task, date) : actions.add({ title: item.title, project: item.project || '', date });

  // 排進今天：還沒滿就直接放，滿了就問要明天做，還是把今天一件換到明天
  const placeToday = (item) => {
    if (!full) {
      putOn(item, day);
      return true;
    }
    setAsking(item);
    return false;
  };

  const moveToToday = (t) => placeToday({ task: t });

  const toggleHabit = (name) => {
    const on = !habitLog[day]?.done?.[name];
    api.set(`habitLog/${day}`, { done: { [name]: on } });
    if (name === ENGLISH_HABIT) {
      if (on) api.set(`englishLog/${day}`, { minutes: 15, note: '' });
      else api.remove(`englishLog/${day}`);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>今天</h1>
        <span className="muted">
          {shortLabel(day)}
        </span>
      </header>

      <QuoteCard />

      <Reminders day={day} />

      <FoodHero />

      <section className="home-cards">
        <OotdTodayCard />
        <StudyTodayCard />
      </section>

      <section className="dash">
        <div className="card ring-card">
          <Ring value={doneToday + habitsDone} total={ringTotal} />
          <div className="label">今天完成</div>
          <div className="ring-sub">
            任務 {doneToday}/{shown.length}・固定 {habitsDone}/{habits.length}
          </div>
        </div>
        <div className="card stat">
          <div className="big">
            {week.done}／{week.total}
          </div>
          <div className="label">本週完成{week.total ? ` ${Math.round((week.done / week.total) * 100)}%` : ''}</div>
        </div>
        <div className="card stat">
          <div className="big">{englishStreak} 天</div>
          <div className="label">英文連續</div>
        </div>
        <BalancePie day={day} />
        <div className={`card stat ${meal.left < 0 ? 'over' : ''}`}>
          <div className="big">{money(meal.left)}</div>
          <div className="label">今天餐費還剩</div>
        </div>
        <div className={`card stat ${drink.left < 0 ? 'over' : ''}`}>
          <div className="big">{money(drink.left)}</div>
          <div className="label">本週飲料還剩</div>
        </div>
        <div className={`card stat ${living.left < 0 ? 'over' : ''}`}>
          <div className="big">{money(living.left)}</div>
          <div className="label">本月生活費還剩・每天 {money(living.perDay)}</div>
        </div>
        <div className="card stat">
          <div className="big">{fullSugarCount(expenses, weekDays(day))} 杯</div>
          <div className="label">本週全糖</div>
        </div>
        {kcal > 0 && (
          <div className="card stat">
            <div className="big">{kcal}</div>
            <div className="label">今天已記熱量（大卡）</div>
          </div>
        )}
        {next && (
          <div className="card stat wide">
            <div className="big">
              {next.title} <span className="accent">{deadlineLabel(next, day)}</span>
            </div>
            <div className="label">
              最近的期限 {shortLabel(next.date)} {next.tentative && <span className="chip warn">日期未定</span>}
            </div>
          </div>
        )}
      </section>

      <TarotCard day={day} />

      <OracleHomeCard day={day} />

      <section className="section">
        <h2>今天的三件事</h2>
        {shown.length === 0 && <p className="muted">今天還沒排任務。寫到打開就能開始做的程度。</p>}
        <ul className="list">
          {shown.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={actions.toggle} onMove={actions.move} onEdit={setEditing} />
          ))}
        </ul>
        <AddTaskForm date={day} onAdd={(f) => placeToday(f)} />
        {notice && <p className="hint ok">{notice}</p>}
        {overflow.length > 0 && (
          <div className="more">
            <button className="link" onClick={() => setShowOverflow(!showOverflow)}>
              今天還排了 {overflow.length} 件（先完成或移到別天）{showOverflow ? '▲' : '▼'}
            </button>
            {showOverflow && (
              <ul className="list">
                {overflow.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={actions.toggle} onMove={actions.move} onEdit={setEditing} />
                ))}
              </ul>
            )}
          </div>
        )}
        {overdue.length > 0 && (
          <details className="more">
            <summary>之前沒做完 {overdue.length} 件</summary>
            <ul className="list">
              {overdue.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  showDate
                  onToggle={actions.toggle}
                  onMove={(task, d) => (d === day ? moveToToday(task) : actions.move(task, d))}
                  onEdit={setEditing}
                />
              ))}
            </ul>
          </details>
        )}
      </section>

      <CaptureList
        items={captured}
        actions={actions}
        onToday={(task) => placeToday({ task })}
        onEdit={setEditing}
        day={day}
      />

      <section className="section">
        <h2>每天固定</h2>
        <ul className="list habits">
          {habits.map((h) => {
            const on = !!habitLog[day]?.done?.[h];
            const s = habitStreak(habitLog, h, day);
            return (
              <li key={h} className={`task ${on ? 'done' : ''}`}>
                <label className="check">
                  <input type="checkbox" checked={on} onChange={() => toggleHabit(h)} aria-label={h} />
                  <span className="box" />
                </label>
                <div className="task-body" onClick={() => toggleHabit(h)}>
                  <div className="task-title">{h}</div>
                </div>
                <span className="streak">{s > 0 ? `連續 ${s} 天` : ''}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="section">
        <h2>精力</h2>
        <div className="energy" role="radiogroup" aria-label="精力狀態">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={energyLog[day]?.level === n}
              className={energyLog[day]?.level === n ? 'on' : ''}
              onClick={() => api.set(`energyLog/${day}`, { level: n }, false)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
      {asking && (
        <FullDayChooser
          item={asking}
          today={shown.filter((t) => !t.done)}
          tomorrowCount={tasks.filter((t) => t.date === tomorrow && !t.done).length}
          onTomorrow={() => {
            putOn(asking, tomorrow);
            setNotice(`「${asking.task?.title || asking.title}」排到明天了`);
            setAsking(null);
          }}
          onSwap={(other) => {
            actions.move(other, tomorrow);
            putOn(asking, day);
            setNotice(`「${other.title}」移到明天，「${asking.task?.title || asking.title}」今天做`);
            setAsking(null);
          }}
          onCapture={() => {
            if (!asking.task) {
              putOn(asking, null);
              setNotice(`「${asking.title}」先記在隨手記`);
            }
            setAsking(null);
          }}
          onClose={() => setAsking(null)}
        />
      )}
    </div>
  );
}

// 今天已經 3 件：問這件要明天做，還是把今天的一件換到明天
function FullDayChooser({ item, today: todayList, tomorrowCount, onTomorrow, onSwap, onCapture, onClose }) {
  const title = item.task?.title || item.title;
  return (
    <Sheet title="今天已經 3 件了" onClose={onClose}>
      <p className="full-day-q">
        「<strong>{title}</strong>」要怎麼排？
      </p>
      <button className="btn primary big" onClick={onTomorrow}>
        明天做{tomorrowCount ? `（明天已有 ${tomorrowCount} 件）` : ''}
      </button>
      {todayList.length > 0 && (
        <>
          <h3 className="full-day-h">或是今天做這件，把其中一件移到明天：</h3>
          <ul className="swap-list">
            {todayList.map((t) => (
              <li key={t.id}>
                <button className="swap-btn" onClick={() => onSwap(t)}>
                  <span className="swap-title">{t.title}</span>
                  <span className="swap-go">移到明天 →</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button className="btn big" onClick={onCapture}>
        {!item.task ? '先記在隨手記，之後再排' : item.task.date ? '先不排' : '留在隨手記'}
      </button>
    </Sheet>
  );
}

// 隨手記：想到就先記下來（不限件數），之後再排到哪天
function CaptureList({ items, actions, onToday, onEdit, day }) {
  const { api } = useData();
  const [text, setText] = useState('');
  const [ok, setOk] = useState('');
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!ok) return undefined;
    const t = setTimeout(() => setOk(''), 2500);
    return () => clearTimeout(t);
  }, [ok]);

  const submit = (e) => {
    e?.preventDefault();
    const titles = splitCapture(text);
    if (!titles.length) return;
    const now = Date.now();
    // 一次貼好幾行：照貼上的順序排（第一行在最上面）
    api.batch(
      titles.map((title, i) => ({
        add: 'tasks',
        data: { title, date: null, project: '', note: '', done: false, doneAt: null, isToday: false, createdAtMs: now + titles.length - i },
      })),
    );
    setOk(titles.length > 1 ? `記下 ${titles.length} 件` : `記下「${titles[0]}」`);
    setText('');
  };

  const shown = all ? items : items.slice(0, 8);
  return (
    <section className="section capture">
      <h2>
        隨手記 {items.length > 0 && <span className="count-pill">{items.length}</span>}
      </h2>
      <p className="muted small">想到就先記，不限件數，也可以一次貼好幾行。要做的時候按「今天」或「明天」。</p>
      <form className="capture-form" onSubmit={submit}>
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
          }}
          placeholder="想到什麼先記這裡"
          aria-label="隨手記"
        />
        <button className="btn primary" type="submit">
          記下來
        </button>
      </form>
      {ok && <p className="hint ok">{ok}</p>}
      <ul className="list">
        {shown.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onToggle={actions.toggle}
            onMove={(task, d) => (d === day ? onToday(task) : actions.move(task, d))}
            onEdit={onEdit}
            onDelete={actions.remove}
            extra={
              <span className="capture-quick">
                <button className="chip-btn" onClick={(e) => { e.stopPropagation(); onToday(t); }}>
                  今天
                </button>
                <button className="chip-btn" onClick={(e) => { e.stopPropagation(); actions.move(t, addDays(day, 1)); }}>
                  明天
                </button>
              </span>
            }
          />
        ))}
      </ul>
      {items.length > 8 && (
        <button className="link" onClick={() => setAll(!all)}>
          {all ? '收起來 ▲' : `看全部 ${items.length} 件 ▼`}
        </button>
      )}
    </section>
  );
}

function Reminders({ day }) {
  const data = useData();
  const { recurring, recurringDone, deadlines, reconcile, reconcileLog, monthClose, fixedItems, fixedPaid, meta, budget, allocations, api } = data;
  const items = [];
  const startMonth = meta.startMonth;

  if (weekday(day) === 0) {
    items.push(
      <Link key="plan" to="/week?w=1" className="reminder">
        <strong>花 10 分鐘排下週</strong>
        <span>→</span>
      </Link>,
    );
  }

  // 有設體重才提醒：每週量一次，週一開始提醒
  if (data.body && latestWeight(data.weightLog, day) && needsWeighIn(data.weightLog, day)) {
    items.push(
      <Link key="weigh" to="/food?tab=body" className="reminder">
        <strong>這週還沒量體重</strong>
        <span>→</span>
      </Link>,
    );
  }

  const closeMonth = monthToClose(monthClose, day, startMonth);
  if (closeMonth) {
    items.push(
      <Link key="close" to={`/close/${closeMonth}`} className="reminder">
        <strong>作 {monthLabel(closeMonth)}的帳</strong>
        <span>→</span>
      </Link>,
    );
  }

  const mKey = monthKey(day);
  const salary = Number(budget.salary) || 0;
  const payDate = dayInMonth(mKey, Number(budget.payday) || 1);
  if (salary > 0 && day >= payDate && !allocations[mKey] && (!startMonth || mKey >= startMonth)) {
    items.push(
      <Link key="alloc" to="/money?tab=alloc" className="reminder">
        <strong>發薪了：執行分配</strong>
        <span>→</span>
      </Link>,
    );
  }

  if (isReconcileDay(reconcile, day) && !reconcileLog.includes(day)) {
    const last = lastReconcile(reconcileLog, day);
    items.push(
      <div key="rec" className="reminder col">
        <div className="row between">
          <strong>該對帳了</strong>
          <Link to="/money/reconcile" className="link">
            開始對帳 →
          </Link>
        </div>
        <div className="shortcuts">
          {(reconcile.shortcuts || []).map((s) => (
            <a key={s.name + s.url} href={s.url} className="btn small">
              {s.name}
            </a>
          ))}
          {!(reconcile.shortcuts || []).length && (
            <Link to="/settings#reconcile" className="muted">
              到設定新增對帳捷徑
            </Link>
          )}
        </div>
        <span className="muted">{last ? `上次對帳：${last.daysAgo} 天前` : '還沒有對帳紀錄'}</span>
      </div>,
    );
  }

  for (const f of fixedDue(fixedItems, fixedPaid, day)) {
    items.push(
      <div key={`fx-${f.id}`} className="reminder">
        <span>
          <strong>{f.name}</strong> {money(f.amount)}・{f.daysLeft > 0 ? `${f.daysLeft} 天後扣款` : f.daysLeft === 0 ? '今天扣款' : '已過扣款日'}
        </span>
        <button className="btn small" onClick={() => payFixed(data, f, mKey)}>
          已付
        </button>
      </div>,
    );
  }

  for (const d of deadlineReminders(deadlines, day)) {
    items.push(
      <div key={`dl-${d.id}`} className="reminder">
        <strong>
          {d.when}：{d.title}
        </strong>
      </div>,
    );
  }

  for (const r of pendingWeekly(recurring, recurringDone, day, meta.startDate)) {
    items.push(
      <label key={`rc-${r.id}`} className="reminder check-row">
        <span className="check">
          <input
            type="checkbox"
            onChange={() => api.set(`recurringDone/${recurringDoneId(r.id, r.occurrence)}`, { doneOn: day }, false)}
          />
          <span className="box" />
        </span>
        <span className="grow">
          週{WEEKDAY_NAMES[weekday(r.occurrence)]}：{r.title}
        </span>
        {r.delay > 0 && <span className="chip warn">延後 {r.delay} 天</span>}
      </label>,
    );
  }

  if (!items.length) return null;
  return <section className="reminders">{items}</section>;
}

// 首頁最上面：吃什麼是主角
function FoodHero() {
  const nm = useNextMeal();
  const eat = useEatMeal();
  const { uid, oracleLog } = useData();
  const t = today();
  const pick = eatLine(oracleLog[t]?.eat);
  const log = useFoodLog(uid, addDays(t, -30)) || [];
  const [msg, setMsg] = useState('');
  const todaySnaps = log.filter((i) => i.date === t).sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
  const streak = photoStreak(log.map((i) => i.date), t);
  return (
    <section className="food-hero">
      <div className="food-hero-head">
        <h2 className="food-hero-title">今天吃什麼</h2>
        <span className="food-hero-slot">
          下一餐：{nm.tomorrow ? '明天' : ''}
          {nm.slotName}
        </span>
      </div>
      <p className="food-hero-sub">
        {nm.budgetLeft === null ? '' : `這餐預算剩 ${money(nm.budgetLeft)}`}
        {nm.kcalLeft !== null && `・熱量還剩 ${Math.max(0, Math.round(nm.kcalLeft))} 大卡`}
      </p>
      <Link to="/oracle" className="food-hero-oracle">
        {pick ? `今天的雷諾曼 ${pick}` : '抽兩張雷諾曼，看今天吃什麼方向'}
      </Link>
      <div className="food-hero-main">
        <Link to="/food?wheel=1" className="btn primary">轉盤決定</Link>
        <Link to="/food?tab=near" className="btn primary teal">附近餐廳</Link>
      </div>
      {msg ? (
        <p className="hint ok">{msg}</p>
      ) : (
        <MealChoices
          compact
          nm={nm}
          onEat={(m) => {
            eat(m, nm.slot, nm.day);
            setMsg(`已記：${nm.slotName} ${m.name} ${money(m.price)}`);
          }}
        />
      )}
      <div className="food-hero-snaps">
        <Link to="/food?tab=snap" className="food-hero-cam" aria-label="拍照打卡">
          <strong>{streak}</strong>
          <span>天連續打卡</span>
        </Link>
        {todaySnaps.slice(0, 3).map((it) => (
          <Link key={it.id} to="/food?tab=snap" className="food-hero-snap">
            <img src={it.thumb} alt={`${slotLabel(it)} ${it.note || ''}`} />
          </Link>
        ))}
        {!todaySnaps.length && <Link to="/food?tab=snap" className="food-hero-snap empty">今天還沒拍</Link>}
      </div>
      <div className="food-shortcuts">
        <Link to="/food?tab=snap" className="btn small">拍照打卡</Link>
        <Link to="/food?tab=drink" className="btn small">要不要喝飲料</Link>
        <Link to="/food?tab=near&kind=drink" className="btn small">附近飲料店</Link>
        <Link to="/food?tab=snap" className="btn small">一週吃什麼 IG 圖</Link>
      </div>
    </section>
  );
}
