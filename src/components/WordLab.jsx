import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today } from '../lib/date.js';
import { itemKey, newItem, review } from '../lib/english.js';
import { ENGLISH_HABIT } from '../lib/seed.js';
import { logError } from '../lib/errlog.js';
import { canSpeak, speak } from '../lib/speech.js';
import { CORE_WORDS } from '../data/wordLab.js';
import {
  STEPS, DONE_STEP, SKILLS, ERROR_TYPES, KIND_LABEL, MODES, BACKLOG, LAB_TAG, wordById,
  arrange, pctText, stepOf, isStarted, isFinished, stepComplete, nextQuestion, visibleExamples, startData, answerUpdate, advanceData, enterSrsOps,
  sentenceId, sentencePrompt, parseFeedback, submitSentence, addFeedback, SENTENCE_STATUS, ISSUE_LABEL,
  reviewTask, dailyPlan, quickPicks, quickQuestion, quickUpdate, toeicPicks, dayFinished, wordStats, BOX_LABEL,
  speakingErrors, errorCloze, errorRewriteTask, errorOwnTask, errorWordId,
  fullSentence, GAMES, STEP_GAME, listenGame, matchGame, dictationGame, dictationOk, builderGame, builderOk, gameUpdate, seedOf,
} from '../lib/wordLab.js';

// 口說錯誤庫的 ChatGPT 交換格式 JSON（唯讀，只拿來出題）
const DATASETS = Object.values(import.meta.glob('../data/speaking-*.json', { eager: true, import: 'default' }));

const LETTERS = 'ABCD';

// 喇叭按鈕：用瀏覽器內建的英文語音念出來（不是錄音檔）；slow 用慢速
const SPEAKER = 'M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11';
export function Say({ text, slow, label }) {
  if (!text || !canSpeak()) return null;
  return (
    <button
      type="button"
      className={`say ${slow ? 'slow' : ''}`}
      aria-label={label || (slow ? `慢慢念 ${text}` : `念出 ${text}`)}
      title={slow ? '慢速' : '發音'}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, slow ? 0.6 : 0.9);
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={SPEAKER} />
      </svg>
      {slow && <span>慢</span>}
    </button>
  );
}

// 自動發音（設定裡可以關）
const autoOn = (ws) => ws?.autoSpeak !== false;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('複製下面這段', text);
    return false;
  }
}

// 進度、造句、今天的紀錄：只在單字分頁訂閱
function useWordLab() {
  const { uid } = useData();
  const t = today();
  const [states, setStates] = useState(null);
  const [sentences, setSentences] = useState(null);
  const [day, setDay] = useState(null);
  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'users', uid, 'wordLab'),
      (snap) => setStates(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
      (e) => logError('讀取單字實驗室', e, { show: false }),
    );
    const u2 = onSnapshot(
      collection(db, 'users', uid, 'wordLabSentences'),
      (snap) => setSentences(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => logError('讀取造句', e, { show: false }),
    );
    const u3 = onSnapshot(
      doc(db, 'users', uid, 'wordLabDays', t),
      (snap) => setDay(snap.exists() ? snap.data() : {}),
      (e) => logError('讀取單字實驗室今天', e, { show: false }),
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, [uid, t]);
  return { states, sentences, day, t, loaded: !!(states && sentences && day) };
}

export default function WordLab() {
  const { englishItems, api, wordLabSettings: ws, habits, habitLog, englishLog } = useData();
  const lab = useWordLab();
  const { states, sentences, day, t } = lab;
  const [view, setView] = useState({ name: 'home' });

  const plan = useMemo(() => (states ? dailyPlan({ settings: ws, states, items: englishItems, t }) : null), [ws, states, englishItems, t]);
  const quickN = plan?.cfg.quick || 0;
  const finished = !!(plan && states && day && dayFinished(plan, states, day, quickN));

  // 今天的 Word Lab 做完：首頁的英文打勾（和今天、任務、TOEIC 用同一個紀錄）
  useEffect(() => {
    if (!finished) return;
    if (habits.includes(ENGLISH_HABIT) && !habitLog[t]?.done?.[ENGLISH_HABIT]) api.set(`habitLog/${t}`, { done: { [ENGLISH_HABIT]: true } });
    if (!englishLog[t]) api.set(`englishLog/${t}`, { minutes: plan.mode, note: '單字實驗室' });
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lab.loaded) return <p className="muted">載入中…</p>;
  const back = () => setView({ name: 'home' });

  if (view.name === 'word') return <WordFlow key={view.id} word={wordById[view.id]} lab={lab} onBack={back} />;
  if (view.name === 'review') return <ReviewSession lab={lab} due={plan.due} onBack={back} />;
  if (view.name === 'quick') return <QuickSession lab={lab} n={quickN} onBack={back} />;
  if (view.name === 'toeic') return <ToeicMini lab={lab} n={plan.cfg.toeic} onBack={back} />;
  if (view.name === 'errors') return <ErrorList lab={lab} onBack={back} />;
  if (view.name === 'arena') return <GameArena lab={lab} words={arenaWords(plan, states)} onBack={back} />;
  if (view.name === 'stats') return <Stats lab={lab} onBack={back} onOpen={(id) => setView({ name: 'word', id })} />;

  const setMode = (m) => api.set('settings/wordLab', { mode: m, newPerDay: null });
  const setNew = (n) => api.set('settings/wordLab', { newPerDay: Math.max(0, Math.min(5, n)) });
  const toeicDone = !!day.toeic?.done;
  const quickDone = (day.quickDone || 0) >= quickN;

  return (
    <div className="wl">
      <div className="card wl-mode">
        <div className="row between wrap gap">
          <strong>單字實驗室</strong>
          <div className="seg three-mini">
            {Object.entries(MODES).map(([m, c]) => (
              <button key={m} className={plan.mode === Number(m) ? 'on' : ''} onClick={() => setMode(Number(m))}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">{plan.cfg.desc}</p>
        <div className="row gap wl-new">
          <span className="small">每天新的核心字</span>
          <button className="btn small" onClick={() => setNew(plan.newPerDay - 1)} disabled={plan.newPerDay <= 0}>−</button>
          <span className="num">{plan.newPerDay}</span>
          <button className="btn small" onClick={() => setNew(plan.newPerDay + 1)} disabled={plan.newPerDay >= 5}>＋</button>
        </div>
        <label className="inline small wl-auto">
          <input type="checkbox" checked={autoOn(ws)} onChange={(e) => api.set('settings/wordLab', { autoSpeak: e.target.checked })} /> 出題時自動念單字
        </label>
        {!canSpeak() && <p className="muted small">這個瀏覽器不能朗讀，喇叭按鈕不會出現。</p>}
      </div>

      {plan.backlog && (
        <div className="card wl-warn">
          <strong>複習卡積了 {plan.due.length} 張</strong>
          <p className="small">超過 {BACKLOG} 張時今天先不給新字，複習清完再學新的。</p>
        </div>
      )}
      {finished && <div className="card wl-done">今天的單字實驗室做完了，首頁的英文已經打勾。</div>}

      <section className="section">
        <h2>1. 複習</h2>
        {plan.due.length ? (
          <button className="btn primary big" onClick={() => setView({ name: 'review' })}>
            開始複習 {plan.due.length} 張（依你的弱點出題）
          </button>
        ) : (
          <p className="muted small">今天沒有到期的單字實驗室卡。</p>
        )}
      </section>

      <section className="section">
        <h2>2. 核心字</h2>
        {!plan.core.length && <p className="muted small">{plan.remaining ? '今天先不學新字。' : '內建的核心字都開始學了。'}</p>}
        <ul className="list">
          {plan.core.map((w) => (
            <WordRow key={w.id} w={w} st={states[w.id]} onOpen={() => setView({ name: 'word', id: w.id })} />
          ))}
        </ul>
      </section>

      {quickN > 0 && (
        <section className="section">
          <h2>3. 快速辨識 {quickN} 個字</h2>
          <div>
          <button className={`btn ${quickDone ? '' : 'primary'}`} onClick={() => setView({ name: 'quick' })}>
            {quickDone ? `做完了（答對 ${day.quickOk || 0}/${day.quickDone}）・再看一次` : `開始（${day.quickDone || 0}/${quickN}）`}
          </button>
          </div>
        </section>
      )}

      <section className="section">
        <h2>{quickN ? 4 : 3}. TOEIC 小測 {plan.cfg.toeic} 題</h2>
        <div>
        <button className={`btn ${toeicDone ? '' : 'primary'}`} onClick={() => setView({ name: 'toeic' })}>
          {toeicDone ? `做完了（第一次就答對 ${day.toeic.correct}/${day.toeic.total}）・看解析` : '開始'}
        </button>
        </div>
        <p className="muted small">Part 5 風格，自己編的題目，非官方，不換算分數。</p>
      </section>

      <section className="section">
        <h2>加練</h2>
        <div className="row gap wrap">
          <button className="btn" onClick={() => setView({ name: 'errors' })}>口說錯誤練習</button>
          <button className="btn primary" onClick={() => setView({ name: 'arena' })}>互動小遊戲</button>
          <button className="btn" onClick={() => setView({ name: 'stats' })}>學習分析</button>
        </div>
        <details className="wl-all">
          <summary className="small">全部核心字（{CORE_WORDS.length}）</summary>
          <ul className="list">
            {CORE_WORDS.map((w) => (
              <WordRow key={w.id} w={w} st={states[w.id]} onOpen={() => setView({ name: 'word', id: w.id })} />
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}

function WordRow({ w, st, onOpen }) {
  const step = stepOf(st);
  return (
    <li className="task wl-row" onClick={onOpen}>
      <div className="task-body">
        <div className="task-title">
          <span className="eng-front">{w.word}</span>
          {isStarted(st) && <span className="muted"> ・{w.zh}</span>}
        </div>
        <div className="task-meta">
          {isFinished(st) ? <span className="chip ok">已進入複習</span> : isStarted(st) ? <span className="chip">第 {step} 步／7・{STEPS[step - 1].label}</span> : <span className="chip">還沒開始</span>}
          <span>{w.pos}</span>
        </div>
      </div>
      <span className="btn small">{isFinished(st) ? '看' : isStarted(st) ? '繼續' : '開始'}</span>
    </li>
  );
}

// ---- 一題客觀題：答錯看原因，一定要重答 ----
// sayOnOpen：出題時自動念的字（快速辨識字）
function QuestionCard({ q, onAnswer, onNext, nextLabel = '下一題', example, tag, sayOnOpen }) {
  const { wordLabSettings: ws } = useData();
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState(null);
  const opts = useMemo(() => arrange(q, attempt), [q, attempt]);
  const correct = picked !== null && picked === q.answer;
  const whole = fullSentence(q);
  useEffect(() => {
    if (sayOnOpen && autoOn(ws)) speak(sayOnOpen, 0.9);
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (i) => {
    if (picked !== null) return;
    setPicked(i);
    onAnswer(i, attempt);
    // 答對：把完整的句子念一次
    if (i === q.answer && whole && autoOn(ws)) speak(whole, 0.9);
  };
  return (
    <div className={`card wl-q ${picked === null ? '' : correct ? 'ok' : 'wrong'}`}>
      <div className="row between wrap gap">
        <span className="chip">{KIND_LABEL[q.kind]}</span>
        {tag && <span className="muted small">{tag}</span>}
        {attempt > 0 && <span className="chip">重答第 {attempt} 次</span>}
      </div>
      <p className="wl-prompt">
        {q.q}
        {sayOnOpen && <Say text={sayOnOpen} />}
      </p>
      <div className="listen-options">
        {opts.map((o, j) => (
          <button
            key={o.i}
            className={`btn opt ${picked === null ? '' : o.i === q.answer && correct ? 'right' : o.i === picked ? 'mine' : ''}`}
            disabled={picked !== null && o.i !== picked && !(correct && o.i === q.answer)}
            onClick={() => choose(o.i)}
          >
            <b>{LETTERS[j]}</b> {o.text}
          </button>
        ))}
      </div>
      {picked !== null && correct && (
        <div className="wl-explain">
          <p className="strong">答對了{attempt ? '（重答）' : ''}</p>
          {whole && <p className="small wl-whole">{whole} <Say text={whole} /> <Say text={whole} slow /></p>}
          <p className="small">{q.explain}</p>
          <button className="btn primary" onClick={onNext}>{nextLabel}</button>
        </div>
      )}
      {picked !== null && !correct && (
        <div className="wl-explain">
          <p className="strong">答錯了</p>
          {q.why?.[picked] && <p className="small"><b>為什麼不是「{q.options[picked]}」：</b>{q.why[picked]}</p>}
          <p className="small"><b>解釋：</b>{q.explain}</p>
          {example && (
            <p className="small wl-ex">
              <b>例句：</b>{example.en} <Say text={example.en} /><br /><span className="muted">{example.zh}</span>
            </p>
          )}
          <p className="muted small">先把答案記在心裡，選項會換位置，再答一次。</p>
          <button className="btn primary" onClick={() => { setPicked(null); setAttempt(attempt + 1); }}>重新作答</button>
        </div>
      )}
    </div>
  );
}

function Examples({ word, st }) {
  const list = visibleExamples(word, st);
  const total = word.examples.length;
  return (
    <details className="card wl-examples" open>
      <summary className="strong">例句 {list.length}/{total}</summary>
      <ul>
        {list.map((e) => (
          <li key={e.id}>
            <span className="chip">{e.use}</span> {e.en} <Say text={e.en} />
            <br />
            <span className="muted small">{e.zh}</span>
          </li>
        ))}
      </ul>
      {list.length < total && <p className="muted small">其他例句會隨著進度、或你在某一類答錯時解鎖。</p>}
    </details>
  );
}

function Stepper({ step }) {
  return (
    <ol className="wl-steps">
      {STEPS.map((s) => (
        <li key={s.n} className={step > s.n ? 'done' : step === s.n ? 'now' : ''} title={s.label}>
          <span className="num">{s.n}</span>
        </li>
      ))}
    </ol>
  );
}

// ---- 一個核心字的 7 步 ----
function WordFlow({ word, lab, onBack }) {
  const { api, englishItems } = useData();
  const { states, sentences, t } = lab;
  const st = states[word.id];
  const step = stepOf(st);
  const [cur, setCur] = useState(null);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    const d = startData(word, st, t);
    if (d) api.set(`wordLab/${word.id}`, d);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const q = cur ? word.questions.find((x) => x.id === cur) : nextQuestion(word, st, step);
  const exampleFor = (qq) => {
    const ex = visibleExamples(word, { ...st, errors: { ...(st?.errors || {}), [qq.skill]: 1 } });
    return ex.find((e) => e.focus === qq.skill) || ex[0];
  };
  const answer = (qq) => (chosen) => {
    // 答完先停在這一題看解釋，按「下一題」才換
    setCur(qq.id);
    const r = answerUpdate(word, st, qq, chosen, t);
    api.set(`wordLab/${word.id}`, r.data);
    api.add('wordLabLog', r.log);
  };
  const next = () => {
    setCur(null);
  };
  const advance = () => {
    const d = advanceData(word, st, t);
    if (d) api.set(`wordLab/${word.id}`, d);
    setCur(null);
  };
  const mySent = (task) => sentences.find((s) => s.id === sentenceId(word.id, task.id));
  const item = englishItems.find((it) => it.id === st?.itemId) || englishItems.find((it) => it.labWord === word.id);

  if (!st) return <p className="muted">準備中…</p>;
  const done = step >= DONE_STEP;

  return (
    <div className="wl">
      <div className="row between">
        <button className="link" onClick={onBack}>← 回單字實驗室</button>
        <button className="link small" onClick={() => setShowLog(!showLog)}>{showLog ? '收起紀錄' : '作答紀錄'}</button>
      </div>
      <div className="card wl-head">
        <div className="row between wrap gap">
          <h3 className="wl-word">
            {word.word} <Say text={word.word} /> <Say text={word.word} slow />
          </h3>
          <span className="chip">{word.pos}</span>
        </div>
        {step > 1 ? <p className="strong">{word.zh}</p> : <p className="muted small">中文先藏起來，先從句子猜。</p>}
        <Stepper step={step} />
        {!done && <p className="small"><b>第 {step} 步・{STEPS[step - 1].label}</b>：{STEPS[step - 1].hint}</p>}
      </div>
      {showLog && <AttemptLog wordId={word.id} />}

      {step >= 3 && (
        <div className="card wl-family">
          <p className="small">
            <b>單字家族：</b>
            {word.family.map(([w, p, z]) => (
              <span key={w} className="wl-fam">
                {w} <Say text={w} />（{p}）{z}
              </span>
            ))}
          </p>
          <p className="small"><b>常見搭配：</b>{word.collocations.join('・')}</p>
          <p className="small"><b>相似字：</b>{word.similar.map(([w, z]) => `${w}＝${z}`).join('；')}</p>
        </div>
      )}
      {step >= 2 && <Examples word={word} st={st} />}

      {step <= 4 && q && (
        <QuestionCard key={q.id} q={q} onAnswer={answer(q)} onNext={next} example={exampleFor(q)} />
      )}
      {step <= 4 && !q && (
        <div className="card wl-next">
          <p className="strong">這一步完成了。</p>
          {STEP_GAME[step] && <GameCard key={`${word.id}-${step}`} word={word} st={st} game={STEP_GAME[step]} seed={step} t={t} title="互動小關" />}
          <button className="btn primary big" onClick={advance}>下一步：{STEPS[step].label}</button>
        </div>
      )}

      {step === 5 && (
        <>
          {word.tasks.map((task) => (
            <SentenceTask key={task.id} word={word} task={task} sent={mySent(task)} t={t}
              onSubmitted={() => api.set(`wordLab/${word.id}`, { sentences: { [task.id]: sentenceId(word.id, task.id) } })} />
          ))}
          <button className="btn primary big" disabled={!stepComplete(word, st, 5)} onClick={advance}>
            {stepComplete(word, st, 5) ? '下一步：批改和修改' : '兩題都交出才能往下'}
          </button>
        </>
      )}

      {step >= 6 && (
        <section className="section">
          <h2>我的造句</h2>
          {word.tasks.map((task) => (
            <SentenceTask key={task.id} word={word} task={task} sent={mySent(task)} t={t} withFeedback />
          ))}
        </section>
      )}
      {step === 6 && (
        <div className="card wl-next">
          <p className="small">還沒批改的句子也可以先進入複習，之後回到這個字再貼回饋。網站不會自己替你打分。</p>
          <button className="btn primary big" onClick={advance}>下一步：進入複習</button>
        </div>
      )}
      {step === 7 && (
        <div className="card wl-next">
          <p className="small">
            {englishItems.some((it) => itemKey(it.type, it.front) === itemKey('word', word.word))
              ? '你的卡片庫已經有這個字：會接上同一張卡，原本的複習進度不變。'
              : `會在卡片庫新增一張「${word.word}」，明天開始照間隔複習（和「今天」分頁的複習是同一張卡）。`}
          </p>
          <button className="btn primary big" onClick={() => api.batch(enterSrsOps(word, englishItems, t))}>加入複習</button>
        </div>
      )}
      {done && <WordSummary word={word} st={st} item={item} sentences={sentences} />}
    </div>
  );
}

function WordSummary({ word, st, item, sentences }) {
  const s = wordStats(word, st, item, sentences);
  return (
    <div className="card">
      <p className="strong">已進入複習{st.finishedOn ? `（${st.finishedOn}）` : ''}</p>
      <SkillGrid s={s} />
    </div>
  );
}

function SkillGrid({ s }) {
  const sent = s.sentence;
  return (
    <div className="wl-skills">
      <div><span className="muted small">{SKILLS.meaning}</span><b>{pctText(s.meaning)}</b></div>
      <div><span className="muted small">{SKILLS.collocation}</span><b>{pctText(s.collocation)}</b></div>
      <div><span className="muted small">{SKILLS.pos}</span><b>{pctText(s.pos)}</b></div>
      <div>
        <span className="muted small">{SKILLS.sentence}</span>
        <b>{sent.submitted ? `${sent.submitted} 句` : '—'}</b>
        {sent.submitted > 0 && <span className="small">AI 說可以 {sent.ok}・要改 {sent.needsFix}・未批改 {sent.pending}・修改 {sent.revisions} 次</span>}
      </div>
      <div>
        <span className="muted small">{SKILLS.srs}</span>
        <b>{s.srs ? `盒子 ${s.srs.box}・${BOX_LABEL(s.srs.box)}` : '還沒進入'}</b>
        {s.srs && <span className="small">複習 {s.srs.reps} 次・忘記 {s.srs.lapses} 次・下次 {s.srs.due}</span>}
      </div>
      <div><span className="muted small">{SKILLS.toeic}</span><b>{pctText(s.toeic)}</b></div>
      <p className="muted small wl-skills-note">百分比只算每題第一次作答；看過答案後的重答會記錄，但不算進去。</p>
    </div>
  );
}

function AttemptLog({ wordId }) {
  const { uid } = useData();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    getDocs(query(collection(db, 'users', uid, 'wordLabLog'), where('wordId', '==', wordId)))
      .then((snap) => setRows(snap.docs.map((d) => d.data()).sort((a, b) => (b.atMs || 0) - (a.atMs || 0)).slice(0, 40)))
      .catch((e) => {
        logError('讀取作答紀錄', e, { show: false });
        setRows([]);
      });
  }, [uid, wordId]);
  if (!rows) return <p className="muted small">讀取中…</p>;
  if (!rows.length) return <p className="muted small">還沒有作答紀錄。</p>;
  return (
    <ul className="card wl-log small">
      {rows.map((r, i) => (
        <li key={i} className={r.correct ? 'ok' : 'wrong'}>
          {r.date}・{KIND_LABEL[r.kind] || r.kind}{r.attempt > 1 ? `（第 ${r.attempt} 次）` : ''}・{r.correct ? '對' : `錯：選「${r.chosen}」，答案「${r.answer}」・${ERROR_TYPES[r.errorType] || ''}`}{r.review ? '・複習' : ''}
        </li>
      ))}
    </ul>
  );
}

// ---- 造句：交出、看參考、複製給外部 AI、貼回、修改再交 ----
// fresh：複習時重新造一句（舊的版本保留，新句子加在後面）
function SentenceTask({ word, task, sent, t, onSubmitted, withFeedback, label, source, fresh }) {
  const { api } = useData();
  const sid = sentenceId(word.id, task.id);
  const [text, setText] = useState('');
  const [revising, setRevising] = useState(!!fresh);
  const versions = sent?.versions || [];
  const last = versions[versions.length - 1];
  const submit = () => {
    if (!text.trim()) return;
    api.set(`wordLabSentences/${sid}`, submitSentence(sent, { wordId: word.id, word: word.word, task, text, t, source }), true);
    setText('');
    setRevising(false);
    onSubmitted?.();
  };
  const ask = task.kind === 'translate' ? `中翻英：${task.zh}` : task.kind === 'rewrite' ? '把這句改成正確、自然的英文' : task.prompt;
  return (
    <div className="card wl-sent">
      <div className="row between wrap gap">
        <span className="chip">{label || KIND_LABEL[task.kind]}</span>
        {sent && <span className={`chip ${sent.status === 'ok' ? 'ok' : ''}`}>{SENTENCE_STATUS[sent.status]}</span>}
      </div>
      <p className="strong">{ask}</p>
      {task.hint && <p className="muted small">提示：{task.hint}</p>}
      {versions.length > 0 && (
        <ol className="wl-versions">
          {versions.map((v, i) => (
            <li key={i}>
              {v.text} <span className="muted small">（第 {i + 1} 版・{v.date}）</span>
            </li>
          ))}
        </ol>
      )}
      {(!sent || revising) && (
        <>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={revising ? '改好的句子' : '用英文寫'} />
          <div className="row gap">
            <button className="btn primary small" disabled={!text.trim()} onClick={submit}>{revising ? '交出新版本' : '交出'}</button>
            {revising && <button className="link small" onClick={() => setRevising(false)}>取消</button>}
          </div>
        </>
      )}
      {sent && task.model && <p className="small wl-model"><b>參考說法（其中一種）：</b>{task.model}</p>}
      {sent && withFeedback && (
        <>
          <FeedbackList sent={sent} />
          <FeedbackBox word={word} task={task} sent={sent} sid={sid} />
          {!revising && (
            <button className="btn small" onClick={() => { setText(last?.text || ''); setRevising(true); }}>修改再交</button>
          )}
        </>
      )}
    </div>
  );
}

function FeedbackList({ sent }) {
  const fbs = sent.feedback || [];
  if (!fbs.length) return <p className="muted small">還沒批改：網站不會自己評分，請複製給外部 AI。</p>;
  return (
    <div className="wl-fbs">
      {fbs.map((f, i) => (
        <div key={i} className={`wl-fb ${f.verdict === 'ok' ? 'ok' : f.verdict === 'fix' ? 'fix' : ''}`}>
          <p className="small strong">外部 AI 回饋（第 {f.forVersion} 版）{f.verdict === 'ok' ? '・可以' : f.verdict === 'fix' ? '・要修改' : '・沒讀到格式，存原文'}</p>
          {f.corrected && <p className="small">建議：{f.corrected}</p>}
          {(f.issues || []).map((x, j) => (
            <p key={j} className="small">・<b>{ISSUE_LABEL[x.type]}</b>：{x.zh}</p>
          ))}
          {f.tipZh && <p className="small muted">{f.tipZh}</p>}
          {f.raw && <p className="small wl-raw">{f.raw}</p>}
        </div>
      ))}
    </div>
  );
}

function FeedbackBox({ word, task, sent, sid }) {
  const { api } = useData();
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const versions = sent.versions || [];
  const last = versions[versions.length - 1];
  const already = (sent.feedback || []).some((f) => f.forVersion === versions.length);
  const prompt = sentencePrompt({ word: word.word, zh: word.zh, task, text: last?.text || '', versions });
  const save = () => {
    const fb = parseFeedback(text);
    if (!fb) return;
    api.set(`wordLabSentences/${sid}`, addFeedback(sent, fb));
    setText('');
  };
  return (
    <details className="wl-paste" open={!already}>
      <summary className="small strong">{already ? '這一版已經批改過・再貼一次' : `把第 ${versions.length} 版給外部 AI 批改`}</summary>
      <ol className="small paste-steps">
        <li>按「複製」，貼到 Claude 或 ChatGPT</li>
        <li>把整段回覆貼回下面，按「存起來」</li>
      </ol>
      <div className="row gap wrap">
        <button className="btn small primary" onClick={async () => setCopied(await copyText(prompt))}>{copied ? '已複製' : '複製批改指令'}</button>
        <a className="btn small" href="https://claude.ai/new" target="_blank" rel="noreferrer">打開 Claude</a>
      </div>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="把外部 AI 的回覆貼在這裡" />
      <button className="btn small" disabled={!text.trim()} onClick={save}>存起來</button>
    </details>
  );
}

// ---- Smart Review：到期的卡依弱點出題，結果寫回同一張 englishItems 卡 ----
function ReviewSession({ lab, due, onBack }) {
  const { api, englishItems } = useData();
  const { states, sentences, t } = lab;
  // 開始時固定這一輪的卡（答完 due 會變，清單不跟著跳）
  const [queue] = useState(() => due.map((it) => it.id));
  const [i, setI] = useState(0);
  const [graded, setGraded] = useState(false);
  const item = englishItems.find((it) => it.id === queue[i]);
  const word = item && wordById[item.labWord];
  const st = word && states[word.id];
  const task = useMemo(() => (word ? reviewTask(word, st, item, sentencesFor(sentences, word.id)) : null), [queue[i]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (i >= queue.length || !item || !word) {
    return (
      <div className="wl">
        <button className="link" onClick={onBack}>← 回單字實驗室</button>
        <div className="card wl-done">這一輪複習完了（{queue.length} 張）。</div>
      </div>
    );
  }
  const next = () => {
    setGraded(false);
    setI(i + 1);
  };
  const grade = (ok) => {
    if (graded) return;
    setGraded(true);
    api.update(`englishItems/${item.id}`, review(item, ok, t));
  };
  const onAnswer = (chosen, attempt) => {
    const r = answerUpdate(word, st, task.q, chosen, t, { fresh: attempt === 0 });
    api.set(`wordLab/${word.id}`, r.data);
    api.add('wordLabLog', { ...r.log, review: true });
    // 間隔複習只看第一次作答
    if (attempt === 0) grade(r.correct);
  };
  const sid = sentenceId(word.id, task.task?.id || '');
  const sent = task.kind === 'rewrite' ? sentences.find((s) => s.id === sid) : null;

  return (
    <div className="wl">
      <div className="row between">
        <button className="link" onClick={onBack}>← 回單字實驗室</button>
        <span className="muted small">{i + 1}/{queue.length}</span>
      </div>
      <div className="card wl-head">
        <div className="row between wrap gap">
          <h3 className="wl-word">
            {word.word} <Say text={word.word} />
          </h3>
          <span className="chip">盒子 {item.box || 0}</span>
        </div>
        <p className="muted small">這次出題：{task.reason}</p>
      </div>
      {task.kind === 'q' && (
        <QuestionCard key={`${item.id}-${task.q.id}`} q={task.q} onAnswer={onAnswer} onNext={next} nextLabel="下一張" example={visibleExamples(word, st)[0]} />
      )}
      {task.kind === 'rewrite' && (
        <RewriteReview word={word} task={task.task} sent={sent} t={t} graded={graded} onGrade={grade} onNext={next} />
      )}
    </div>
  );
}

const sentencesFor = (sentences, wordId) => {
  const mine = sentences.filter((s) => s.wordId === wordId);
  return { needsFix: mine.filter((s) => s.status === 'needsFix').length };
};

// 造句弱：重新造一句，對照參考和上次的外部 AI 回饋，自己評（標明是自評）
function RewriteReview({ word, task, sent, t, graded, onGrade, onNext }) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <>
      <SentenceTask word={word} task={task} sent={sent} t={t} fresh onSubmitted={() => setSubmitted(true)} withFeedback={submitted} label="重新造句" />
      {submitted && (
        <div className="card wl-next">
          <p className="small">對照參考說法和之前的回饋，自己評一下（自評，不是 AI 評分）：</p>
          {!graded ? (
            <div className="row gap">
              <button className="btn grow" onClick={() => onGrade(false)}>還不熟</button>
              <button className="btn primary grow" onClick={() => onGrade(true)}>寫得出來</button>
            </div>
          ) : (
            <button className="btn primary" onClick={onNext}>下一張</button>
          )}
        </div>
      )}
    </>
  );
}

// ---- 快速辨識字 ----
function QuickSession({ lab, n, onBack }) {
  const { api, englishItems } = useData();
  const { states, day, t } = lab;
  const quick = states.quick;
  const [picks] = useState(() => quickPicks(quick, t, n));
  const [i, setI] = useState(() => Math.min(day.quickDone || 0, picks.length));
  const [wrong, setWrong] = useState([]);
  const have = new Set(englishItems.map((it) => itemKey(it.type, it.front)));
  const qw = picks[i];
  const q = useMemo(() => (qw ? quickQuestion(qw, t) : null), [qw, t]);
  const onAnswer = (chosen, attempt) => {
    if (attempt > 0) return;
    const ok = chosen === q.answer;
    api.set('wordLab/quick', quickUpdate(quick, qw, ok, t));
    api.set(`wordLabDays/${t}`, { quickDone: (day.quickDone || 0) + 1, quickOk: (day.quickOk || 0) + (ok ? 1 : 0) });
    api.add('wordLabLog', { wordId: `quick:${qw.word}`, word: qw.word, qid: q.id, kind: 'meaning', skill: 'meaning', chosen: q.options[chosen], answer: q.options[q.answer], correct: ok, attempt: 1, errorType: ok ? '' : 'meaning', date: t, atMs: Date.now() });
    if (!ok) setWrong((w) => [...w, qw]);
  };
  const addCard = (w) =>
    api.add('englishItems', { ...newItem({ type: 'word', front: w.word, back: w.zh, example: w.ex, pos: w.pos, tags: [LAB_TAG, '快速辨識'], source: 'wordLab' }, t), introducedOn: t });
  return (
    <div className="wl">
      <div className="row between">
        <button className="link" onClick={onBack}>← 回單字實驗室</button>
        <span className="muted small">{Math.min(i + 1, picks.length)}/{picks.length}</span>
      </div>
      {q ? (
        <QuestionCard key={q.id} q={q} onAnswer={onAnswer} onNext={() => setI(i + 1)} tag="快速辨識" sayOnOpen={qw.word} />
      ) : (
        <div className="card wl-done">
          <p className="strong">今天的快速辨識字做完了。</p>
          {picks.map((w) => (
            <p key={w.word} className="small">
              <b>{w.word}</b> <Say text={w.word} />（{w.pos}）{w.zh}
              {wrong.includes(w) && (have.has(itemKey('word', w.word))
                ? <span className="muted">・已在卡片庫</span>
                : <button className="link small" onClick={() => addCard(w)}>・答錯了，加到字卡</button>)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- TOEIC 小測（Part 5 風格，非官方）----
function ToeicMini({ lab, n, onBack }) {
  const { api } = useData();
  const { states, day, t } = lab;
  const [picks] = useState(() => toeicPicks(states, t, n));
  const prev = day.toeic?.answers || {};
  const [i, setI] = useState(() => (day.toeic?.done ? picks.length : picks.findIndex((x) => !(`${x.w.id}-${x.q.id}` in prev)) === -1 ? picks.length : picks.findIndex((x) => !(`${x.w.id}-${x.q.id}` in prev))));
  const cur = picks[i];
  const onAnswer = (chosen, attempt) => {
    const r = answerUpdate(cur.w, states[cur.w.id], cur.q, chosen, t, { fresh: attempt === 0 });
    api.set(`wordLab/${cur.w.id}`, r.data);
    api.add('wordLabLog', { ...r.log, toeicMini: true });
    if (attempt > 0) return;
    const key = `${cur.w.id}-${cur.q.id}`;
    const answers = { ...prev, [key]: r.correct };
    const done = picks.every((x) => `${x.w.id}-${x.q.id}` in answers);
    api.set(`wordLabDays/${t}`, { toeic: { answers, total: picks.length, correct: Object.values(answers).filter(Boolean).length, done } });
  };
  return (
    <div className="wl">
      <div className="row between">
        <button className="link" onClick={onBack}>← 回單字實驗室</button>
        <span className="muted small">{Math.min(i + 1, picks.length)}/{picks.length}</span>
      </div>
      {cur ? (
        <QuestionCard key={`${cur.w.id}-${cur.q.id}`} q={cur.q} onAnswer={onAnswer} onNext={() => setI(i + 1)} tag={cur.w.word} />
      ) : (
        <div className="card wl-done">
          <p className="strong">今天的 TOEIC 小測：第一次就答對 {day.toeic?.correct ?? 0}/{day.toeic?.total ?? picks.length}</p>
          <p className="muted small">非官方練習，只看正確率，不換算多益分數。</p>
          {picks.map((x) => {
            const ok = prev[`${x.w.id}-${x.q.id}`];
            return (
              <details key={x.q.id + x.w.id} className="wl-review">
                <summary className="small">{ok ? '○' : '×'} {x.q.q.replace(/\n/g, ' ')}</summary>
                <p className="small">答案：{x.q.options[x.q.answer]}。{x.q.explain}</p>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- 口說錯誤 → 改錯、搭配詞、造句 ----
function ErrorList({ lab, onBack }) {
  const { englishItems } = useData();
  const errors = useMemo(() => speakingErrors(englishItems, DATASETS), [englishItems]);
  const [open, setOpen] = useState(null);
  const done = new Set(lab.sentences.filter((s) => s.source === 'speakingError').map((s) => s.wordId));
  if (open) return <ErrorPractice e={open} lab={lab} onBack={() => setOpen(null)} />;
  return (
    <div className="wl">
      <button className="link" onClick={onBack}>← 回單字實驗室</button>
      <div className="card">
        <strong>口說錯誤練習</strong>
        <p className="muted small">
          題目來自你的口說錯誤庫。原句是 ChatGPT 從逐字稿摘出、標明是你說過的句子；建議改法是 ChatGPT 的建議，不是你說過的話。
        </p>
      </div>
      {!errors.length && <p className="muted">還沒有口說錯誤資料。</p>}
      <ul className="list">
        {errors.map((e) => (
          <li key={e.id} className="task wl-row" onClick={() => setOpen(e)}>
            <div className="task-body">
              <div className="task-title">{e.original}</div>
              <div className="task-meta">
                <span>{e.sourceDate}</span>
                {e.topic && <span>{e.topic}</span>}
                {done.has(errorWordId(e)) && <span className="chip ok">練過</span>}
                {e.unverified && <span className="chip">原句未核對</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorPractice({ e, lab, onBack }) {
  const { api, englishItems } = useData();
  const { sentences, t } = lab;
  const wid = errorWordId(e);
  const word = { id: wid, word: e.correction, zh: e.explanationZh };
  const rewrite = errorRewriteTask(e);
  const own = errorOwnTask(e);
  const cz = errorCloze(e);
  const sent = (task) => sentences.find((s) => s.id === sentenceId(wid, task.id));
  const rw = sent(rewrite);
  const card = e.itemId && englishItems.find((it) => it.id === e.itemId);
  const [graded, setGraded] = useState(false);
  const [clozeDone, setClozeDone] = useState(false);
  const grade = (ok) => {
    setGraded(true);
    if (card) api.update(`englishItems/${card.id}`, review(card, ok, t));
  };
  const onCloze = (chosen, attempt) => {
    api.add('wordLabLog', { wordId: wid, word: e.original, qid: cz.id, kind: cz.kind, skill: 'collocation', chosen: cz.options[chosen], answer: cz.options[cz.answer], correct: chosen === cz.answer, attempt: attempt + 1, errorType: chosen === cz.answer ? '' : 'collocation', date: t, atMs: Date.now(), source: e.id });
  };
  return (
    <div className="wl">
      <button className="link" onClick={onBack}>← 口說錯誤清單</button>
      <div className="card wl-head">
        <p className="small muted">你 {e.sourceDate} 說過的句子{e.topic ? `（${e.topic}）` : ''}{e.unverified ? '・原句未核對' : ''}</p>
        <p className="wl-prompt">{e.original}</p>
      </div>
      <SentenceTask word={word} task={rewrite} sent={rw} t={t} withFeedback={!!rw} label="改錯：自己先改" source="speakingError" />
      {rw && (
        <div className="card wl-model">
          <p className="small"><b>建議改法（ChatGPT 的建議，不是你說過的原話）：</b>{e.correction}</p>
          {e.explanationZh && <p className="small">{e.explanationZh}</p>}
          {e.inferred && <p className="muted small">這句建議是依語境推斷的。</p>}
          {!graded ? (
            <div className="row gap">
              <button className="btn grow" onClick={() => grade(false)}>我還會說錯</button>
              <button className="btn primary grow" onClick={() => grade(true)}>我改對了</button>
            </div>
          ) : (
            <p className="muted small">記下來了{card ? '（錯誤卡的複習也更新了）' : ''}。這是自評，不是 AI 評分。</p>
          )}
        </div>
      )}
      {rw && cz && !clozeDone && <QuestionCard key={cz.id} q={cz} onAnswer={onCloze} onNext={() => setClozeDone(true)} nextLabel="好" tag="依建議改法出題" />}
      {/* 造句題會看到建議說法：自己先改完才出現 */}
      {rw && <SentenceTask word={word} task={own} sent={sent(own)} t={t} withFeedback={!!sent(own)} label="造句" source="speakingError" />}
    </div>
  );
}

// ---- 學習分析：每個字 6 項分開 ----
function Stats({ lab, onBack, onOpen }) {
  const { englishItems } = useData();
  const { states, sentences } = lab;
  const started = CORE_WORDS.filter((w) => isStarted(states[w.id]) || states[w.id]?.skills);
  return (
    <div className="wl">
      <button className="link" onClick={onBack}>← 回單字實驗室</button>
      <div className="card">
        <strong>學習分析</strong>
        <p className="muted small">每個字的能力分開看，沒有「已學會」一個勾就帶過。</p>
      </div>
      {!started.length && <p className="muted">還沒開始任何核心字。</p>}
      {started.map((w) => {
        const st = states[w.id];
        const item = englishItems.find((it) => it.id === st?.itemId) || englishItems.find((it) => it.labWord === w.id);
        const s = wordStats(w, st, item, sentences);
        return (
          <div key={w.id} className="card wl-stat" onClick={() => onOpen(w.id)}>
            <div className="row between">
              <strong className="wl-word small-word">{w.word}</strong>
              <span className="muted small">{isFinished(st) ? '已進入複習' : isStarted(st) ? `第 ${s.step} 步` : '只做過 TOEIC 題'}{s.lastErrorType ? `・最近錯：${ERROR_TYPES[s.lastErrorType]}` : ''}</span>
            </div>
            <SkillGrid s={s} />
          </div>
        );
      })}
    </div>
  );
}

// ---- 互動小遊戲 ----

// 練習場用的字：已經開始的字，沒有的話用今天的核心字
function arenaWords(plan, states) {
  const started = CORE_WORDS.filter((w) => isStarted(states[w.id]));
  return started.length ? started : plan.core.length ? plan.core : CORE_WORDS.slice(0, 1);
}

const GAME_ORDER = ['listen', 'match', 'dictation', 'builder'];

function GameArena({ lab, words, onBack }) {
  const { t } = lab;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState({ ok: 0, n: 0 });
  const ROUNDS = 6;
  const word = words[seedOf(`${t}|${round}|w`) % words.length];
  const game = GAME_ORDER[(seedOf(t) + round) % GAME_ORDER.length];
  return (
    <div className="wl">
      <div className="row between">
        <button className="link" onClick={onBack}>← 回單字實驗室</button>
        <span className="muted small">{Math.min(round + 1, ROUNDS)}/{ROUNDS}・答對 {score.ok}</span>
      </div>
      {round < ROUNDS ? (
        <GameCard
          key={round}
          word={word}
          st={lab.states[word.id]}
          game={game}
          seed={round + 10}
          t={t}
          title={`${word.word}・${GAMES[game].label}`}
          onDone={(ok) => setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }))}
          onNext={() => setRound(round + 1)}
        />
      ) : (
        <div className="card wl-done">
          <p className="strong">玩完 {ROUNDS} 關，第一次就答對 {score.ok} 關。</p>
          <button className="btn primary" onClick={() => { setRound(0); setScore({ ok: 0, n: 0 }); }}>再玩一輪</button>
        </div>
      )}
    </div>
  );
}

// 一關小遊戲：只記第一次的結果，答錯可以再試
function GameCard({ word, st, game, seed, t, title, onDone, onNext }) {
  const { api } = useData();
  const [result, setResult] = useState(null);
  const record = (ok, detail) => {
    if (result !== null) return;
    setResult(ok);
    api.set(`wordLab/${word.id}`, gameUpdate(st, game, ok));
    api.add('wordLabLog', { wordId: word.id, word: word.word, qid: `game-${game}`, kind: game, skill: GAMES[game].skill, correct: ok, attempt: 1, errorType: ok ? '' : GAMES[game].skill, date: t, atMs: Date.now(), ...detail });
    onDone?.(ok);
  };
  const props = { word, st, seed, record, result };
  return (
    <div className={`card wl-game ${result === null ? '' : result ? 'ok' : 'wrong'}`}>
      <div className="row between wrap gap">
        <span className="chip">{title || GAMES[game].label}</span>
        {result !== null && <span className="small strong">{result ? '第一次就對了' : '已記下這次錯誤'}</span>}
      </div>
      <p className="muted small">{GAMES[game].hint}</p>
      {game === 'listen' && <ListenPick {...props} />}
      {game === 'match' && <MatchPairs {...props} />}
      {game === 'dictation' && <Dictation {...props} />}
      {game === 'builder' && <Builder {...props} />}
      {onNext && result !== null && <button className="btn primary" onClick={onNext}>下一關</button>}
    </div>
  );
}

function ListenPick({ word, seed, record }) {
  const g = useMemo(() => listenGame(word, seed), [word, seed]);
  const [picked, setPicked] = useState([]);
  const solved = picked.includes(g.target);
  useEffect(() => {
    speak(g.target, 0.85);
  }, [g.target]);
  if (!canSpeak()) return <p className="muted small">這個瀏覽器不能朗讀，這關先跳過。</p>;
  const pick = (w) => {
    if (solved || picked.includes(w)) return;
    if (!picked.length) record(w === g.target, { chosen: w, answer: g.target });
    setPicked([...picked, w]);
    if (w !== g.target) speak(g.target, 0.7);
  };
  return (
    <>
      <div className="row gap">
        <button className="btn" onClick={() => speak(g.target, 0.85)}>再聽一次</button>
        <button className="btn" onClick={() => speak(g.target, 0.6)}>慢速</button>
      </div>
      <div className="wl-tiles">
        {g.options.map((w) => (
          <button key={w} className={`tile ${picked.includes(w) ? (w === g.target ? 'right' : 'mine') : ''}`} onClick={() => pick(w)}>
            {w}
          </button>
        ))}
      </div>
      {picked.length > 0 && !solved && <p className="small">不是這個，聽慢速再選一次。</p>}
      {solved && <p className="small">你聽到的是 <b>{g.target}</b>（{word.family.find(([w]) => w === g.target)?.[1] || ''}）。</p>}
    </>
  );
}

function MatchPairs({ word, seed, record }) {
  const g = useMemo(() => matchGame(word, seed), [word, seed]);
  const [left, setLeft] = useState(null);
  const [done, setDone] = useState([]);
  const [miss, setMiss] = useState(0);
  const [flash, setFlash] = useState('');
  const tryPair = (en) => {
    if (left === null || done.includes(en)) return;
    const want = g.pairs[left].en;
    if (en === want) {
      speak(en, 0.9);
      const next = [...done, en];
      setDone(next);
      setLeft(null);
      if (next.length === g.pairs.length) record(miss === 0, { misses: miss });
    } else {
      setMiss(miss + 1);
      setFlash(en);
      setTimeout(() => setFlash(''), 500);
    }
  };
  return (
    <div className="wl-match">
      <div className="wl-col">
        {g.pairs.map((p, i) => (
          <button key={p.zh} className={`tile ${done.includes(p.en) ? 'right' : left === i ? 'on' : ''}`} disabled={done.includes(p.en)} onClick={() => setLeft(i)}>
            {p.zh}
          </button>
        ))}
      </div>
      <div className="wl-col">
        {g.right.map((en) => (
          <button key={en} className={`tile en ${done.includes(en) ? 'right' : flash === en ? 'mine' : ''}`} disabled={done.includes(en)} onClick={() => tryPair(en)}>
            {en}
          </button>
        ))}
      </div>
      {miss > 0 && <p className="small muted wl-span">配錯 {miss} 次</p>}
    </div>
  );
}

function Dictation({ word, st, seed, record, result }) {
  const g = useMemo(() => dictationGame(word, visibleExamples(word, st), seed), [word, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [text, setText] = useState('');
  const [tries, setTries] = useState(0);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (g) speak(g.sentence, 0.85);
  }, [g]);
  if (!g) return <p className="muted small">這個字還沒有適合聽寫的句子。</p>;
  const check = (e) => {
    e.preventDefault();
    if (!text.trim() || ok) return;
    const good = dictationOk(text, g.answer);
    if (!tries) record(good, { chosen: text.trim(), answer: g.answer });
    setTries(tries + 1);
    if (good) setOk(true);
  };
  return (
    <>
      <p className="wl-prompt">{g.shown}</p>
      <div className="row gap">
        <button className="btn" onClick={() => speak(g.sentence, 0.85)}>再聽一次</button>
        <button className="btn" onClick={() => speak(g.sentence, 0.6)}>慢速</button>
      </div>
      <form className="row gap" onSubmit={check}>
        <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="空格裡的字" autoCapitalize="off" autoCorrect="off" spellCheck="false" disabled={ok} />
        <button className="btn primary" disabled={ok}>對答案</button>
      </form>
      {tries > 0 && !ok && <p className="small">還不對，再聽一次。{tries >= 2 && <>提示：開頭是 <b>{g.answer.slice(0, 3)}</b>，共 {g.answer.length} 個字母。</>}</p>}
      {(ok || (result === false && tries >= 3)) && (
        <p className="small wl-ex">
          {g.sentence}<br /><span className="muted">{g.zh}</span>
        </p>
      )}
    </>
  );
}

function Builder({ word, st, seed, record }) {
  const g = useMemo(() => builderGame(word, visibleExamples(word, st), seed), [word, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState([]);
  const [checked, setChecked] = useState(null);
  const [first, setFirst] = useState(true);
  if (!g) return <p className="muted small">這個字還沒有適合重組的句子。</p>;
  const left = g.tiles.filter((x) => !picked.includes(x));
  const check = () => {
    const good = builderOk(picked, g.sentence);
    setChecked(good);
    if (first) {
      record(good, { chosen: picked.map((x) => x.text).join(' '), answer: g.sentence });
      setFirst(false);
    }
    if (good) speak(g.sentence, 0.9);
  };
  return (
    <>
      <p className="muted small">{g.zh}</p>
      <div className="wl-built">
        {picked.length ? picked.map((x) => (
          <button key={x.id} className="tile en on" disabled={checked} onClick={() => { setPicked(picked.filter((y) => y !== x)); setChecked(null); }}>
            {x.text}
          </button>
        )) : <span className="muted small">點下面的字卡排句子</span>}
      </div>
      <div className="wl-tiles">
        {left.map((x) => (
          <button key={x.id} className="tile en" onClick={() => { setPicked([...picked, x]); setChecked(null); }}>
            {x.text}
          </button>
        ))}
      </div>
      {!left.length && checked !== true && (
        <button className="btn primary" onClick={check}>對答案</button>
      )}
      {checked === false && <p className="small">順序還不對：點上面的字卡可以拿回來重排。</p>}
      {checked === true && <p className="small strong">排對了！ <Say text={g.sentence} /></p>}
    </>
  );
}
