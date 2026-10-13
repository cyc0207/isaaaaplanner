import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data.jsx';
import { today, shortLabel } from '../lib/date.js';
import { DECKS, TOPICS, TOPIC_KEYS, oracleCard, drawFrom, drawTopic, topicReading, topicAction, oraclePrompt, quoteOfDay, BUILTIN_QUOTES, drawColor, colorById, colorLine } from '../lib/oracle.js';
import { CopyButton } from './TarotPage.jsx';

// 每日三抽存在 oracleLog/{日期}：{ wear: { cards, done }, eat: {...}, love: {...}, free: { deck, cards, q } }
function useOracle(day) {
  const { oracleLog, api } = useData();
  const entry = oracleLog[day] || {};
  return {
    entry,
    draw: (topic) => {
      if (entry[topic]?.cards?.length) return;
      api.set(`oracleLog/${day}`, { [topic]: { cards: drawTopic(topic), done: false, at: Date.now() } });
    },
    // 穿搭的顏色元素：一天抽一次，存在 oracleLog/{日期}.color
    drawColor: () => {
      if (entry.color?.colorId) return;
      api.set(`oracleLog/${day}`, { color: { ...drawColor(), at: Date.now() } });
    },
    toggleDone: (topic) => api.set(`oracleLog/${day}`, { [topic]: { done: !entry[topic]?.done } }),
    setFree: (free) => api.set(`oracleLog/${day}`, { free }),
  };
}

export function OracleFace({ id, small, fresh }) {
  const c = oracleCard(id);
  if (!c) return null;
  return (
    <div className={`tarot-card oracle ${c.deck} ${small ? 'small' : ''} ${fresh ? 'fresh' : ''}`} aria-label={`${DECKS[c.deck].name} ${c.zh}`}>
      <div className="tarot-inner">
        <span className="tarot-num">{c.num}</span>
        <span className="tarot-mark">{DECKS[c.deck].name}</span>
        <strong className="tarot-name">{c.zh}</strong>
        <span className="tarot-en">{c.en}</span>
      </div>
    </div>
  );
}

function OracleRow({ ids, positions, fresh }) {
  return (
    <div className="oracle-row" style={{ '--n': ids.length === 9 ? 3 : Math.min(ids.length, 5) }}>
      {ids.map((id, i) => (
        <figure key={id} className="tarot-slot">
          {positions?.[i] && <figcaption>{positions[i]}</figcaption>}
          <OracleFace id={id} fresh={fresh} />
        </figure>
      ))}
    </div>
  );
}

// 今天的顏色元素：抽一個顏色和放的位置
function ColorPick({ pick, onDraw }) {
  const c = pick && colorById(pick.colorId);
  if (!c) {
    return (
      <button className="btn wide color-draw" onClick={onDraw}>
        抽今天的顏色元素
      </button>
    );
  }
  return (
    <div className="color-pick">
      <span className="color-swatch" style={{ background: c.hex }} aria-hidden="true" />
      <span className="grow">
        <span className="oracle-sub">今天的顏色元素</span>
        <strong className="color-name">{c.name}</strong>
        <span className="muted small">{pick.spot}・{c.feel}</span>
      </span>
    </div>
  );
}

function TopicBlock({ topic, data, onDraw, onToggle, day, color, onColor }) {
  const t = TOPICS[topic];
  const [fresh, setFresh] = useState(false);
  const cards = data?.cards || [];
  return (
    <div className="card oracle-topic">
      <div className="row between">
        <h3>{t.name}</h3>
        <span className="muted small">{t.how}</span>
      </div>
      {topic === 'wear' && <ColorPick pick={color} onDraw={onColor} />}
      {!cards.length ? (
        <button className="btn primary wide" onClick={() => { setFresh(true); onDraw(); }}>
          抽{t.positions.length}張
        </button>
      ) : (
        <>
          <OracleRow ids={cards} positions={t.positions} fresh={fresh} />
          <div className="oracle-sub">牌義解讀</div>
          <ul className="tarot-lines">
            {topicReading(topic, cards).map((r) => (
              <li key={r.id}>
                <span className="tarot-pos">{r.pos}</span>
                <strong>{r.card.zh}</strong>
                <span className="muted small">{r.card.key}</span>
                <span className="oracle-hint">{r.text}</span>
              </li>
            ))}
          </ul>
          <div className="oracle-sub">今天的行動</div>
          <ul className="tarot-actions">
            <li className={data.done ? 'done' : ''}>
              <label className="check">
                <input type="checkbox" checked={!!data.done} onChange={onToggle} aria-label="做到了" />
                <span className="box" />
              </label>
              <span className="ta-text">{topicAction(topic, cards, topic === 'wear' ? color : null)}</span>
            </li>
          </ul>
          <div className="row gap wrap">
            {topic === 'wear' && <Link to="/food?tab=snap&what=ootd" className="btn small">拍今天的 OOTD</Link>}
            {topic === 'eat' && (
              <>
                <Link to="/food?wheel=1" className="btn small">轉盤決定</Link>
                <Link to="/food?tab=near" className="btn small">附近餐廳</Link>
              </>
            )}
            <CopyButton
              className="btn small"
              text={oraclePrompt({ day, deck: t.deck, cards, positions: t.positions, question: topic === 'wear' && color?.colorId ? `${t.name}（今天的顏色元素：${colorLine(color)}）` : t.name })}
            />
          </div>
        </>
      )}
    </div>
  );
}

// 自由抽：選牌、選張數、可以寫問題，可以重抽
function FreeDraw({ day, free, setFree }) {
  const [deck, setDeck] = useState(free?.deck || 'lenormand');
  const [n, setN] = useState(free?.n || 3);
  const [q, setQ] = useState(free?.q || '');
  const [fresh, setFresh] = useState(false);
  const spreads = DECKS[deck].spreads;
  const size = spreads.includes(n) ? n : 3;
  const shown = free?.cards?.length ? free : null;
  return (
    <section className="section">
      <h2>自由抽</h2>
      <div className="seg two">
        {Object.entries(DECKS).map(([k, d]) => (
          <button key={k} className={deck === k ? 'on' : ''} onClick={() => setDeck(k)}>
            {d.name}（{d.cards.length} 張）
          </button>
        ))}
      </div>
      <div className="row gap wrap oracle-sizes">
        {spreads.map((s) => (
          <button key={s} className={`chip-btn ${size === s ? 'on' : ''}`} onClick={() => setN(s)}>
            {s === 9 ? '九宮格' : `${s} 張`}
          </button>
        ))}
      </div>
      <form
        className="row gap"
        onSubmit={(e) => {
          e.preventDefault();
          setFresh(true);
          setFree({ deck, n: size, q: q.trim(), cards: drawFrom(deck, size), at: Date.now() });
        }}
      >
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="想問什麼（可以不寫）" />
        <button className="btn primary">抽</button>
      </form>
      {shown && (
        <div className="card oracle-free">
          {shown.q && <p className="muted small">問：{shown.q}</p>}
          <OracleRow ids={shown.cards} fresh={fresh} />
          <ul className="tarot-lines">
            {shown.cards.map((id, i) => {
              const c = oracleCard(id);
              return c && (
                <li key={id}>
                  <span className="tarot-pos">{i + 1}</span>
                  <strong>{c.zh}</strong>
                  <span className="muted small">{c.key}</span>
                </li>
              );
            })}
          </ul>
          <p className="muted small">
            {shown.deck === 'lenormand' ? '雷諾曼把相鄰的牌連起來讀成一句話，例如「騎士＋信」是很快來的消息。' : '西比拉照牌名的生活意思讀，看今天會遇到的人和事。'}
          </p>
          <CopyButton text={oraclePrompt({ day, deck: shown.deck, cards: shown.cards, question: shown.q })} className="btn small primary" />
        </div>
      )}
    </section>
  );
}

// ── 動力小語（宸） ──
function useQuote(day) {
  const { quotes, quoteSettings, api } = useData();
  const offset = quoteSettings.day === day ? quoteSettings.offset || 0 : 0;
  const mineOnly = !!quoteSettings.mineOnly;
  const q = quoteOfDay({ day, mine: quotes, offset, mineOnly });
  return {
    q,
    mineOnly,
    next: () => api.set('settings/quote', { day, offset: offset + 1 }),
    setMineOnly: (v) => api.set('settings/quote', { mineOnly: v }),
  };
}

export function QuoteCard() {
  const day = today();
  const { q, next } = useQuote(day);
  if (!q) return null;
  return (
    <section className="quote-card">
      <div className="quote-head">
        <h2>動力小語（宸）</h2>
        {q.mine && <span className="quote-mine">我寫的</span>}
      </div>
      <p className="quote-text">{q.text}</p>
      <div className="row gap">
        <button className="btn small" onClick={next}>換一句</button>
        <Link to="/oracle#quotes" className="btn small">自己寫一句</Link>
      </div>
    </section>
  );
}

function QuoteManager() {
  const { quotes, api } = useData();
  const day = today();
  const { q, mineOnly, setMineOnly } = useQuote(day);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <section className="section" id="quotes">
      <h2>動力小語（宸）</h2>
      {q && <p className="quote-text small-quote">今天：{q.text}</p>}
      <form
        className="row gap"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return setMsg('先寫一句話');
          if (quotes.some((x) => x.text === t)) return setMsg('這句已經有了');
          api.add('quotes', { text: t.slice(0, 120) });
          setText('');
          setMsg('已新增，之後每天會輪到它');
        }}
      >
        <input className="grow" value={text} maxLength={120} onChange={(e) => { setText(e.target.value); setMsg(''); }} placeholder="寫一句給自己的話" />
        <button className="btn primary">新增</button>
      </form>
      {msg && <p className="hint ok">{msg}</p>}
      <label className="row gap small">
        <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} disabled={!quotes.length} />
        只抽我自己寫的
      </label>
      <ul className="list quote-list">
        {quotes.map((x) => (
          <li key={x.id} className="row between">
            <span className="grow">{x.text}</span>
            <button className="icon-btn" aria-label={`刪除 ${x.text}`} onClick={() => window.confirm('刪掉這句？') && api.remove(`quotes/${x.id}`)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {!quotes.length && <p className="muted small">還沒有自己寫的。現在是從內建的 {BUILTIN_QUOTES.length} 句裡每天輪一句。</p>}
    </section>
  );
}

// 首頁：今日三抽的小卡
export function OracleHomeCard({ day }) {
  const { entry } = useOracle(day);
  return (
    <section className="section">
      <h2>今日小抽</h2>
      <Link to="/oracle" className="card oracle-home">
        {TOPIC_KEYS.map((k) => {
          const cards = entry[k]?.cards || [];
          return (
            <span key={k} className="oracle-home-row">
              <span className="tarot-pos">{TOPICS[k].name}</span>
              {cards.length ? (
                <span>
                  <strong>{cards.map((id) => oracleCard(id)?.zh).join('・')}</strong>
                  {entry[k].done && <span className="chip ok">做到了</span>}
                </span>
              ) : (
                <span className="muted small">還沒抽（{TOPICS[k].how}）</span>
              )}
              {k === 'wear' && entry.color?.colorId && (
                <span className="color-chip">
                  <span className="color-swatch small" style={{ background: colorById(entry.color.colorId)?.hex }} aria-hidden="true" />
                  {colorLine(entry.color)}
                </span>
              )}
            </span>
          );
        })}
      </Link>
    </section>
  );
}

export default function OraclePage() {
  const day = today();
  const { entry, draw, toggleDone, setFree, drawColor: drawColorPick } = useOracle(day);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);
  return (
    <div className="page">
      <header className="page-head">
        <h1>小抽卡</h1>
        <span className="muted">{shortLabel(day)}</span>
      </header>
      <p className="muted small">雷諾曼和西比拉都是今天的小提示，不是一定會發生的預測。每個主題一天抽一次。</p>
      <div className="row gap wrap">
        <Link to="/tarot" className="btn small">每日塔羅</Link>
        <a href="#quotes" className="btn small">動力小語（宸）</a>
      </div>

      <section className="section oracle-topics">
        <h2>今日三抽</h2>
        {TOPIC_KEYS.map((k) => (
          <TopicBlock key={k} topic={k} day={day} data={entry[k]} onDraw={() => draw(k)} onToggle={() => toggleDone(k)} color={entry.color} onColor={drawColorPick} />
        ))}
      </section>

      <FreeDraw day={day} free={entry.free} setFree={setFree} />

      <QuoteManager />
    </div>
  );
}
