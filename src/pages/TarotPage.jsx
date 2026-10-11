import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, shortLabel } from '../lib/date.js';
import { todayTasks } from '../lib/plan.js';
import { cardById, cardNumeral, drawCard, meaningOf, tarotPrompt, tarotStreak } from '../lib/tarot.js';

// 抽牌：每天一張，存在 tarotLog/{日期}，換裝置也是同一張
function useTarot(day) {
  const { tarotLog, api, tasks, habits, habitLog, energyLog } = useData();
  const draw = tarotLog[day] || null;
  const doDraw = () => {
    if (tarotLog[day]) return;
    api.set(`tarotLog/${day}`, { ...drawCard(), createdAtMs: Date.now() }, false);
  };
  const prompt = draw
    ? tarotPrompt({
        day,
        draw,
        tasks: todayTasks(tasks, day).shown.filter((t) => !t.done).map((t) => t.title),
        habitsDone: habits.filter((h) => habitLog[day]?.done?.[h]),
        energy: energyLog[day]?.level || null,
      })
    : '';
  return { draw, doDraw, prompt, tarotLog };
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
  const { draw, doDraw, prompt } = useTarot(day);
  const [fresh, setFresh] = useState(false);
  if (!draw) {
    return (
      <section className="section tarot-home">
        <div className="row between">
          <h2>今日塔羅</h2>
          <button className="btn small primary" onClick={() => { setFresh(true); doDraw(); }}>
            抽今天的牌
          </button>
        </div>
      </section>
    );
  }
  const c = cardById(draw.cardId);
  return (
    <section className="section tarot-home">
      <h2>今日塔羅</h2>
      <div className="tarot-row card">
        <TarotFace draw={draw} small fresh={fresh} />
        <div className="tarot-text">
          <strong>
            {c?.zh}・{draw.reversed ? '逆位' : '正位'}
          </strong>
          <span className="muted small">{meaningOf(draw)}</span>
          <div className="row gap wrap">
            <CopyButton text={prompt} className="btn small primary" />
            <Link to="/tarot" className="btn small">
              看紀錄
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TarotPage() {
  const day = today();
  const { draw, doDraw, prompt, tarotLog } = useTarot(day);
  const [fresh, setFresh] = useState(false);
  const history = Object.entries(tarotLog)
    .filter(([d]) => d < day)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30);
  const streak = tarotStreak(tarotLog, day);
  const c = draw && cardById(draw.cardId);

  return (
    <div className="page">
      <header className="page-head">
        <h1>每日塔羅</h1>
        <span className="muted">{shortLabel(day)}</span>
      </header>

      <section className="section tarot-main">
        {!draw ? (
          <>
            <button className="tarot-back" onClick={() => { setFresh(true); doDraw(); }} aria-label="抽今天的牌">
              <span>抽一張</span>
            </button>
            <p className="muted center">一天一張，明天才能再抽。</p>
          </>
        ) : (
          <>
            <TarotFace draw={draw} fresh={fresh} />
            <div className="tarot-result center">
              <strong>
                {c?.zh}・{draw.reversed ? '逆位' : '正位'}
              </strong>
              <p>{meaningOf(draw)}</p>
              {c?.arcana === 'minor' && <p className="muted small">{c.suitZh}：{c.theme}</p>}
            </div>
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
            const hc = cardById(h.cardId);
            return (
              <li key={d} className="ledger-row tarot-hist">
                <span className="ld-date">{shortLabel(d)}</span>
                <span>
                  <strong>
                    {hc?.zh}・{h.reversed ? '逆位' : '正位'}
                  </strong>
                  <span className="muted small"> {meaningOf(h)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
