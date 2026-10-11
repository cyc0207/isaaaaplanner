import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, shortLabel } from '../lib/date.js';
import { todayTasks } from '../lib/plan.js';
import { cardById, cardNumeral, drawSpread, meaningOf, tarotPrompt, tarotStreak, spreadOf, isFullSpread, POSITIONS } from '../lib/tarot.js';

// 抽牌：每天一次「過去・現在・未來」三張，存在 tarotLog/{日期}，換裝置也是同一組
function useTarot(day) {
  const { tarotLog, api, tasks, habits, habitLog, energyLog } = useData();
  // 舊版一天只抽一張；那天可以重抽成三張
  const cards = isFullSpread(tarotLog[day]) ? spreadOf(tarotLog[day]) : null;
  const doDraw = () => {
    if (isFullSpread(tarotLog[day])) return;
    api.set(`tarotLog/${day}`, { cards: drawSpread(), createdAtMs: Date.now() }, false);
  };
  const prompt = cards
    ? tarotPrompt({
        day,
        cards,
        tasks: todayTasks(tasks, day).shown.filter((t) => !t.done).map((t) => t.title),
        habitsDone: habits.filter((h) => habitLog[day]?.done?.[h]),
        energy: energyLog[day]?.level || null,
      })
    : '';
  return { cards, doDraw, prompt, tarotLog };
}

const label = (d) => `${cardById(d.cardId)?.zh || ''}・${d.reversed ? '逆位' : '正位'}`;

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
  const { cards, doDraw, prompt } = useTarot(day);
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

export default function TarotPage() {
  const day = today();
  const { cards, doDraw, prompt, tarotLog } = useTarot(day);
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
            <CopyButton text={prompt} className="btn primary big wide" />
            <details className="tarot-prompt">
              <summary>看看會複製什麼</summary>
              <pre>{prompt}</pre>
            </details>
            <p className="muted small center">今天已經抽過了，明天再來。{streak > 1 ? `已經連續抽 ${streak} 天。` : ''}</p>
          </>
        )}
      </section>

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
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
