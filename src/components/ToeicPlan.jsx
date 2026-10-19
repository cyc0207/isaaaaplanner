import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { taipeiToday, shortLabel } from '../lib/date.js';
import { newItem, review, TYPES } from '../lib/english.js';
import { ENGLISH_HABIT } from '../lib/seed.js';
import { logError } from '../lib/errlog.js';
import {
  PLAN, PARTS, PART_KEYS, ERROR_TYPES, TOTAL_QUESTIONS, STATUS_LABEL, CARD_TAG,
  schedule, planDocs, todayPlan, summary, accuracy, pctText, roundStatus, hasStarted, isAnswered, answeredCount, partDone,
  cleanRecord, partOf, mistakeId, errorTypeCounts, weekdayMaterial, mistakePrompt, parseAiReply, cardFromMistake, trendRows, dayId,
} from '../lib/toeic.js';
import { Sheet } from './ui.jsx';
import { ReviewCard } from './EnglishToday.jsx';

const md = (d) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '');

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('複製下面這段', text);
    return false;
  }
}

// 只在英文頁讀 toeic、toeicMistakes 兩個集合（最多幾十份），不放進每次開 app 的全域訂閱
export function useToeic() {
  const { uid, api } = useData();
  const [docs, setDocs] = useState(null);
  const [mistakes, setMistakes] = useState(null);
  const created = useRef(false);

  useEffect(() => {
    setDocs(null);
    setMistakes(null);
    const u1 = onSnapshot(
      collection(db, 'users', uid, 'toeic'),
      (snap) => {
        const m = Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
        setDocs(m);
        // 第一次打開才建立計畫：只看伺服器回來的結果，避免本機快取還空著就重寫
        if (!snap.metadata.fromCache && !created.current) {
          created.current = true;
          const missing = planDocs().filter((d) => !m[d.path.split('/')[1]]);
          if (missing.length) {
            api.batch(missing.map((d) => ({ set: d.path, data: d.path === 'toeic/plan' ? { ...d.data, createdAtMs: Date.now() } : d.data })));
          }
        }
      },
      (e) => logError('讀取 TOEIC 計畫', e, { show: false }),
    );
    const u2 = onSnapshot(
      collection(db, 'users', uid, 'toeicMistakes'),
      (snap) => setMistakes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => logError('讀取 TOEIC 錯題', e, { show: false }),
    );
    return () => {
      u1();
      u2();
    };
  }, [uid, api]);

  return { loaded: !!docs && !!mistakes, docs: docs || {}, mistakes: mistakes || [] };
}

// 多益任務做完：首頁「英文 15 分鐘」自動打勾（手動打勾照舊）
function useMarkEnglish(t) {
  const { api, habits, habitLog, englishLog } = useData();
  return (note) => {
    if (habits.includes(ENGLISH_HABIT) && !habitLog[t]?.done?.[ENGLISH_HABIT]) api.set(`habitLog/${t}`, { done: { [ENGLISH_HABIT]: true } });
    if (!englishLog[t]) api.set(`englishLog/${t}`, { minutes: 10, note });
  };
}

// ---- 英文 › 今天 最上面的卡片 ----
export default function ToeicCard({ openOnLoad }) {
  const tz = useToeic();
  const t = taipeiToday();
  const [view, setView] = useState(openOnLoad ? { name: 'plan' } : null);
  const p = todayPlan(t, tz.docs);
  const s = summary(tz.docs);
  const week = p.week >= 1 && p.week <= PLAN.rounds ? p.week : null;
  const weekRound = week ? p.thisRound : null;
  const reviewText = !weekRound ? '—' : weekRound.reviewed ? '完成' : hasStarted(weekRound) ? '還沒' : '還沒寫題';
  const todayDone = p.kind === 'weekday' ? !!tz.docs[dayId(t)]?.done : !!p.done;

  const start = () => {
    if (p.kind === 'test' || p.kind === 'review-wait') setView({ name: 'round', id: p.round.id });
    else if (p.kind === 'review') setView({ name: 'round', id: p.round.id, focus: 'review' });
    else if (p.kind === 'weekday') setView({ name: 'today' });
    else if (p.kind === 'before') setView({ name: 'round', id: 'r01' });
    else setView({ name: 'plan' });
  };

  return (
    <section className="card toeic-card">
      <div className="row between wrap">
        <strong>{PLAN.title}</strong>
        <span className="chip">
          {p.phase === 'before' ? `還沒開始・${shortLabel(PLAN.start)} 第 1 回` : p.phase === 'after' ? '12 週結束' : `第 ${week} 週・第 ${weekRound.round} 回`}
        </span>
      </div>
      <div className={`toeic-today ${todayDone ? 'done' : ''}`}>
        <span className="small strong">今天{todayDone ? '・已完成' : ''}</span>
        <p className="toeic-title">{p.title}</p>
        <p className="muted small">{p.detail}</p>
      </div>
      <div className="toeic-stats">
        <div>
          <span className="num big">{s.completed}</span>/12
          <span className="label">已完成回數</span>
        </div>
        <div>
          <span className="num big">{s.questions.toLocaleString('en-US')}</span>/{TOTAL_QUESTIONS.toLocaleString('en-US')}
          <span className="label">已作答題數</span>
        </div>
        <div>
          <span className="num big">{s.latest ? pctText(s.latest.acc) : '—'}</span>
          <span className="label">{s.latest ? `最近：第 ${s.latest.round} 回` : '最近正確率'}</span>
        </div>
        <div>
          <span className="big">{reviewText}</span>
          <span className="label">本週檢討</span>
        </div>
      </div>
      <div className="row gap">
        <button className="btn primary grow" onClick={start} disabled={!tz.loaded}>
          開始／記錄練習
        </button>
        <button className="btn" onClick={() => setView({ name: 'plan' })} disabled={!tz.loaded}>
          12 回進度
        </button>
      </div>
      {view && <ToeicSheet tz={tz} view={view} setView={setView} t={t} plan={p} />}
    </section>
  );
}

function ToeicSheet({ tz, view, setView, t, plan }) {
  const close = () => setView(null);
  const round = view.name === 'round' ? schedule().find((s) => s.id === view.id) : null;
  const title = round ? `第 ${round.round} 回` : view.name === 'today' ? plan.title : PLAN.title;
  return (
    <Sheet title={title} onClose={close}>
      {view.name !== 'plan' && (
        <button className="btn small back-btn" onClick={() => setView({ name: 'plan', tab: view.from })}>
          ← 12 回進度
        </button>
      )}
      {view.name === 'plan' && <PlanView tz={tz} tab={view.tab} setView={setView} />}
      {round && <RoundView key={round.id} tz={tz} s={round} t={t} focus={view.focus} />}
      {view.name === 'today' && <WeekdayTask tz={tz} plan={plan} t={t} />}
    </Sheet>
  );
}

// ---- 12 回進度表／錯題／趨勢 ----
function PlanView({ tz, tab: tab0, setView }) {
  const [tab, setTab] = useState(tab0 || 'rounds');
  return (
    <div>
      <p className="muted small">
        {PLAN.book}・{PLAN.rounds} 回 × {PLAN.perRound} 題・每回限時 {PLAN.minutes} 分鐘・{md(PLAN.start)}～{md(PLAN.end)}
      </p>
      <div className="tabs" role="tablist">
        {[['rounds', '進度表'], ['mistakes', '錯題'], ['trend', '趨勢']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'rounds' && <RoundList tz={tz} setView={setView} />}
      {tab === 'mistakes' && <MistakeList tz={tz} setView={setView} />}
      {tab === 'trend' && <Trend tz={tz} />}
    </div>
  );
}

function RoundList({ tz, setView }) {
  return (
    <ul className="list toeic-rounds">
      {schedule().map((s) => {
        const r = { ...s, ...(tz.docs[s.id] || {}) };
        const st = roundStatus(r);
        const acc = accuracy(r).all;
        const n = tz.mistakes.filter((m) => m.round === s.round).length;
        return (
          <li key={s.id} className={`task toeic-round st-${st}`} onClick={() => setView({ name: 'round', id: s.id, from: 'rounds' })}>
            <span className="toeic-no num">{s.round}</span>
            <div className="task-body">
              <div className="task-title">
                預定 {shortLabel(s.plannedDate)}
                {r.answeredDate && r.answeredDate !== s.plannedDate && <span className="muted small">・實際 {md(r.answeredDate)}</span>}
              </div>
              <div className="task-meta">
                <span className={`chip ${st === 'answered' ? 'warn' : st === 'reviewed' ? 'ok' : ''}`}>{STATUS_LABEL[st]}</span>
                {acc && <span>正確率 {pctText(acc)}{acc.parts.length < 3 ? '（部分）' : ''}</span>}
                {!acc && hasStarted(r) && <span>寫了 {answeredCount(r)} 題，還沒對答案</span>}
                {n > 0 && <span>錯題 {n}</span>}
              </div>
            </div>
            <span>→</span>
          </li>
        );
      })}
    </ul>
  );
}

function MistakeList({ tz, setView }) {
  const [type, setType] = useState('');
  const counts = errorTypeCounts(tz.mistakes);
  const shown = tz.mistakes.filter((m) => !type || m.errorType === type).sort((a, b) => a.round - b.round || a.q - b.q);
  if (!tz.mistakes.length) return <p className="muted">還沒有錯題。寫完一回、對完答案後，在那一回裡記下錯的題號和原因。</p>;
  return (
    <div>
      <div className="type-chips">
        <button className={`chip-btn ${!type ? 'on' : ''}`} onClick={() => setType('')}>
          全部 {tz.mistakes.length}
        </button>
        {counts.map(([k, n]) => (
          <button key={k} className={`chip-btn ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>
            {ERROR_TYPES[k]} {n}
          </button>
        ))}
      </div>
      <ul className="list">
        {shown.map((m) => (
          <li key={m.id} className="task" onClick={() => setView({ name: 'round', id: `r${String(m.round).padStart(2, '0')}`, from: 'mistakes' })}>
            <div className="task-body">
              <div className="task-title">
                第 {m.round} 回・{PARTS[m.part]?.label} 第 {m.q} 題・{ERROR_TYPES[m.errorType]}
              </div>
              <div className="task-meta">
                {m.understood && <span className="chip ok">已理解</span>}
                {m.retry && <span className="chip warn">要重寫</span>}
                {m.cardId && <span>已加入複習</span>}
                {(m.grammarPoint || m.note) && <span className="ellipsis">{m.grammarPoint || m.note}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Trend({ tz }) {
  const rows = trendRows(tz.docs);
  const s = summary(tz.docs);
  const counts = errorTypeCounts(tz.mistakes);
  const max = counts[0]?.[1] || 1;
  const has = rows.some((r) => r.acc.all || r.minutes !== null);
  return (
    <div>
      <p className="small">
        已作答 <span className="num">{s.completed}</span> 回・檢討完 <span className="num">{s.reviewed}</span> 回・待檢討 <span className="num">{s.pendingReview}</span> 回
      </p>
      {!has ? (
        <p className="muted">還沒有成績。對完答案填進去以後，這裡會出現每一回的正確率和時間。</p>
      ) : (
        <div className="table-wrap">
          <table className="toeic-table">
            <thead>
              <tr>
                <th>回</th>
                <th>總</th>
                <th>P5</th>
                <th>P6</th>
                <th>P7</th>
                <th>分鐘</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.round} className={r.status === 'todo' ? 'muted' : ''}>
                  <td className="num">{r.round}</td>
                  <td>
                    {r.acc.all ? (
                      <span className="pct-bar">
                        <i style={{ width: `${Math.round(r.acc.all.pct * 100)}%` }} />
                        <b className="num">{pctText(r.acc.all)}</b>
                      </span>
                    ) : '—'}
                  </td>
                  {PART_KEYS.map((k) => (
                    <td key={k} className="num">{pctText(r.acc[k])}</td>
                  ))}
                  <td className="num">
                    {r.minutes ?? '—'}
                    {r.minutes !== null && r.timed === false ? '*' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.some((r) => r.timed === false) && <p className="muted small">* 沒有一次限時寫完</p>}
      <h3>常犯的錯</h3>
      {!counts.length && <p className="muted small">還沒有錯題。</p>}
      <ul className="list toeic-types">
        {counts.map(([k, n]) => (
          <li key={k}>
            <span>{ERROR_TYPES[k]}</span>
            <span className="type-track">
              <span className="type-bar" style={{ width: `${Math.max(6, (n / max) * 100)}%` }} />
            </span>
            <span className="num">{n}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">這裡只是這本書的答對比例，不換算、也不預測多益分數。</p>
    </div>
  );
}

// ---- 一回：作答紀錄、錯題、週六檢討 ----
function RoundView({ tz, s, t, focus }) {
  const r = { ...s, ...(tz.docs[s.id] || {}) };
  const reviewRef = useRef(null);
  useEffect(() => {
    if (focus === 'review') reviewRef.current?.scrollIntoView({ block: 'start' });
  }, [focus]);
  return (
    <div className="toeic-round-view">
      <p className="muted small">
        預定 {shortLabel(s.plannedDate)} 寫、{shortLabel(s.reviewDate)} 檢討
        {s.round <= 2 ? '・可以分幾次寫完' : s.round === 3 ? '・試著一次寫完' : `・一次寫完 ${PLAN.minutes} 分鐘`}
      </p>
      <RecordForm r={r} t={t} />
      <div ref={reviewRef}>
        <ReviewSteps r={r} tz={tz} t={t} />
      </div>
      <Mistakes r={r} tz={tz} t={t} />
      <AiImport tz={tz} t={t} />
    </div>
  );
}

const formOf = (r) => ({
  answeredDate: r.answeredDate || '',
  p5: r.p5 ?? '', p6: r.p6 ?? '', p7: r.p7 ?? '',
  done: { p5: partDone(r, 'p5'), p6: partDone(r, 'p6'), p7: partDone(r, 'p7') },
  minutes: r.minutes ?? '',
  timed: r.timed ?? null,
  checked: !!r.checked,
  note: r.note || '',
});

function RecordForm({ r, t }) {
  const { api } = useData();
  const markEnglish = useMarkEnglish(t);
  const [f, setF] = useState(() => formOf(r));
  const [msg, setMsg] = useState('');
  const [errors, setErrors] = useState([]);
  const set = (patch) => {
    setF({ ...f, ...patch });
    setMsg('');
  };

  const save = (e) => {
    e.preventDefault();
    const { data, errors: errs } = cleanRecord(f);
    setErrors(errs);
    if (errs.length) return;
    if (!data.answeredDate && PART_KEYS.some((k) => data.done[k])) data.answeredDate = t;
    const wasAnswered = isAnswered(r);
    api.set(`toeic/${r.id}`, {
      ...data, round: r.round, plannedDate: r.plannedDate, reviewDate: r.reviewDate, updatedAtMs: Date.now(),
    });
    if (!wasAnswered && isAnswered(data)) markEnglish(`TOEIC 閱讀第 ${r.round} 回`);
    setF({ ...f, answeredDate: data.answeredDate });
    setMsg(isAnswered(data) ? '存好了。' : '存好了，之後可以再補。');
  };

  const live = accuracy(cleanRecord(f).data);

  return (
    <form className="form toeic-form" onSubmit={save}>
      <h3>作答紀錄</h3>
      <label>
        實際作答日期
        <input type="date" value={f.answeredDate} onChange={(e) => set({ answeredDate: e.target.value })} />
      </label>
      <div className="toeic-parts">
        {PART_KEYS.map((k) => (
          <div key={k} className="toeic-part">
            <span className="strong">{PARTS[k].label}</span>
            <span className="muted small">{PARTS[k].from}–{PARTS[k].to}</span>
            <label className="inline small">
              <input type="checkbox" checked={f.done[k] || String(f[k]).trim() !== ''} onChange={(e) => set({ done: { ...f.done, [k]: e.target.checked } })} />
              寫完了
            </label>
            <label className="inline small score-in">
              答對
              <input inputMode="numeric" pattern="[0-9]*" value={f[k]} onChange={(e) => set({ [k]: e.target.value.replace(/\D/g, '') })} placeholder="—" aria-label={`${PARTS[k].label} 答對題數`} />
              /{PARTS[k].total}
            </label>
            <span className="num pct">{pctText(live[k])}</span>
          </div>
        ))}
        <div className="toeic-part total">
          <span className="strong">總正確率</span>
          <span className="muted small">{live.all ? (live.all.parts.length < 3 ? `只算已填的 ${live.all.total} 題` : '100 題') : '還沒填成績'}</span>
          <span className="num pct">{pctText(live.all)}</span>
        </div>
      </div>
      <label>
        實際作答分鐘數
        <input inputMode="numeric" pattern="[0-9]*" value={f.minutes} onChange={(e) => set({ minutes: e.target.value.replace(/\D/g, '') })} placeholder={`目標 ${PLAN.minutes}`} />
      </label>
      <div className="toeic-field">
        <span className="small muted">限時一次寫完？</span>
        <div className="seg">
          {[[true, '是'], [false, '否'], [null, '不填']].map(([v, l]) => (
            <button type="button" key={l} className={f.timed === v ? 'on' : ''} onClick={() => set({ timed: v })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <label className="inline">
        <input type="checkbox" checked={f.checked} onChange={(e) => set({ checked: e.target.checked })} /> 已對答案
      </label>
      <label>
        備註
        <textarea rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="例如：Part 7 雙篇時間不夠" />
      </label>
      {errors.map((x) => (
        <p key={x} className="hint over">{x}</p>
      ))}
      <button className="btn primary" type="submit">
        儲存
      </button>
      {msg && <p className="hint ok">{msg}</p>}
    </form>
  );
}

function ReviewSteps({ r, tz, t }) {
  const { api } = useData();
  const markEnglish = useMarkEnglish(t);
  const mine = tz.mistakes.filter((m) => m.round === r.round);
  if (!hasStarted(r)) {
    return (
      <section className="toeic-review">
        <h3>週六檢討</h3>
        <p className="muted small">這回還沒有作答紀錄，寫完、填好成績再檢討。</p>
      </section>
    );
  }
  const cards = mine.filter((m) => m.cardId).length;
  const steps = [
    { done: !!r.recordConfirmed, text: '確認這回的答題紀錄', action: !r.recordConfirmed && (() => api.set(`toeic/${r.id}`, { recordConfirmed: true })), label: '確認' },
    { done: mine.length >= 3, text: `選出最值得檢討的 3～5 題（已記 ${mine.length} 題）` },
    { done: mine.length > 0 && mine.every((m) => ERROR_TYPES[m.errorType]), text: '記錄錯誤原因' },
    { done: cards >= 1, text: `挑 1～3 個句型加入間隔複習（已加 ${cards} 個）` },
  ];
  const finish = () => {
    api.set(`toeic/${r.id}`, { reviewed: true, reviewedDate: t, updatedAtMs: Date.now() });
    markEnglish(`TOEIC 閱讀第 ${r.round} 回檢討`);
  };
  return (
    <section className="toeic-review">
      <h3>週六檢討</h3>
      <ol className="toeic-steps">
        {steps.map((x) => (
          <li key={x.text} className={x.done ? 'done' : ''}>
            <span className="step-box">{x.done ? '✓' : ''}</span>
            <span className="grow">{x.text}</span>
            {x.action && (
              <button className="btn small" onClick={x.action}>
                {x.label}
              </button>
            )}
          </li>
        ))}
        <li className={r.reviewed ? 'done' : ''}>
          <span className="step-box">{r.reviewed ? '✓' : ''}</span>
          <span className="grow">{r.reviewed ? `本週檢討完成（${md(r.reviewedDate)}）` : '標記本週檢討完成'}</span>
          {r.reviewed ? (
            <button className="btn small" onClick={() => api.set(`toeic/${r.id}`, { reviewed: false })}>
              取消
            </button>
          ) : (
            <button className="btn small primary" onClick={finish}>
              完成
            </button>
          )}
        </li>
      </ol>
    </section>
  );
}

function Mistakes({ r, tz, t }) {
  const { api } = useData();
  const mine = tz.mistakes.filter((m) => m.round === r.round).sort((a, b) => a.q - b.q);
  const [q, setQ] = useState('');
  const [part, setPart] = useState('');
  const [type, setType] = useState('');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);
  const autoPart = partOf(q);
  const usePart = part || autoPart;

  const add = (e) => {
    e.preventDefault();
    const n = Number(q);
    if (!n || !usePart || !type) return;
    const id = mistakeId(r.round, usePart, n);
    const exists = tz.mistakes.some((m) => m.id === id);
    api.set(`toeicMistakes/${id}`, {
      round: r.round, part: usePart, q: n, errorType: type, ...(note.trim() ? { note: note.trim() } : {}),
      updatedAtMs: Date.now(), ...(exists ? {} : { understood: false, retry: false, createdAtMs: Date.now() }),
    });
    setQ('');
    setPart('');
    setNote('');
  };

  const copyAll = async () => {
    const list = mine.filter((m) => !m.understood);
    await copyText(mistakePrompt(list.length ? list : mine));
    setCopied(true);
  };

  return (
    <section className="toeic-mistakes">
      <h3>錯題（{mine.length}）</h3>
      <p className="muted small">只記題號、原因和自己的筆記，題目原文不會存。</p>
      <form className="toeic-add" onSubmit={add}>
        <input inputMode="numeric" pattern="[0-9]*" value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, ''))} placeholder="題號" aria-label="題號" />
        <select value={usePart} onChange={(e) => setPart(e.target.value)} aria-label="Part">
          <option value="">Part</option>
          {PART_KEYS.map((k) => (
            <option key={k} value={k}>{PARTS[k].label}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="錯誤類型">
          <option value="">錯誤類型</option>
          {Object.entries(ERROR_TYPES).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <input className="grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder="筆記（可不填）" />
        <button className="btn primary" disabled={!q || !usePart || !type}>
          記下
        </button>
      </form>
      <ul className="list">
        {mine.map((m) => (
          <MistakeRow key={m.id} m={m} t={t} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
        ))}
      </ul>
      {mine.length > 0 && (
        <button className="btn small" onClick={copyAll}>
          {copied ? '已複製，貼給 ChatGPT 或 Claude' : `複製錯題分析 prompt（${mine.filter((m) => !m.understood).length || mine.length} 題）`}
        </button>
      )}
    </section>
  );
}

function MistakeRow({ m, t, open, onToggle }) {
  const { api } = useData();
  const [ask, setAsk] = useState('');
  const [cardType, setCardType] = useState(m.suggestedReview === 'fix' ? 'fix' : 'grammar');
  const [copied, setCopied] = useState(false);
  const upd = (patch) => api.update(`toeicMistakes/${m.id}`, { ...patch, updatedAtMs: Date.now() });
  const addCard = () => {
    const id = api.add('englishItems', newItem(cardFromMistake(m, cardType), t));
    upd({ cardId: id, toReview: true });
  };
  return (
    <li className="toeic-mistake">
      <div className="row gap" onClick={onToggle}>
        <span className="grow">
          <strong>{PARTS[m.part]?.label} 第 {m.q} 題</strong>・{ERROR_TYPES[m.errorType] || '沒分類'}
          {m.note && <span className="muted small"><br />{m.note}</span>}
        </span>
        {m.understood && <span className="chip ok">已理解</span>}
        {m.cardId && <span className="chip">複習中</span>}
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="toeic-mistake-edit">
          <label>
            錯誤類型
            <select value={m.errorType || ''} onChange={(e) => upd({ errorType: e.target.value })}>
              {Object.entries(ERROR_TYPES).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            筆記
            <textarea rows={2} defaultValue={m.note || ''} onBlur={(e) => e.target.value !== (m.note || '') && upd({ note: e.target.value.trim() })} />
          </label>
          <div className="row gap wrap">
            <label className="inline"><input type="checkbox" checked={!!m.understood} onChange={(e) => upd({ understood: e.target.checked })} /> 已理解</label>
            <label className="inline"><input type="checkbox" checked={!!m.retry} onChange={(e) => upd({ retry: e.target.checked })} /> 需要重新練習</label>
          </div>
          {m.explanationZh && (
            <div className="ai-note">
              <span className="small strong">AI 解釋</span>
              {m.grammarPoint && <p className="small"><b>{m.grammarPoint}</b></p>}
              <p className="small">{m.explanationZh}</p>
              {m.reviewSentence && <p className="small flash-example">{m.reviewSentence}</p>}
            </div>
          )}
          {m.cardId ? (
            <p className="hint ok">已加入複習（卡片庫・#{CARD_TAG}）</p>
          ) : (
            <div className="row gap wrap">
              <select value={cardType} onChange={(e) => setCardType(e.target.value)} aria-label="卡片種類">
                {['grammar', 'fix', 'sentence'].map((k) => (
                  <option key={k} value={k}>{TYPES[k]}卡</option>
                ))}
              </select>
              <button className="btn small" onClick={addCard}>
                加入複習
              </button>
            </div>
          )}
          <label>
            想問 AI 的句子或我的理解（不會存）
            <textarea rows={2} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="只貼有疑問的那一句" />
          </label>
          <div className="row gap wrap">
            <button className="btn small" onClick={async () => { await copyText(mistakePrompt([{ ...m, ask }])); setCopied(true); }}>
              {copied ? '已複製' : '複製這題的 prompt'}
            </button>
            <button
              className="btn small danger"
              onClick={() => window.confirm(`刪除第 ${m.q} 題？`) && api.remove(`toeicMistakes/${m.id}`)}
            >
              刪除
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// 貼回 AI 的 JSON：先預覽、驗證，再勾要存的；只寫錯題的解釋欄位，不碰成績
function AiImport({ tz, t }) {
  const { api } = useData();
  const [raw, setRaw] = useState('');
  const [res, setRes] = useState(null);
  const [pick, setPick] = useState({});
  const [msg, setMsg] = useState('');
  const byId = useMemo(() => Object.fromEntries(tz.mistakes.map((m) => [m.id, m])), [tz.mistakes]);

  const check = () => {
    const r = parseAiReply(raw);
    setRes(r);
    setMsg('');
    setPick(Object.fromEntries(r.items.filter((x) => x.ok).map((x) => [x.i, { save: true, card: '' }])));
  };

  const confirm = () => {
    const ops = [];
    let cards = 0;
    for (const it of res.items) {
      const p = pick[it.i];
      if (!it.ok || !p?.save) continue;
      const id = mistakeId(it.round, it.part, it.q);
      const old = byId[id];
      const ai = { explanationZh: it.explanationZh, grammarPoint: it.grammarPoint, suggestedReview: it.suggestedReview, reviewSentence: it.reviewSentence, aiErrorType: it.errorType, aiAtMs: Date.now() };
      const base = old ? {} : { round: it.round, part: it.part, q: it.q, errorType: it.errorType, understood: false, retry: false, createdAtMs: Date.now() };
      let cardId = {};
      if (p.card && !old?.cardId) {
        const m = { ...(old || base), ...ai, round: it.round, part: it.part, q: it.q, errorType: old?.errorType || it.errorType };
        cardId = { cardId: api.add('englishItems', newItem(cardFromMistake(m, p.card), t)), toReview: true };
        cards += 1;
      }
      ops.push({ set: `toeicMistakes/${id}`, data: { ...base, ...ai, ...cardId, updatedAtMs: Date.now() } });
    }
    if (ops.length) api.batch(ops);
    setMsg(`存了 ${ops.length} 題的解釋${cards ? `，加了 ${cards} 張複習卡` : ''}。成績沒有改動。`);
    setRes(null);
    setRaw('');
  };

  const saving = res ? res.items.filter((x) => x.ok && pick[x.i]?.save).length : 0;

  return (
    <details className="toeic-ai">
      <summary className="strong">貼回 AI 的解釋</summary>
      <p className="muted small">把 ChatGPT 或 Claude 回覆裡的 json 整段貼上。會先檢查格式，你勾了才存；不會改到作答成績。</p>
      <textarea className="paste" rows={5} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder='{"version": 1, "items": [...]}' />
      <button className="btn small" disabled={!raw.trim()} onClick={check}>
        檢查
      </button>
      {res?.error && <p className="hint over">{res.error}</p>}
      {res && !res.error && (
        <div className="preview">
          <ul className="list">
            {res.items.map((it) => {
              const id = it.ok ? mistakeId(it.round, it.part, it.q) : '';
              const old = byId[id];
              return (
                <li key={it.i} className={`toeic-mistake st-${it.ok ? 'ok' : 'error'}`}>
                  <label className="row gap">
                    <input
                      type="checkbox" disabled={!it.ok} checked={!!pick[it.i]?.save}
                      onChange={(e) => setPick({ ...pick, [it.i]: { ...pick[it.i], save: e.target.checked } })}
                    />
                    <span className="grow small">
                      {it.ok ? (
                        <>
                          <strong>第 {it.round} 回 {PARTS[it.part].label} 第 {it.q} 題</strong>・{ERROR_TYPES[it.errorType]}
                          {!old && <span className="muted">（新的錯題）</span>}
                          {old && old.errorType !== it.errorType && <span className="muted">（你記的是 {ERROR_TYPES[old.errorType]}，不會改掉）</span>}
                          {it.grammarPoint && <><br /><b>{it.grammarPoint}</b></>}
                          <br />
                          {it.explanationZh}
                          {it.reviewSentence && <><br /><i>{it.reviewSentence}</i></>}
                        </>
                      ) : (
                        <span className="hint over">第 {it.i + 1} 筆有錯：{it.errors.join('；')}</span>
                      )}
                    </span>
                  </label>
                  {it.ok && pick[it.i]?.save && !old?.cardId && (
                    <select value={pick[it.i]?.card || ''} onChange={(e) => setPick({ ...pick, [it.i]: { ...pick[it.i], card: e.target.value } })} aria-label="加入卡片">
                      <option value="">不加卡片</option>
                      <option value="grammar">加入文法卡</option>
                      <option value="fix">加入改錯卡</option>
                      <option value="sentence">加入句型卡</option>
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="row gap">
            <button className="btn primary" disabled={!saving} onClick={confirm}>
              存 {saving} 題
            </button>
            <button className="btn" onClick={() => setRes(null)}>
              取消
            </button>
          </div>
        </div>
      )}
      {msg && <p className="hint ok">{msg}</p>}
    </details>
  );
}

// ---- 週一～四：5～10 分鐘 ----
function WeekdayTask({ tz, plan, t }) {
  const { api, englishItems } = useData();
  const markEnglish = useMarkEnglish(t);
  const day = tz.docs[dayId(t)] || {};
  const [note, setNote] = useState(day.note || '');
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const wd = plan.wd;
  const mat = useMemo(
    () => weekdayMaterial(wd, { mistakes: tz.mistakes, cards: englishItems, beforeRound: plan.thisRound.round, t }),
    // 卡片複習時 englishItems 會變，只在打開時挑一次
    [wd, t, plan.thisRound.round, tz.mistakes.length], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const prev = plan.week > 1 ? { ...schedule()[plan.week - 2], ...(tz.docs[schedule()[plan.week - 2].id] || {}) } : null;

  const done = () => {
    api.set(`toeic/${dayId(t)}`, { date: t, kind: plan.task.kind, done: true, ...(note.trim() ? { note: note.trim() } : {}), doneAtMs: Date.now() });
    markEnglish(`TOEIC 閱讀：${plan.task.title}`);
  };

  const empty = wd === 1 ? !mat.cards?.length : !mat.mistakes?.length;

  return (
    <div className="toeic-weekday">
      <p className="muted small">第 {plan.week} 週・{plan.task.time}・複習之前回數的錯題</p>
      {prev && isAnswered(prev) && !prev.reviewed && <p className="hint warn">第 {prev.round} 回還沒檢討，有空可以先補。</p>}

      {empty && (
        <div className="card">
          <p className="strong">還沒有可以用的錯題{wd === 1 ? '卡' : ''}。</p>
          <p className="muted small">今天做一般英文練習就好：下面的新字、複習，或閱讀分頁的文章自由讀。做完按「完成」。</p>
        </div>
      )}

      {wd === 1 && !empty && (
        i < mat.cards.length ? (
          <>
            <p className="muted small">第 {i + 1}/{mat.cards.length} 張</p>
            <ReviewCard
              key={mat.cards[i].id}
              card={mat.cards[i]}
              forceFlip
              onAnswer={(ok) => {
                const c = mat.cards[i];
                if (mat.dueIds.includes(c.id)) api.update(`englishItems/${c.id}`, review(c, ok, t));
                setI(i + 1);
              }}
            />
          </>
        ) : (
          <p className="hint ok">{mat.cards.length} 張都看完了。</p>
        )
      )}

      {wd === 2 && !empty && (
        <>
          {mat.mistakes.map((m) => (
            <div key={m.id} className="card">
              <p className="muted small">第 {m.round} 回 {PARTS[m.part]?.label} 第 {m.q} 題・{ERROR_TYPES[m.errorType]}</p>
              <p className="flash-example">{m.reviewSentence || m.note}</p>
            </div>
          ))}
          <label className="toeic-field">
            <span className="small muted">我的拆解：主詞／動詞／子句從哪裡開始（不用寫完整）</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button
            className="btn small"
            disabled={!note.trim()}
            onClick={async () => {
              const m = mat.mistakes[0];
              await copyText(`請用繁體中文檢查我對這個英文長句的結構拆解，指出主詞、主要動詞和每個子句，錯的地方告訴我為什麼：\n\n句子：${m.reviewSentence || m.note}\n我的拆解：${note.trim()}`);
              setCopied(true);
            }}
          >
            {copied ? '已複製' : '複製給 AI 檢查'}
          </button>
        </>
      )}

      {(wd === 3 || wd === 4) && !empty && (
        <>
          {wd === 4 && mat.top && (
            <p className="strong">
              第 {mat.round} 回最常錯：{ERROR_TYPES[mat.top[0]]}（{mat.top[1]} 題）
            </p>
          )}
          <ul className="list">
            {mat.mistakes.map((m) => (
              <li key={m.id} className="card">
                <p className="muted small">第 {m.round} 回 {PARTS[m.part]?.label} 第 {m.q} 題・{ERROR_TYPES[m.errorType]}</p>
                {m.grammarPoint && <p className="strong small">{m.grammarPoint}</p>}
                {(m.explanationZh || m.note) && <p className="small">{m.explanationZh || m.note}</p>}
                {m.reviewSentence && <p className="flash-example small">{m.reviewSentence}</p>}
              </li>
            ))}
          </ul>
          <p className="muted small">看一遍、在心裡說出為什麼對。想記下來可以寫在這裡：</p>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </>
      )}

      {day.done ? (
        <p className="hint ok">今天的小任務完成了。</p>
      ) : (
        <button className="btn primary big" onClick={done}>
          完成
        </button>
      )}
    </div>
  );
}
