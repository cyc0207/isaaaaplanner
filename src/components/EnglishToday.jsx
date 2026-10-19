import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data.jsx';
import { today } from '../lib/date.js';
import { TYPES, buildEnglishPreview, dueItems, newItem, practicable, review } from '../lib/english.js';
import { THEMES, ALL_THEMES } from '../data/decks.js';
import { analyze } from '../lib/affix.js';
import SundayDiscovery from './SundayDiscovery.jsx';
import {
  MODES, MODE_LABEL, cloze, deckProgress, deckToItem, isCorrect, modeOf, pickMode, pickNewWords, refillPrompt, remainingIn, sentencePrompt, weekTheme,
} from '../lib/study.js';

// 「今天」：新字 → 複習（翻卡、填空、拼字）→ 每日一句給 GPT 改 → 錯的變成複習卡
export default function EnglishToday({ goImport }) {
  const { englishItems, englishLog, englishSettings: es, api } = useData();
  const t = today();
  const mode = modeOf(es);
  const cfg = MODES[mode];
  const theme = weekTheme(es, t);
  const [extra, setExtra] = useState(null);

  const learnedToday = englishItems.filter((it) => it.introducedOn === t);
  const newLeft = Math.max(0, cfg.newWords - learnedToday.length);
  const newWords = useMemo(() => pickNewWords(theme, englishItems, newLeft), [theme, englishItems, newLeft]);
  const reviewedToday = englishItems.filter((it) => it.lastReviewed === t).length;
  const due = dueItems(englishItems, t);
  const queue = due.slice(0, Math.max(0, cfg.reviewCap - reviewedToday));
  const progress = deckProgress(englishItems);

  const learn = () => {
    api.batch(
      newWords.map((w) =>
        w.pendingId
          ? { set: `englishItems/${w.pendingId}`, data: { pending: false, introducedOn: t, due: t } }
          : { add: 'englishItems', data: deckToItem(w, t) },
      ),
    );
  };
  const left = remainingIn(theme, englishItems);

  // 新字學完、該複習的也做完：首頁的英文自動打勾
  const finished = !newWords.length && !queue.length && (reviewedToday > 0 || learnedToday.length > 0);
  useEffect(() => {
    if (finished && !englishLog[t]) api.set(`englishLog/${t}`, { minutes: mode, note: `網站：新字 ${learnedToday.length}、複習 ${reviewedToday}` });
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  // 每日一句用的字：今天學的、今天複習的，不夠再補最近學的
  const recent = englishItems.filter((it) => it.introducedOn).sort((a, b) => (b.introducedOn || '').localeCompare(a.introducedOn || ''));
  const sentenceWords = [...new Set([...learnedToday, ...englishItems.filter((it) => it.lastReviewed === t && it.type !== 'fix'), ...recent].map((it) => it.front))].slice(0, 6);

  const setTheme = (k) => api.set('settings/english', { fixedTheme: k === 'auto' ? '' : k });

  return (
    <div className="eng-today">
      <SundayDiscovery />
      <div className="card today-bar">
        <div className="row between wrap gap">
          <label className="theme-pick">
            單字來源
            <select value={THEMES[es.fixedTheme] ? es.fixedTheme : 'auto'} onChange={(e) => setTheme(e.target.value)}>
              <option value="auto">每週輪替（這週：{THEMES[theme].label}）</option>
              {ALL_THEMES.map((k) => (
                <option key={k} value={k}>
                  {THEMES[k].label}（已學 {progress[k].learned}/{progress[k].total}）
                </option>
              ))}
            </select>
          </label>
          <div className="seg three-mini">
            {[5, 15, 20].map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => api.set('settings/english', { mode: m })}>
                {MODES[m].label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          {cfg.newWords} 個新字＋最多 {cfg.reviewCap} 張複習{cfg.sentence ? '＋每日一句' : ''}。雅思、多益、托福卡組由簡單排到難。
        </p>
      </div>

      <section className="section">
        <h2>1. 新字</h2>
        {newWords.length ? (
          <NewWordDeck key={newWords.map((w) => w.front).join('|')} words={newWords} onDone={learn} />
        ) : (
          <p className="muted small">
            {learnedToday.length ? `今天的 ${learnedToday.length} 個新字學好了：${learnedToday.map((x) => x.front).join('、')}` : '這個卡組學完了，可以換一個，或請 ChatGPT 補字。'}
          </p>
        )}
        {left < cfg.newWords * 3 && <Refill theme={theme} left={left} />}
      </section>

      <section className="section">
        <h2>2. 複習</h2>
        {extra ? (
          <ExtraPractice cards={extra} onDone={() => setExtra(null)} />
        ) : queue.length ? (
          <>
            <p className="muted small">
              還有 <span className="num">{queue.length}</span> 張{due.length > queue.length ? `（今天上限 ${cfg.reviewCap} 張，其他明天再說）` : ''}
            </p>
            <ReviewCard key={queue[0].id + (queue[0].reps || 0)} card={queue[0]} onAnswer={(ok) => api.update(`englishItems/${queue[0].id}`, review(queue[0], ok, t))} />
          </>
        ) : (
          <div className="empty-eng">
            <p className="strong">{reviewedToday ? `今天複習了 ${reviewedToday} 張。` : '今天沒有要複習的。'}</p>
            {englishLog[t] && <p className="muted small">首頁的英文已經打勾。</p>}
            {englishItems.some(practicable) ? (
              <button className="btn small" onClick={() => setExtra(englishItems.filter(practicable).sort(() => Math.random() - 0.5).slice(0, 10))}>
                隨機加練 10 張
              </button>
            ) : (
              <button className="btn small" onClick={goImport}>
                去匯入
              </button>
            )}
          </div>
        )}
      </section>

      {cfg.sentence ? (
        <DailySentence words={sentenceWords} />
      ) : (
        <details className="section">
          <summary className="strong">3. 每日一句（5 分鐘模式可跳過）</summary>
          <DailySentence words={sentenceWords} bare />
        </details>
      )}
    </div>
  );
}

// 一張複習卡：依熟悉度輪流用翻卡、情境填空、看中文拼字
export function ReviewCard({ card, onAnswer, forceFlip }) {
  const mode = forceFlip ? 'flip' : pickMode(card);
  const [flipped, setFlipped] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const cz = mode === 'cloze' ? cloze(card.example, card.front) : null;

  useEffect(() => {
    if (mode !== 'flip') inputRef.current?.focus({ preventScroll: true });
  }, [mode]);

  const check = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setResult(isCorrect(input, cz ? [cz.answer, card.front] : [card.front]));
  };

  return (
    <div className={`flash ${flipped || result !== null ? 'flipped' : ''}`} onClick={() => mode === 'flip' && !flipped && setFlipped(true)}>
      <div className="flash-meta">
        <span className="chip">{MODE_LABEL[mode]}</span>
        <span className="chip">{TYPES[card.type]}</span>
        {(card.tags || []).slice(0, 2).map((x) => (
          <span key={x} className="chip">
            {x}
          </span>
        ))}
      </div>

      {mode === 'flip' && (
        <>
          {card.type === 'fix' && <p className="muted small">這句哪裡錯？</p>}
          <p className="flash-front">{card.front}</p>
          {flipped ? (
            <div className="flash-back">
              <Answer card={card} />
              <div className="row gap flash-btns">
                <button className="btn grow" onClick={(e) => { e.stopPropagation(); onAnswer(false); }}>
                  忘了
                </button>
                <button className="btn primary grow" onClick={(e) => { e.stopPropagation(); onAnswer(true); }}>
                  記得
                </button>
              </div>
            </div>
          ) : (
            <p className="muted small flash-tap">先在心裡想意思，再點一下看答案</p>
          )}
        </>
      )}

      {mode !== 'flip' && (
        <>
          {cz ? (
            <p className="flash-cloze">
              {cz.before}
              <span className="blank">{result === null ? '＿＿＿' : cz.answer}</span>
              {cz.after}
            </p>
          ) : (
            <p className="flash-front">{card.back}</p>
          )}
          <p className="muted small">
            {cz ? `提示：${card.back}` : `${card.pos ? `${card.pos}・` : ''}${card.front.length} 個字母，開頭是 ${card.front[0]}`}
          </p>
          {result === null ? (
            <form className="row gap" onSubmit={check}>
              <input
                ref={inputRef} className="grow spell-input" value={input} onChange={(e) => setInput(e.target.value)}
                autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} placeholder="打英文"
              />
              <button className="btn primary">對答案</button>
            </form>
          ) : (
            <div className="flash-back">
              <p className={result ? 'hint ok strong' : 'hint over strong'}>{result ? '答對了！' : `答案是 ${cz ? cz.answer : card.front}`}</p>
              <Answer card={card} />
              <div className="row gap flash-btns">
                {!result && (
                  <button className="btn grow" onClick={() => onAnswer(true)}>
                    只是打錯字，算對
                  </button>
                )}
                <button className="btn primary grow" onClick={() => onAnswer(result)}>
                  下一張
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Answer({ card }) {
  return (
    <>
      <p className="flash-answer">{card.type === 'fix' ? card.back : `${card.front}${card.back ? `：${card.back}` : ''}`}</p>
      {card.collocation && <div className="word-line"><span className="word-tag">搭配</span>{card.collocation}</div>}
      {card.root && <div className="word-line"><span className="word-tag">字根</span>{card.root}</div>}
      {card.example && <p className="flash-example">{card.example}</p>}
      {card.note && <p className="muted small">{card.note}</p>}
    </>
  );
}

// 加練：不改複習排程
function ExtraPractice({ cards, onDone }) {
  const [i, setI] = useState(0);
  if (i >= cards.length) {
    return (
      <div className="empty-eng">
        <p className="strong">加練完了。</p>
        <button className="btn small" onClick={onDone}>
          好
        </button>
      </div>
    );
  }
  return (
    <>
      <p className="muted small">加練 {i + 1}/{cards.length}（不影響複習排程）</p>
      <ReviewCard key={i} card={cards[i]} onAnswer={() => setI(i + 1)} />
    </>
  );
}

// 每日一句：寫 → 複製給 GPT 改 → 貼回來 → 錯的句子變成「改錯」卡
function DailySentence({ words, bare }) {
  const { englishJournal, englishItems, api } = useData();
  const t = today();
  const entry = englishJournal[t] || {};
  const [text, setText] = useState(entry.text || '');
  const [copied, setCopied] = useState(false);
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState('');

  const copy = async () => {
    api.set(`englishJournal/${t}`, { text: text.trim(), words, date: t });
    const p = sentencePrompt(words, text);
    try {
      await navigator.clipboard.writeText(p);
      setCopied(true);
    } catch {
      window.prompt('複製下面這段', p);
    }
  };

  const doImport = () => {
    const rows = preview.rows.filter((r) => r.selected && r.status !== 'error');
    api.batch(rows.map((r) => ({ add: 'englishItems', data: newItem({ ...r, source: r.source || 'gpt' }, t) })));
    api.set(`englishJournal/${t}`, { corrected: true, imported: rows.length });
    setMsg(rows.length ? `加了 ${rows.length} 張卡，明天開始會出現在複習裡。` : '這次沒有要加的卡。');
    setPreview(null);
    setRaw('');
  };

  const body = (
    <>
      <p className="muted small">
        {words.length ? '試著用今天的字造 1～3 句，或錄 30 秒口說後把內容打下來：' : '用最近學的字造 1～3 句：'}
      </p>
      {words.length > 0 && (
        <div className="type-chips">
          {words.map((w) => (
            <span key={w} className="chip">
              {w}
            </span>
          ))}
        </div>
      )}
      <textarea className="paste sentence-box" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="I made a decision to…" />
      <div className="row gap wrap">
        <button className="btn primary" onClick={copy} disabled={!text.trim()}>
          {copied ? '已複製，貼給 ChatGPT' : '存起來並複製給 ChatGPT 改'}
        </button>
      </div>
      {(copied || entry.text) && !entry.corrected && (
        <>
          <p className="muted small">把 ChatGPT 的回覆整段貼回來，改過的句子會變成「改錯」卡：</p>
          <textarea className="paste" rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="貼上 ChatGPT 的回覆" />
          <button className="btn" disabled={!raw.trim()} onClick={() => setPreview(buildEnglishPreview(raw, englishItems))}>
            檢查
          </button>
        </>
      )}
      {preview?.error && <p className="hint over">{preview.error}</p>}
      {preview && !preview.error && (
        <div className="preview">
          <ul className="list">
            {preview.rows.map((r, i) => (
              <li key={i} className={`fix-row st-${r.status}`}>
                <label className="row gap">
                  <input
                    type="checkbox" checked={r.selected} disabled={r.status === 'error'}
                    onChange={() => setPreview({ ...preview, rows: preview.rows.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)) })}
                  />
                  <span className="grow">
                    {r.type === 'fix' ? (
                      <>
                        <s className="muted">{r.front}</s>
                        <br />
                        <strong>{r.back}</strong>
                      </>
                    ) : (
                      <>
                        <strong>{r.front}</strong> {r.back}
                      </>
                    )}
                    {r.note && <span className="muted small"><br />{r.note}</span>}
                    {r.status !== 'ok' && <span className="muted small">（{r.status === 'duplicate' ? '已經有了' : r.errors.join('；')}）</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button className="btn primary" onClick={doImport}>
            加入 {preview.rows.filter((r) => r.selected).length} 張複習卡
          </button>
        </div>
      )}
      {(msg || entry.corrected) && <p className="hint ok">{msg || `今天的句子已經改好，加了 ${entry.imported || 0} 張卡。`}</p>}
    </>
  );
  if (bare) return <div className="sentence-inner">{body}</div>;
  return (
    <section className="section">
      <h2>3. 每日一句</h2>
      {body}
    </section>
  );
}

// 把單字裡的字首、字根、字尾標色
export function AffixWord({ word }) {
  const parts = analyze(word);
  if (!parts.length) return word;
  const out = [];
  let i = 0;
  for (const p of parts) {
    if (p.start < i) continue;
    if (p.start > i) out.push(<span key={`t${i}`}>{word.slice(i, p.start)}</span>);
    out.push(
      <span key={`a${p.start}`} className={`af af-${p.kind}`}>
        {word.slice(p.start, p.end)}
      </span>,
    );
    i = p.end;
  }
  if (i < word.length) out.push(<span key="end">{word.slice(i)}</span>);
  return <span className="af-word">{out}</span>;
}

export function AffixLegend({ word }) {
  const parts = analyze(word);
  if (!parts.length) return null;
  return (
    <div className="af-legend">
      {parts.map((p) => (
        <span key={p.start} className={`af-chip af-${p.kind}`}>
          {p.kind === 'prefix' ? `${p.part}-` : p.kind === 'suffix' ? `-${p.part}` : p.part} {p.zh}
        </span>
      ))}
    </div>
  );
}

// 新字一張一張看：先想意思，點一下翻面
function NewWordDeck({ words, onDone }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const w = words[i];
  const go = (n) => {
    setI(n);
    setFlipped(false);
  };
  return (
    <div className="new-deck">
      <div className="row between">
        <span className="muted small">
          第 <span className="num">{i + 1}</span> / {words.length} 個
        </span>
        <div className="deck-dots" aria-hidden="true">
          {words.map((x, j) => (
            <i key={x.front} className={j === i ? 'on' : j < i ? 'seen' : ''} />
          ))}
        </div>
      </div>
      <div className={`flash big-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
        <div className="row between">
          <span className="chip">{THEMES[w.deck]?.label || (w.tags || [])[0] || '新字'}</span>
          {w.pos && <span className="muted small">{w.pos}</span>}
        </div>
        <p className="flash-front big-word">
          <AffixWord word={w.front} />
        </p>
        <AffixLegend word={w.front} />
        {flipped ? (
          <div className="flash-back">
            <p className="flash-answer">{w.back}</p>
            {w.collocation && <div className="word-line"><span className="word-tag">搭配</span>{w.collocation}</div>}
            {w.root && <div className="word-line"><span className="word-tag">字根</span>{w.root}</div>}
            {w.example && <p className="flash-example">{w.example}</p>}
          </div>
        ) : (
          <p className="muted small flash-tap">先想想意思，點一下翻面</p>
        )}
      </div>
      <div className="row gap">
        <button className="btn grow" disabled={!i} onClick={() => go(i - 1)}>
          上一個
        </button>
        {i < words.length - 1 ? (
          <button className="btn primary grow" onClick={() => go(i + 1)}>
            下一個
          </button>
        ) : (
          <button className="btn primary grow" onClick={onDone}>
            {words.length} 個都看完了，加入複習
          </button>
        )}
      </div>
    </div>
  );
}

// 卡組快用完：請 ChatGPT 再補一批，貼回來變成待學新字
function Refill({ theme, left }) {
  const { englishItems, api } = useData();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState('');
  const t = today();
  const copy = async () => {
    const p = refillPrompt(theme, englishItems);
    try {
      await navigator.clipboard.writeText(p);
    } catch {
      window.prompt('複製下面這段', p);
    }
    setOpen(true);
  };
  const doImport = () => {
    const rows = preview.rows.filter((r) => r.selected && r.status !== 'error');
    const ops = rows.map((r) => ({
      add: 'englishItems',
      data: { ...newItem({ ...r, tags: r.tags.length ? r.tags : [THEMES[theme].label] }, t), pending: true, deck: theme, introducedOn: '' },
    }));
    for (let i = 0; i < ops.length; i += 400) api.batch(ops.slice(i, i + 400));
    setMsg(`補了 ${rows.length} 個字，之後的每日新字會從這裡出。`);
    setPreview(null);
    setRaw('');
    setOpen(false);
  };
  return (
    <div className="card refill">
      <p className="small">
        「{THEMES[theme].label}」還剩 <span className="num">{left}</span> 個字沒學。可以請 ChatGPT 再補 100 個（會避開你已經有的字）。
      </p>
      <button className="btn small" onClick={copy}>
        複製補字 prompt
      </button>
      {open && (
        <>
          <textarea className="paste" rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="把 ChatGPT 的回覆整段貼在這裡" />
          <button className="btn small" disabled={!raw.trim()} onClick={() => setPreview(buildEnglishPreview(raw, englishItems))}>
            檢查
          </button>
        </>
      )}
      {preview?.error && <p className="hint over">{preview.error}</p>}
      {preview && !preview.error && (
        <div className="row gap wrap">
          <span className="small">新的 {preview.rows.filter((r) => r.status === 'ok').length} 個，重複或有錯的會略過。</span>
          <button className="btn small primary" onClick={doImport}>
            加入待學
          </button>
        </div>
      )}
      {msg && <p className="hint ok">{msg}</p>}
    </div>
  );
}
