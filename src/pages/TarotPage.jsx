import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, shortLabel, addDays, weekStart } from '../lib/date.js';
import { todayTasks } from '../lib/plan.js';
import { cardById, cardNumeral, drawSpread, meaningOf, tarotPrompt, tarotStreak, spreadOf, isFullSpread, POSITIONS, suggestActions, parseActions, MAX_ACTIONS, tarotReview, reviewPrompt } from '../lib/tarot.js';

// 抽牌：每天一次「過去・現在・未來」三張，存在 tarotLog/{日期}，換裝置也是同一組
function useTarot(day) {
  const { tarotLog, api, tasks, habits, habitLog, energyLog } = useData();
  // 舊版一天只抽一張；那天可以重抽成三張
  const cards = isFullSpread(tarotLog[day]) ? spreadOf(tarotLog[day]) : null;
  const doDraw = () => {
    if (isFullSpread(tarotLog[day])) return;
    api.set(`tarotLog/${day}`, { cards: drawSpread(), createdAtMs: Date.now() }, false);
  };
  const openTasks = todayTasks(tasks, day).shown.filter((t) => !t.done).map((t) => t.title);
  const actions = tarotLog[day]?.actions || [];
  const setActions = (list) => api.set(`tarotLog/${day}`, { actions: list });
  const prompt = cards
    ? tarotPrompt({
        day,
        cards,
        tasks: openTasks,
        habitsDone: habits.filter((h) => habitLog[day]?.done?.[h]),
        energy: energyLog[day]?.level || null,
      })
    : '';
  return { cards, doDraw, prompt, tarotLog, actions, setActions, suggestions: cards ? suggestActions(cards, openTasks) : [] };
}

const label = (d) => `${cardById(d.cardId)?.zh || ''}・${d.reversed ? '逆位' : '正位'}`;

// 今天的行動：從建議挑、自己寫，或貼上 AI 回的「- [ ] 行動」，最多 3 個
function ActionList({ actions, setActions, compact }) {
  const doneCount = actions.filter((a) => a.done).length;
  return (
    <ul className={`tarot-actions ${compact ? 'compact' : ''}`}>
      {actions.map((a, i) => (
        <li key={i} className={a.done ? 'done' : ''}>
          <label className="check">
            <input
              type="checkbox"
              checked={!!a.done}
              onChange={() => setActions(actions.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              aria-label={a.text}
            />
            <span className="box" />
          </label>
          <span className="ta-text">{a.text}</span>
          {!compact && (
            <button className="icon-btn" aria-label={`刪除 ${a.text}`} onClick={() => setActions(actions.filter((_, j) => j !== i))}>
              ×
            </button>
          )}
        </li>
      ))}
      {compact && actions.length > 0 && <li className="muted small">完成 {doneCount}/{actions.length}</li>}
    </ul>
  );
}

function ActionEditor({ actions, setActions, suggestions }) {
  const [text, setText] = useState('');
  const full = actions.length >= MAX_ACTIONS;
  const add = (items) => {
    const have = new Set(actions.map((a) => a.text));
    const next = [...actions, ...items.filter((t) => !have.has(t)).map((t) => ({ text: t, done: false }))].slice(0, MAX_ACTIONS);
    setActions(next);
  };
  const left = suggestions.filter((t) => !actions.some((a) => a.text === t));
  return (
    <>
      <ActionList actions={actions} setActions={setActions} />
      {!full && left.length > 0 && (
        <div className="ta-suggest">
          <div className="muted small">依「現在」那張牌和今天的事，可以試試：</div>
          {left.map((t) => (
            <button key={t} className="ta-chip" onClick={() => add([t])}>
              ＋ {t}
            </button>
          ))}
        </div>
      )}
      {!full ? (
        <form
          className="row gap"
          onSubmit={(e) => {
            e.preventDefault();
            const items = parseActions(text);
            if (items.length) add(items);
            setText('');
          }}
        >
          <textarea className="grow ta-input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="自己寫一個，或貼上 AI 回的「- [ ] 行動」" />
          <button className="btn primary">加入</button>
        </form>
      ) : (
        <p className="muted small">今天最多 {MAX_ACTIONS} 個，做完再說。</p>
      )}
    </>
  );
}

function Spread({ cards, small, fresh }) {
  return (
    <div className={`tarot-spread ${small ? 'small' : ''}`}>
      {cards.map((d, i) => (
        <figure key={i} className="tarot-slot">
          <figcaption>{POSITIONS[i]}</figcaption>
          <TarotFace draw={d} small={small} fresh={fresh} />
        </figure>
      ))}
    </div>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 舊瀏覽器或沒權限：用隱藏的文字框複製
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function CopyButton({ text, className = 'btn primary' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }
      }}
    >
      {done ? '已複製，貼給 AI 吧' : '複製給 AI'}
    </button>
  );
}

export function TarotFace({ draw, small, fresh }) {
  const c = cardById(draw.cardId);
  if (!c) return null;
  return (
    <div className={`tarot-card ${small ? 'small' : ''} ${fresh ? 'fresh' : ''} ${c.arcana === 'major' ? 'major' : c.suit}`} aria-label={`${c.zh} ${draw.reversed ? '逆位' : '正位'}`}>
      <div className={`tarot-inner ${draw.reversed ? 'reversed' : ''}`}>
        {draw.reversed && <span className="tarot-rev">逆位</span>}
        <span className="tarot-num">{cardNumeral(c)}</span>
        <span className="tarot-mark">{c.arcana === 'major' ? '大阿爾克那' : c.suitZh}</span>
        <strong className="tarot-name">{c.zh}</strong>
        <span className="tarot-en">{c.en}</span>
      </div>
    </div>
  );
}

// 首頁的小卡
export function TarotCard({ day }) {
  const { cards, doDraw, prompt, actions, setActions } = useTarot(day);
  const [fresh, setFresh] = useState(false);
  if (!cards) {
    return (
      <section className="section tarot-home">
        <div className="row between">
          <h2>今日塔羅</h2>
          <button className="btn small primary" onClick={() => { setFresh(true); doDraw(); }}>
            抽今天的三張牌
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="section tarot-home">
      <h2>今日塔羅</h2>
      <div className="card tarot-home-card">
        <Spread cards={cards} small fresh={fresh} />
        <ul className="tarot-lines">
          {cards.map((d, i) => (
            <li key={i}>
              <span className="tarot-pos">{POSITIONS[i]}</span>
              <strong>{label(d)}</strong>
              <span className="muted small">{meaningOf(d)}</span>
            </li>
          ))}
        </ul>
        <div className="tarot-act-home">
          <strong className="small">今天的行動</strong>
          {actions.length ? (
            <ActionList actions={actions} setActions={setActions} compact />
          ) : (
            <Link to="/tarot" className="link small">
              把牌義變成一個今天做得到的行動 →
            </Link>
          )}
        </div>
        <div className="row gap wrap">
          <CopyButton text={prompt} className="btn small primary" />
          <Link to="/tarot" className="btn small">
            看紀錄
          </Link>
        </div>
      </div>
    </section>
  );
}

// 回顧：本週或近 4 週，看「現在」是哪類牌時，行動比較常做到
function Review({ log, day }) {
  const [range, setRange] = useState('week');
  const from = range === 'week' ? weekStart(day) : addDays(day, -27);
  const r = tarotReview(log, from, day);
  const name = range === 'week' ? '這週' : '近 4 週';
  return (
    <section className="section tarot-review">
      <h2>回顧</h2>
      <div className="seg two">
        <button className={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>
          本週
        </button>
        <button className={range === 'month' ? 'on' : ''} onClick={() => setRange('month')}>
          近 4 週
        </button>
      </div>
      {!r.drawn ? (
        <p className="muted small">{name}還沒有抽牌紀錄。</p>
      ) : (
        <>
          <div className="review-stats">
            <div className="card stat"><div className="big">{r.drawn}</div><div className="label">抽牌天數</div></div>
            <div className="card stat"><div className="big">{r.done}/{r.total}</div><div className="label">行動完成</div></div>
            <div className="card stat"><div className="big">{r.rate === null ? '-' : `${r.rate}%`}</div><div className="label">完成率</div></div>
          </div>
          {r.best ? (
            <p className="review-insight">
              {name}「現在」是<strong>{r.best.name}</strong>的日子，行動完成 {r.best.rate}%；是<strong>{r.worst.name}</strong>的日子只有 {r.worst.rate}%。
            </p>
          ) : (
            <p className="muted small">{r.total ? '再多累積幾天，就看得出哪類牌的日子比較做得到。' : '還沒有寫行動。在上面「今天的行動」挑一件來做，回顧才有東西看。'}</p>
          )}
          <h3>「現在」那張牌的類別</h3>
          <ul className="review-bars">
            {r.groups.map((g) => (
              <li key={g.key}>
                <span className="rb-name">{g.name}</span>
                <span className="rb-bar"><span style={{ width: `${g.rate ?? 0}%` }} /></span>
                <span className="rb-num num">{g.total ? `${g.done}/${g.total}` : '沒寫行動'}</span>
                <span className="muted small rb-days">{g.days} 天</span>
              </li>
            ))}
          </ul>
          {r.orient.length > 0 && <p className="muted small">{r.orient.map((o) => `${o.name} ${o.days} 天，完成 ${o.rate === null ? '-' : `${o.rate}%`}`).join('；')}</p>}
          {r.repeats.length > 0 && <p className="muted small">重複出現：{r.repeats.map((x) => `${x.card.zh} ${x.count} 次`).join('、')}</p>}
          <CopyButton text={reviewPrompt(r, name)} className="btn" />
          <p className="muted small">複製後貼給 AI，請它幫你看行動的模式和下週可以怎麼調整。</p>
        </>
      )}
    </section>
  );
}

export default function TarotPage() {
  const day = today();
  const { cards, doDraw, prompt, tarotLog, actions, setActions, suggestions } = useTarot(day);
  const [fresh, setFresh] = useState(false);
  const history = Object.entries(tarotLog)
    .filter(([d]) => d < day)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30);
  const streak = tarotStreak(tarotLog, day);

  return (
    <div className="page">
      <header className="page-head">
        <h1>每日塔羅</h1>
        <span className="muted">{shortLabel(day)}</span>
      </header>

      <section className="section tarot-main">
        {!cards ? (
          <>
            <button className="tarot-back" onClick={() => { setFresh(true); doDraw(); }} aria-label="抽今天的三張牌">
              <span>抽三張</span>
            </button>
            <p className="muted center">過去・現在・未來，一天抽一次，明天才能再抽。</p>
          </>
        ) : (
          <>
            <h2>牌義解讀</h2>
            <p className="muted small">塔羅是今天反思的提示，不是一定會發生的預測。</p>
            <Spread cards={cards} fresh={fresh} />
            <ul className="tarot-lines big">
              {cards.map((d, i) => {
                const c = cardById(d.cardId);
                return (
                  <li key={i}>
                    <span className="tarot-pos">{POSITIONS[i]}</span>
                    <strong>{label(d)}</strong>
                    <span>{meaningOf(d)}</span>
                    {c?.arcana === 'minor' && <span className="muted small">{c.suitZh}：{c.theme}</span>}
                  </li>
                );
              })}
            </ul>
            <h2>今天的行動</h2>
            <p className="muted small">挑 1～3 件今天做得到的小事，做完打勾。</p>
            <ActionEditor actions={actions} setActions={setActions} suggestions={suggestions} />
            <CopyButton text={prompt} className="btn primary big wide" />
            <p className="muted small center">AI 會分成「牌義解讀」和「今天的行動建議」兩段回答，行動可以貼回上面。</p>
            <details className="tarot-prompt">
              <summary>看看會複製什麼</summary>
              <pre>{prompt}</pre>
            </details>
            <p className="muted small center">今天已經抽過了，明天再來。{streak > 1 ? `已經連續抽 ${streak} 天。` : ''}</p>
          </>
        )}
      </section>

      <Review log={tarotLog} day={day} />

      <section className="section">
        <h2>之前抽到的</h2>
        {!history.length && <p className="muted small">還沒有紀錄。</p>}
        <ul className="list">
          {history.map(([d, h]) => {
            const list = spreadOf(h);
            return (
              <li key={d} className="ledger-row tarot-hist">
                <span className="ld-date">{shortLabel(d)}</span>
                <span className="tarot-hist-cards">
                  {list.map((x, i) => (
                    <span key={i}>
                      {list.length > 1 && <span className="muted small">{POSITIONS[i]} </span>}
                      <strong>{label(x)}</strong>
                    </span>
                  ))}
                  {(h.actions || []).map((a, i) => (
                    <span key={`a${i}`} className={`ta-hist ${a.done ? 'done' : ''}`}>
                      {a.done ? '做到' : '沒做'}：{a.text}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
