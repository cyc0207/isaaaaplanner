import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { taipeiToday, shortLabel, weekStart, WEEKDAY_NAMES } from '../lib/date.js';
import { ENGLISH_HABIT } from '../lib/seed.js';
import { logError } from '../lib/errlog.js';
import { REMINDER_TIMES } from '../lib/reminder.js';
import { todayPlan } from '../lib/toeic.js';
import {
  KINDS, SCHEDULE_KINDS, STATUS_LABEL, TAG_LABEL, getSchedule, slotFor, buildMission, grade, pendingMissions, postponeTo,
  weekSummary, tagStats, tagWeights,
} from '../lib/mission.js';
import { scheduleIcsPath, googleScheduleLinks } from '../lib/missionIcs.js';
import { isAndroid } from '../lib/inapp.js';
import { useToeic } from './ToeicPlan.jsx';
import { VoiceGate, Part2Runner, Part34Runner, ListenResult } from './ListeningRunner.jsx';

// 任務文件在 englishMission/{台灣日期}；只讀最近 30 份，不放進每次開 app 的全域訂閱
export function useMissions() {
  const { uid, api, englishSchedule } = useData();
  const t = taipeiToday();
  const schedule = getSchedule(englishSchedule);
  const [list, setList] = useState(null);
  const [fromServer, setFromServer] = useState(false);
  const [local, setLocal] = useState(null); // 建立失敗（例如離線）時先用本機算出的同一份
  const creating = useRef(null); // 正在建立哪一天的（過午夜要能再建新的一天）

  useEffect(() => {
    setList(null);
    const q = query(collection(db, 'users', uid, 'englishMission'), orderBy('date', 'desc'), limit(30));
    // 要收 metadata 變化：本機快取和伺服器一樣時，伺服器回應只會改 fromCache
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        if (!snap.metadata.fromCache) setFromServer(true);
      },
      (e) => logError('讀取英文任務', e, { show: false }),
    );
  }, [uid]);

  const stored = list?.find((m) => m.id === t) || null;
  const slot = slotFor(t, schedule);

  // 今天第一次打開：沒有就建立，有就不動（transaction 確保兩台手機同時開也只有一份）
  useEffect(() => {
    if (!list || stored || !slot.doc || creating.current === t) return;
    if (!fromServer && navigator.onLine) return; // 等伺服器回應，避免本機快取還沒同步就重建；離線就先用本機的
    creating.current = t;
    const history = list.filter((m) => m.id !== t);
    const built = buildMission(t, schedule, history);
    const ref = doc(db, 'users', uid, 'englishMission', t);
    runTransaction(db, async (tx) => {
      const cur = await tx.get(ref);
      if (!cur.exists()) tx.set(ref, built);
    }).catch((e) => {
      logError('建立今天的英文任務', e, { show: false });
      setLocal({ id: t, ...built, unsaved: true });
    });
  }, [list, stored, slot.doc, fromServer, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const mission = stored || (local?.id === t ? local : null);
  const history = (list || []).filter((m) => m.id !== t);
  const update = (id, data) => {
    if (local && id === local.id && local.unsaved) {
      // 第一次寫入時把整份題目一起存
      const { unsaved, id: _id, ...rest } = local;
      setLocal(null);
      api.set(`englishMission/${id}`, { ...rest, ...data });
      return;
    }
    api.set(`englishMission/${id}`, data);
  };
  return { t, schedule, slot, mission, history, loaded: !!list, update };
}

// 做完任務：首頁「英文 15 分鐘」和英文打勾（做完一份任務就算，不用再做新字）
function useMarkEnglish() {
  const { api, habits, habitLog, englishLog } = useData();
  return (t, minutes, note) => {
    if (habits.includes(ENGLISH_HABIT) && !habitLog[t]?.done?.[ENGLISH_HABIT]) api.set(`habitLog/${t}`, { done: { [ENGLISH_HABIT]: true } });
    if (!englishLog[t]) api.set(`englishLog/${t}`, { minutes, note });
  };
}

const speakLink = (m) => {
  const p = new URLSearchParams({ tab: 'speak', topic: m.prompt?.topic || 'free', q: m.prompt?.q || '', mission: m.date, kind: m.kind });
  return `/english?${p}`;
};

// 今天要顯示什麼：英文任務、多益閱讀計畫（五、六），或休息
function useToday() {
  const ms = useMissions();
  const tz = useToeic();
  const { slot, mission, t } = ms;
  let view;
  if (slot.kind === 'toeic_read' || slot.kind === 'toeic_review') {
    const p = todayPlan(t, tz.docs);
    const active = p.kind === 'test' || p.kind === 'review' || p.kind === 'review-wait';
    view = {
      kind: slot.kind, title: active ? p.title : slot.label, detail: active ? p.detail : p.detail || '這週沒有排紙本多益。',
      status: p.done ? 'done' : 'ready', minutes: slot.minutes, link: '/english?tab=practice&toeic=1', loaded: tz.loaded,
    };
  } else if (slot.kind === 'rest') {
    view = { kind: 'rest', title: '今天休息', detail: '星期日不派作業。想補做的話，下面有還沒做完的任務。', status: 'rest', loaded: true };
  } else {
    view = {
      kind: slot.kind, title: KINDS[slot.kind].label, minutes: KINDS[slot.kind].minutes, loaded: !!mission,
      status: mission?.status || 'ready', mission,
      detail: mission?.prompt ? mission.prompt.q : mission?.kind === 'part2' ? `${mission.items.length} 題短句應答，每題聽完選一個回應。` : mission?.kind === 'part34' ? `${mission.items.length} 組對話／獨白，每組 3 題。` : '',
      link: mission?.prompt ? speakLink(mission) : '/english?tab=mission',
    };
  }
  return { ...ms, view };
}

// ---- 首頁卡片 ----
export function MissionHomeCard() {
  const { t, slot, view, history } = useToday();
  const pending = pendingMissions(history, t);
  const done = view.status === 'done';
  return (
    <Link to={view.kind === 'rest' ? '/english?tab=mission' : view.link || '/english?tab=mission'} className={`card mission-home ${done ? 'done' : ''}`}>
      <div className="row between">
        <span className="small strong">Today's English Mission</span>
        <span className="muted small">{shortLabel(t)}{slot.time ? ` ${slot.time}` : ''}</span>
      </div>
      <strong className="mission-title">{view.title}</strong>
      {view.detail && <span className="muted small ellipsis">{view.detail}</span>}
      <span className="row between small">
        <span>{view.minutes ? `約 ${view.minutes} 分鐘` : ''}</span>
        <span className="strong">
          {view.kind === 'rest' ? (pending.length ? `還有 ${pending.length} 個可以補做 →` : '') : done ? '已完成・看回饋 →' : view.status === 'in_progress' ? '繼續 →' : '開始練習 →'}
        </span>
      </span>
    </Link>
  );
}

// ---- 英文 › 任務 分頁 ----
export function MissionTab() {
  const ms = useToday();
  const { t, view, history, schedule, update } = ms;
  const navigate = useNavigate();
  const mark = useMarkEnglish();
  const [open, setOpen] = useState(null); // 正在做的任務日期（今天或補做）
  const pending = pendingMissions(history, t);
  const all = [...(ms.mission ? [ms.mission] : []), ...history];
  const active = open && all.find((m) => m.date === open);

  const start = (m) => {
    if (m.prompt) {
      if (m.status === 'ready') update(m.date, { status: 'in_progress', startedAtMs: Date.now() });
      navigate(speakLink(m));
      return;
    }
    if (m.status === 'ready') update(m.date, { status: 'in_progress', startedAtMs: Date.now() });
    setOpen(m.date);
  };

  if (active) {
    return <MissionRunner m={active} update={update} mark={mark} history={history} onClose={() => setOpen(null)} />;
  }

  return (
    <div className="mission">
      <section className={`card mission-today ${view.status === 'done' ? 'done' : ''}`}>
        <div className="row between">
          <span className="small strong">{shortLabel(t)}・星期{WEEKDAY_NAMES[ms.slot.wd]}{ms.slot.time ? ` ${ms.slot.time}` : ''}</span>
          {view.status && view.status !== 'rest' && <span className="chip">{STATUS_LABEL[view.status] || ''}</span>}
        </div>
        <strong className="mission-title">{view.title}</strong>
        {view.detail && <p className="small">{view.detail}</p>}
        {view.minutes ? <p className="muted small">預估 {view.minutes} 分鐘・錯過時間也可以做</p> : null}
        {view.mission && <MissionActions m={view.mission} onStart={start} update={update} t={t} />}
        {!view.mission && view.link && view.kind !== 'rest' && (
          <Link className="btn primary" to={view.link}>{view.status === 'done' ? '看紀錄' : '開始'}</Link>
        )}
        {!view.loaded && <p className="muted small">準備今天的題目…</p>}
      </section>

      {pending.length > 0 && (
        <section className="section">
          <h2>還沒做完的任務</h2>
          {pending.map((m) => (
            <div key={m.id} className="card mission-pending">
              <div className="row between">
                <strong>{shortLabel(m.date)} {KINDS[m.kind]?.short}</strong>
                <span className="chip">{m.postponedTo ? `延到 ${shortLabel(m.postponedTo)}` : STATUS_LABEL[m.status]}</span>
              </div>
              <MissionActions m={m} onStart={start} update={update} t={t} pending />
            </div>
          ))}
        </section>
      )}

      <Progress history={all} t={t} />
      <section className="section">
        <h2>每週課表</h2>
        <ScheduleEditor />
        <ScheduleReminder schedule={schedule} />
      </section>
    </div>
  );
}

function MissionActions({ m, onStart, update, t, pending }) {
  if (m.status === 'done') {
    return (
      <div className="row gap wrap">
        <span className="small">
          {m.result?.total ? `答對 ${m.result.correct}／${m.result.total}` : m.result?.answers ? `回答 ${m.result.answers} 次` : '完成'}
        </span>
        <button className="btn small" onClick={() => onStart(m)}>{m.prompt ? '再練一次' : '看答案和解析'}</button>
      </div>
    );
  }
  if (m.status === 'skipped') return <p className="muted small">已跳過</p>;
  return (
    <div className="row gap wrap">
      <button className="btn primary" onClick={() => onStart(m)}>{m.status === 'in_progress' ? '繼續' : pending ? '補做' : '開始練習'}</button>
      {!pending && !m.postponedTo && <button className="btn small" onClick={() => update(m.date, { postponedTo: postponeTo(t) })}>延到明天</button>}
      <button className="btn small" onClick={() => window.confirm('這次的任務跳過不做？') && update(m.date, { status: 'skipped' })}>跳過</button>
    </div>
  );
}

// 下次會多出的題型：做完這次後，正確率最低、而且作答至少 3 題的題型
function nextFocusText(history, m) {
  const w = tagWeights(tagStats([...history.filter((h) => h.date !== m.date), m], m.kind));
  const weak = Object.entries(w).filter(([, v]) => v > 1).map(([k]) => TAG_LABEL[k] || k);
  return weak.length ? `下一次 ${KINDS[m.kind].short} 會多出「${weak.slice(0, 2).join('」「')}」` : '';
}

function MissionRunner({ m, update, mark, history, onClose }) {
  const [local, setLocal] = useState(m.answers || {});
  const cur = { ...m, answers: local };
  const answer = (key, v) => {
    const next = { ...local, [key]: v };
    setLocal(next);
    update(m.date, { answers: next, status: m.status === 'done' ? 'done' : 'in_progress' });
  };
  const finish = () => {
    const g = grade(m, local);
    const minutes = Math.max(1, Math.round((Date.now() - (m.startedAtMs || Date.now())) / 60000));
    const result = { correct: g.correct, total: g.total, byTag: g.byTag, minutes: Math.min(minutes, 120) };
    update(m.date, { answers: local, status: 'done', completedAtMs: Date.now(), result, wrong: g.wrong });
    mark(taipeiToday(), result.minutes, `每日任務：${KINDS[m.kind].short} ${g.correct}/${g.total}`);
  };
  const postpone = () => {
    update(m.date, { postponedTo: postponeTo(taipeiToday()) });
    onClose();
  };
  const skip = () => {
    update(m.date, { status: 'skipped' });
    onClose();
  };

  return (
    <div className="mission">
      <div className="row between">
        <button className="btn small" onClick={onClose}>← 回任務</button>
        <span className="small strong">{shortLabel(m.date)} {KINDS[m.kind].label}</span>
      </div>
      {m.status === 'done' ? (
        <ListenResult mission={cur} nextFocus={nextFocusText(history, cur)} />
      ) : (
        <VoiceGate onPostpone={postpone} onSkip={skip}>
          {m.kind === 'part2' && <Part2Runner mission={cur} onAnswer={answer} onFinish={finish} />}
          {m.kind === 'part34' && <Part34Runner mission={cur} onAnswer={answer} onFinish={finish} />}
        </VoiceGate>
      )}
    </div>
  );
}

// ---- 我的進度：只用做完的紀錄算，沒有資料就說沒有 ----
function Progress({ history, t }) {
  const wk = weekSummary(history, weekStart(t));
  const rows = ['part2', 'part34'].map((k) => {
    const st = tagStats(history, k);
    const tags = Object.entries(st).filter(([, v]) => v.t > 0).sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t);
    return { k, tags };
  });
  const done = history.filter((m) => m.status === 'done');
  return (
    <section className="section">
      <h2>My Progress</h2>
      <p className="small">這週完成 <b>{wk.done}</b> 個任務・約 <b>{wk.minutes}</b> 分鐘</p>
      {!done.length && <p className="muted small">還沒有做完的任務，做完第一份就會開始記錄。</p>}
      {rows.map(({ k, tags }) =>
        tags.length ? (
          <div key={k} className="mission-tags">
            <span className="small strong">{KINDS[k].short}</span>
            {tags.map(([tag, v]) => (
              <span key={tag} className={`chip ${v.t >= 3 && v.c / v.t < 0.6 ? 'weak' : ''}`}>{TAG_LABEL[tag] || tag} {Math.round((v.c / v.t) * 100)}%（{v.t} 題）</span>
            ))}
          </div>
        ) : null,
      )}
      {done.length > 0 && (
        <ul className="plain-list mission-history">
          {done.slice(0, 10).map((m) => (
            <li key={m.id} className="row between small">
              <span>{shortLabel(m.date)} {KINDS[m.kind]?.short}</span>
              <span>{m.result?.total ? `${m.result.correct}/${m.result.total}` : m.result?.answers ? `回答 ${m.result.answers} 次` : '完成'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- 每週課表：哪天做什麼、幾點；存在 settings/englishSchedule ----
export function ScheduleEditor() {
  const { api, englishSchedule } = useData();
  const schedule = getSchedule(englishSchedule);
  const set = (wd, patch) => {
    const next = { ...schedule[wd], ...patch };
    if (next.kind === 'rest') next.time = '';
    else if (!next.time) next.time = '21:30';
    api.set('settings/englishSchedule', { days: { [wd]: next }, updatedAt: Date.now() });
  };
  return (
    <div className="mission-schedule">
      {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
        <div key={wd} className="row gap mission-schedule-row">
          <span className="strong">星期{WEEKDAY_NAMES[wd]}</span>
          <select value={schedule[wd].kind} onChange={(e) => set(wd, { kind: e.target.value })} aria-label={`星期${WEEKDAY_NAMES[wd]}的任務`}>
            {SCHEDULE_KINDS.map((k) => <option key={k} value={k}>{KINDS[k].short}</option>)}
          </select>
          {schedule[wd].kind !== 'rest' ? (
            <select value={schedule[wd].time} onChange={(e) => set(wd, { time: e.target.value })} aria-label="時間">
              {REMINDER_TIMES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          ) : (
            <span className="muted small">不派作業</span>
          )}
        </div>
      ))}
      <p className="muted small">台灣時間。改了從明天開始算；今天已經準備好的題目不會換。</p>
    </div>
  );
}

export function ScheduleReminder({ schedule }) {
  const android = isAndroid();
  const links = googleScheduleLinks(schedule);
  return (
    <div className="mission-reminder">
      <p className="small">把課表放進手機行事曆，時間到會跳通知，點了直接打開今天的任務。</p>
      <div className="row gap wrap">
        <a className={`btn ${android ? '' : 'primary'}`} href={scheduleIcsPath(schedule)}>加到 iPhone 行事曆</a>
        {links.map((g) => (
          <a key={g.time} className={`btn ${android ? 'primary' : ''} small`} href={g.url} target="_blank" rel="noreferrer">
            Google 日曆 {g.time}
          </a>
        ))}
      </div>
      <p className="muted small">iPhone 點了選「加入所有」。Google 日曆一個時間一個連結，各按一次「儲存」。改課表後要先刪掉舊的提醒再加一次。沒加提醒也沒關係，首頁一樣看得到今天的任務。</p>
    </div>
  );
}
