import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today } from '../lib/date.js';
import { buildLexicon, familiarity, segment } from '../lib/affix.js';
import { THEMES, ALL_THEMES } from '../data/decks.js';
import { deckToItem } from '../lib/study.js';
import { Sheet } from './ui.jsx';
import { AffixLegend, AffixWord } from './EnglishToday.jsx';

const LEVEL = { learning: '還不熟', known: '熟了', new: '題庫裡的字' };

// 文章裡的字分三種顏色：卡片上還不熟的、熟了的、題庫裡還沒學的；點一下看意思
export function Reader({ text, onAddCard }) {
  const { englishItems, api } = useData();
  const [pick, setPick] = useState(null);

  const lex = useMemo(() => {
    const mine = englishItems.filter((it) => !it.pending);
    const have = new Set(mine.map((it) => it.front.trim().toLowerCase()));
    const deck = ALL_THEMES.flatMap((k) => THEMES[k].words).filter((w) => !have.has(w.front.toLowerCase()));
    // 先放題庫的字，再放自己的卡片，同一個字以自己的卡片為準
    return buildLexicon([...deck.map((w) => ({ ...w, level: 'new' })), ...mine.map((c) => ({ ...c, level: familiarity(c) }))]);
  }, [englishItems]);
  const segs = useMemo(() => segment(text || '', lex), [text, lex]);

  const counts = segs.reduce((c, s) => (s.card ? { ...c, [s.card.level]: (c[s.card.level] || 0) + 1 } : c), {});

  // 例句：被點的字所在的那一句
  const sentenceAt = (idx) => {
    let start = idx;
    while (start > 0 && !/[.!?\n]\s*$/.test(segs[start - 1].text)) start--;
    let end = idx;
    while (end < segs.length - 1 && !/[.!?\n]/.test(segs[end].text)) end++;
    return segs.slice(start, end + 1).map((s) => s.text).join('').trim().slice(0, 300);
  };

  return (
    <div className="reader">
      <div className="reader-legend">
        <span className="hl hl-learning">還不熟 {counts.learning || 0}</span>
        <span className="hl hl-known">熟了 {counts.known || 0}</span>
        <span className="hl hl-new">題庫的字 {counts.new || 0}</span>
        <span className="muted small">點任何字看意思和字根</span>
      </div>
      <div className="reader-body" lang="en">
        {segs.map((s, i) =>
          s.word ? (
            <span
              key={i}
              className={`rw ${s.card ? `hl hl-${s.card.level}` : ''} ${pick?.i === i ? 'picked' : ''}`}
              onClick={() => setPick({ i, seg: s, sentence: sentenceAt(i) })}
            >
              {s.text}
            </span>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </div>
      {pick && (
        <div className="word-pop" role="dialog">
          <button className="icon-btn small pop-x" onClick={() => setPick(null)} aria-label="關閉">
            ×
          </button>
          <p className="pop-word">
            <AffixWord word={pick.seg.card?.front || pick.seg.text} />
            {pick.seg.card && <span className={`hl hl-${pick.seg.card.level} pop-level`}>{LEVEL[pick.seg.card.level]}</span>}
          </p>
          {pick.seg.card ? (
            <>
              <p className="flash-answer">{pick.seg.card.back}</p>
              {pick.seg.card.collocation && <div className="word-line"><span className="word-tag">搭配</span>{pick.seg.card.collocation}</div>}
              {pick.seg.card.root && <div className="word-line"><span className="word-tag">字根</span>{pick.seg.card.root}</div>}
            </>
          ) : (
            <p className="muted small">不在你的卡片和題庫裡。</p>
          )}
          <AffixLegend word={(pick.seg.card?.front || pick.seg.text).split(/\s+/).sort((a, b) => b.length - a.length)[0]} />
          {pick.seg.card?.level === 'new' && (
            <button
              className="btn small primary"
              onClick={() => {
                api.add('englishItems', { ...deckToItem(pick.seg.card, today()), example: pick.sentence || pick.seg.card.example });
                setPick(null);
              }}
            >
              加入我的卡片
            </button>
          )}
          {!pick.seg.card && onAddCard && (
            <button
              className="btn small primary"
              onClick={() => {
                onAddCard({ type: 'word', front: pick.seg.text.toLowerCase(), example: pick.sentence, source: 'reading', tags: ['閱讀'] });
                setPick(null);
              }}
            >
              加成卡片
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_TOPICS = ['wealth management', 'interest rates', 'personal finance'];

const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

// 依你學過的金融、職場片語，挑兩個當今天的搜尋主題
function vocabTopics(items) {
  const pool = items.filter((it) => !it.pending && ['finance', 'work'].includes(it.deck) && /\s/.test(it.front.trim()));
  return pool.sort(() => Math.random() - 0.5).slice(0, 2).map((it) => it.front);
}

// 每天第一次打開時抓一次：預設的英文金融新聞＋你的主題＋依你的字挑的主題
export function Articles({ onAddCard }) {
  const { uid, englishItems, englishSettings: es, api } = useData();
  const t = today();
  const ref = doc(db, 'users', uid, 'englishFeed', t);
  const topics = es.readTopics || DEFAULT_TOPICS;
  const [feed, setFeed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState('');

  const fetchFeed = async () => {
    setBusy(true);
    setErr('');
    try {
      const auto = es.vocabTopics === false ? [] : vocabTopics(englishItems);
      const all = [...new Set([...topics, ...auto])];
      const res = await fetch(`/api/articles?topics=${encodeURIComponent(all.join('|'))}`);
      const j = await res.json();
      const items = (j.items || []).slice(0, 40);
      const data = { items, topics: all, fetchedAt: Date.now(), read: {} };
      await setDoc(ref, data);
      setFeed(data);
      if (!items.length) setErr('今天沒抓到文章，等一下再按「重新抓」試試。');
    } catch {
      setErr('抓文章要在正式網站上才能用（本機預覽沒有 /api）。');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    getDoc(ref)
      .then((s) => (s.exists() ? setFeed(s.data()) : fetchFeed()))
      .catch(() => fetchFeed());
  }, [uid, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const read = async (it) => {
    const id = hash(it.link);
    const rref = doc(db, 'users', uid, 'englishReads', id);
    setLoading(it.link);
    try {
      const s = await getDoc(rref);
      let a = s.exists() ? s.data() : null;
      if (!a) {
        let j = {};
        try {
          j = await (await fetch(`/api/article?url=${encodeURIComponent(it.link)}`)).json();
        } catch {
          j = { error: '抓不到內文' };
        }
        a = { title: it.title, link: it.link, source: it.source || it.feed || '', text: j.text || '', summary: it.summary || '', error: j.error || '', date: t };
        if (a.text) await setDoc(rref, a);
      }
      setOpen(a);
      if (feed && !feed.read?.[id]) {
        const next = { ...feed, read: { ...(feed.read || {}), [id]: true } };
        setFeed(next);
        updateDoc(ref, { [`read.${id}`]: true }).catch(() => {});
      }
    } finally {
      setLoading('');
    }
  };

  const saveTopics = (list) => api.set('settings/english', { readTopics: list });

  return (
    <section className="section">
      <h2>今天的英文文章</h2>
      <div className="card topics-card">
        <div className="type-chips">
          {topics.map((x) => (
            <span key={x} className="chip topic-chip">
              {x}
              <button aria-label={`移除 ${x}`} onClick={() => saveTopics(topics.filter((y) => y !== x))}>
                ×
              </button>
            </span>
          ))}
        </div>
        <form
          className="row gap"
          onSubmit={(e) => {
            e.preventDefault();
            const v = topicInput.trim();
            if (v && !topics.includes(v)) saveTopics([...topics, v].slice(0, 6));
            setTopicInput('');
          }}
        >
          <input className="grow" value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="想看的方向，例如 ETF、IELTS reading" />
          <button className="btn small">加主題</button>
        </form>
        <label className="inline small">
          <input type="checkbox" checked={es.vocabTopics !== false} onChange={(e) => api.set('settings/english', { vocabTopics: e.target.checked })} />
          另外依我學過的金融、職場字挑主題
        </label>
        <div className="row between">
          <span className="muted small">
            {feed?.fetchedAt ? `${new Date(feed.fetchedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 抓的，每天第一次打開會自動更新` : '每天第一次打開會自動抓'}
          </span>
          <button className="btn small" onClick={fetchFeed} disabled={busy}>
            {busy ? '抓文章中…' : '重新抓'}
          </button>
        </div>
      </div>
      {err && <p className="hint warn">{err}</p>}
      <ul className="list articles">
        {(feed?.items || []).map((it) => {
          const done = feed.read?.[hash(it.link)];
          return (
            <li key={it.link} className={`mail-row article-row ${done ? 'done' : ''}`} onClick={() => read(it)}>
              <span className="mail-subject">{it.title}</span>
              <div className="task-meta">
                <span className="chip">{it.topic ? `#${it.topic}` : it.feed}</span>
                {it.source && it.source !== it.feed && <span>{it.source}</span>}
                {it.date ? <span>{new Date(it.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span> : null}
                {done && <span className="chip ok">讀過</span>}
                {loading === it.link && <span>載入中…</span>}
              </div>
              {it.summary && <p className="mail-snippet">{it.summary}</p>}
            </li>
          );
        })}
      </ul>
      {open && (
        <Sheet title={open.title} onClose={() => setOpen(null)}>
          <div className="task-meta">
            <span>{open.source}</span>
            <a href={open.link} target="_blank" rel="noreferrer">
              看原文
            </a>
          </div>
          {!open.text && <p className="hint warn">{open.error || '這篇抓不到全文'}，先讀摘要，完整內容請點「看原文」。</p>}
          <Reader text={open.text || open.summary} onAddCard={onAddCard} />
        </Sheet>
      )}
    </section>
  );
}

// 自己貼一段英文進來讀
export function PasteRead({ onAddCard }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <section className="section">
      <h2>貼一段英文來讀</h2>
      <textarea className="paste sentence-box" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="貼上新聞、文章或考古題的英文段落" />
      <button className="btn primary" disabled={!text.trim()} onClick={() => setOpen(true)}>
        開始閱讀
      </button>
      {open && (
        <Sheet title="閱讀" onClose={() => setOpen(false)}>
          <Reader text={text} onAddCard={onAddCard} />
        </Sheet>
      )}
    </section>
  );
}
