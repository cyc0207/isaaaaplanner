import { useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today, shortLabel } from '../lib/date.js';
import { itemKey, newItem } from '../lib/english.js';
import { logError } from '../lib/errlog.js';
import { callCoach, coachReady } from '../lib/coachApi.js';
import { canListen, canSpeak, speak, startListening, stopSpeaking } from '../lib/speech.js';
import {
  TOPICS, ERROR_TYPES, answersSinceFeedback, countFillers, feedbackDue, feedbackPrompt, fixToCard, myTurns, nextQuestion, normFeedback,
  normReport, parsePasted, progressStats, recentContext, reportPrompt, sentenceToCard, speakingSec, FEEDBACK_EVERY,
} from '../lib/speak.js';
import { Sheet } from './ui.jsx';

// 讀最近 30 次練習（不放進全域訂閱，紀錄多了也不會拖慢整個網站）
function useSessions(uid) {
  const [list, setList] = useState(null);
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'speakSessions'), orderBy('startedAtMs', 'desc'), limit(30));
    return onSnapshot(
      q,
      (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        logError('讀取口說紀錄', e, { show: false });
        setList([]);
      },
    );
  }, [uid]);
  return list;
}

const pref = (k, d) => {
  try {
    const v = localStorage.getItem(`coach.${k}`);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const savePref = (k, v) => {
  try {
    localStorage.setItem(`coach.${k}`, JSON.stringify(v));
  } catch {
    // 無痕模式存不了也沒關係
  }
};

// startTopic：從別的地方（例如之後的每日任務）直接開一個指定主題的 Free Talk
export default function SpeakCoach({ startTopic } = {}) {
  const { uid } = useData();
  const sessions = useSessions(uid);
  const [view, setView] = useState(TOPICS[startTopic] ? 'talk' : 'home');
  const [topic, setTopic] = useState(() => (TOPICS[startTopic] ? startTopic : pref('topic', 'free')));
  const [resume, setResume] = useState(null);
  const [openId, setOpenId] = useState(null);

  const opened = sessions?.find((s) => s.id === openId);

  if (view === 'talk') {
    return (
      <FreeTalk
        topic={resume?.topic || topic}
        resume={resume}
        onDone={() => {
          setResume(null);
          setView('home');
        }}
      />
    );
  }

  return (
    <div className="coach">
      {view === 'home' && (
        <>
          <div className="coach-grid">
            <div className="card coach-entry on">
              <div className="coach-entry-head">
                <strong>Free Talk</strong>
                <span className="muted small">自由聊天</span>
              </div>
              <div className="seg four">
                {Object.entries(TOPICS).map(([k, t]) => (
                  <button
                    key={k}
                    className={topic === k ? 'on' : ''}
                    onClick={() => {
                      setTopic(k);
                      savePref('topic', k);
                    }}
                  >
                    {t.short}
                  </button>
                ))}
              </div>
              <button
                className="btn primary big"
                onClick={() => {
                  setResume(null);
                  setView('talk');
                }}
              >
                開始聊
              </button>
            </div>
            <button className="card coach-entry" onClick={() => setView('progress')}>
              <div className="coach-entry-head">
                <strong>My Progress</strong>
                <span className="muted small">學習紀錄</span>
              </div>
              <ProgressLine sessions={sessions} />
            </button>
            <div className="card coach-entry later">
              <div className="coach-entry-head">
                <strong>Interview Practice</strong>
                <span className="muted small">模擬面試</span>
              </div>
              <span className="chip">下一階段</span>
            </div>
            <div className="card coach-entry later">
              <div className="coach-entry-head">
                <strong>Listening Practice</strong>
                <span className="muted small">聽力練習</span>
              </div>
              <span className="chip">之後</span>
            </div>
          </div>
          <p className="muted small">
            每回答 4 次給一次回饋，隨時可以按「結束並看報告」。{canListen() ? '可以用說的，也可以打字。' : '這個瀏覽器不支援語音辨識，先用打字（iPhone 用 Safari、Android 用 Chrome 就可以說）。'}
          </p>
        </>
      )}

      {view === 'progress' && (
        <Progress
          sessions={sessions}
          onBack={() => setView('home')}
          onOpen={setOpenId}
          onResume={(s) => {
            setResume(s);
            setView('talk');
          }}
        />
      )}
      {opened && <SessionSheet s={opened} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ProgressLine({ sessions }) {
  if (!sessions) return <span className="muted small">載入中…</span>;
  const st = progressStats(sessions, today());
  return (
    <span className="small">
      這週 <b className="num">{st.weekCount}</b> 次・累積口說 <b className="num">{st.totalMinutes}</b> 分
    </span>
  );
}

// ---- Free Talk 對話 ----
function FreeTalk({ topic, resume, onDone }) {
  const { api, englishLog, englishItems } = useData();
  const [s, setS] = useState(null); // 這次練習的資料
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState(null);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState(() => pref('lang', 'en-US'));
  const [readAloud, setReadAloud] = useState(() => pref('read', true));
  const [slow, setSlow] = useState(() => pref('slow', false));
  const [retry, setRetry] = useState(null);
  const [report, setReport] = useState(null);
  const [saved, setSaved] = useState(() => new Set());
  // ai：伺服器有設定 AI 才接；沒有就由網站出題，回饋複製給 Claude 再貼回來
  const [ai, setAi] = useState(null);
  const [askFb, setAskFb] = useState(false);
  const [skippedAt, setSkippedAt] = useState(0); // 按「先繼續聊」時回答了幾次，再 4 次才提醒
  const listener = useRef(null);
  const voiceSec = useRef(0);
  const endRef = useRef(null);
  const sRef = useRef(null);
  sRef.current = s;

  const rate = slow ? 0.8 : 0.95;
  const say = (text) => readAloud && speak(text, rate);

  // 存到 Firestore（陣列整個覆蓋，一次練習一筆文件）。第一次回答後才建紀錄，只開頭沒講話不留紀錄
  const persist = (next) => {
    const { id, ...data } = next;
    if (id) api.set(`speakSessions/${id}`, data);
    else if (myTurns(next.turns).length) next = { ...next, id: api.add('speakSessions', data) };
    sRef.current = next;
    setS(next);
  };

  const fail = (e) => {
    setErr({ message: e.message || String(e), setup: !!e.setup });
    if (!e.setup) logError('AI 教練', e, { show: false });
  };

  // 開始：新的練習建一筆紀錄，AI 先問一題；從紀錄按「繼續」就接著聊
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const useAi = await coachReady();
      if (cancelled) return;
      setAi(useAi);
      if (resume) {
        setS(resume);
        return;
      }
      if (useAi) setBusy('AI 想一個問題…');
      try {
        const text = useAi ? (await callCoach({ mode: 'chat', topic })).reply : nextQuestion(topic, []);
        if (cancelled) return;
        const first = { role: 'ai', text: text || 'What have you been up to today?', at: Date.now(), help: '' };
        const base = {
          mode: 'free', topic, date: today(), startedAtMs: Date.now(), endedAtMs: 0, speakingSec: 0,
          turns: [first], summary: '', feedbacks: [], report: null, fillers: {}, pronunciation: 'not_assessed',
        };
        persist({ id: null, ...base });
        say(first.text);
      } catch (e) {
        if (!cancelled) fail(e);
      } finally {
        if (!cancelled) setBusy('');
      }
    })();
    return () => {
      cancelled = true;
      listener.current?.stop();
      stopSpeaking();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [s?.turns?.length, s?.feedbacks?.length, busy]);

  const toggleMic = () => {
    if (listening) {
      listener.current?.stop();
      return;
    }
    stopSpeaking();
    setErr(null);
    const before = draft ? `${draft} ` : '';
    setListening(true);
    listener.current = startListening({
      lang,
      onText: (t) => setDraft(before + t),
      onEnd: ({ text, sec, auto }) => {
        if (text) voiceSec.current += sec;
        setListening(false);
        if (auto && !text) setErr({ message: '麥克風沒有收到聲音就停了。可以再按一次試試，或直接打字。' });
      },
      onError: (m) => {
        setListening(false);
        setErr({ message: m });
      },
    });
  };

  const getFeedback = async (cur) => {
    const answers = answersSinceFeedback(cur.turns, cur.feedbacks).map((t) => t.text);
    if (!answers.length) return;
    setBusy('整理回饋中…');
    try {
      const data = normFeedback(await callCoach({ mode: 'feedback', topic, summary: cur.summary, answers }));
      const latest = sRef.current;
      persist({ ...latest, feedbacks: [...latest.feedbacks, { ...data, afterTurn: cur.turns.length - 1, at: Date.now() }] });
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !s || busy) return;
    listener.current?.stop();
    const source = voiceSec.current > 0 ? 'voice' : 'text';
    const mine = { role: 'me', text, source, sec: voiceSec.current, at: Date.now(), retry: retry?.pattern || '' };
    voiceSec.current = 0;
    setDraft('');
    setRetry(null);
    setErr(null);
    const context = recentContext(s.turns);
    let cur = { ...s, turns: [...s.turns, mine] };
    cur.speakingSec = speakingSec(cur.turns);
    persist(cur);
    if (!ai) {
      // 不接 AI：網站接著問（追問或換題），每 4 次回答提醒複製給 Claude 看回饋
      const q = { role: 'ai', text: nextQuestion(topic, cur.turns), help: '', at: Date.now() };
      persist({ ...sRef.current, turns: [...sRef.current.turns, q] });
      say(q.text);
      return;
    }
    setBusy('AI 在聽…');
    try {
      const data = await callCoach({ mode: 'chat', topic, summary: s.summary, context, answer: text });
      const ai = { role: 'ai', text: data.reply || '', help: data.help || '', check: !!data.needs_clarification, at: Date.now() };
      cur = { ...sRef.current, turns: [...sRef.current.turns, ai], summary: data.summary || sRef.current.summary };
      persist(cur);
      say(ai.text);
    } catch (e) {
      fail(e);
      setBusy('');
      return;
    }
    setBusy('');
    if (feedbackDue(cur.turns, cur.feedbacks)) getFeedback(cur);
  };

  const finish = async () => {
    listener.current?.stop();
    stopSpeaking();
    const cur = sRef.current;
    const answers = myTurns(cur?.turns).map((t) => t.text);
    if (!cur || !answers.length) {
      onDone();
      return;
    }
    const fillers = countFillers(answers);
    const ended = { ...cur, endedAtMs: Date.now(), fillers, speakingSec: speakingSec(cur.turns) };
    persist(ended);
    setAskFb(false);
    // 首頁的英文打勾
    const t = today();
    const minutes = Math.max(1, Math.round((ended.endedAtMs - ended.startedAtMs) / 60000));
    if (!englishLog[t]) api.set(`englishLog/${t}`, { minutes, note: `口說 Free Talk ${answers.length} 次回答` });
    if (!ai) {
      setReport(true);
      return;
    }
    setBusy('產生報告中…');
    try {
      const data = normReport(await callCoach({ mode: 'report', topic, summary: cur.summary, answers, fillers }));
      persist({ ...sRef.current, report: { ...data, at: Date.now() } });
      setReport(true);
    } catch (e) {
      fail(e);
      setReport(true);
    } finally {
      setBusy('');
    }
  };

  // 卡片庫已經有同一句就不再加
  const have = new Set(englishItems.map((it) => itemKey(it.type, it.front)));
  const isSaved = (card) => saved.has(itemKey(card.type, card.front)) || have.has(itemKey(card.type, card.front));
  const save = (card) => {
    if (isSaved(card)) return;
    api.add('englishItems', newItem(card, today()));
    setSaved(new Set([...saved, itemKey(card.type, card.front)]));
  };

  if (report && s) {
    return (
      <div className="coach">
        <ReportView s={s} save={save} isSaved={isSaved} onReport={(r) => persist({ ...sRef.current, report: { ...r, at: Date.now() } })} />
        {err && <ErrorBox err={err} />}
        <button className="btn primary big" onClick={onDone}>
          完成
        </button>
      </div>
    );
  }

  const answers = myTurns(s?.turns).length;
  // 不接 AI 時，該看回饋就先停下來貼回饋（輸入框收起來，按「先繼續聊」才回來）
  const pasting = ai === false && !!s && (askFb || (feedbackDue(s.turns, s.feedbacks) && answers >= skippedAt + FEEDBACK_EVERY));
  let fbIndex = 0;
  return (
    <div className="coach talk">
      <div className="talk-head row gap">
        <span className="chip">{TOPICS[topic].label}</span>
        <span className="muted small">回答 {answers} 次・每 4 次給一次回饋</span>
      </div>

      <ol className="talk-list">
        {(s?.turns || []).map((t, i) => {
          const fbs = (s.feedbacks || []).filter((f) => f.afterTurn === i);
          return (
            <li key={i} className="talk-item">
              <Bubble t={t} rate={rate} />
              {fbs.map((f) => (
                <FeedbackCard key={fbIndex++} f={f} save={save} isSaved={isSaved} onRetry={(r) => setRetry(r)} rate={rate} />
              ))}
            </li>
          );
        })}
      </ol>
      {busy && <p className="muted talk-busy">{busy}</p>}
      {err && <ErrorBox err={err} />}
      {pasting && (
        <PasteBox
          title={`回答 ${answersSinceFeedback(s.turns, s.feedbacks).length} 次了，拿去給 Claude 看回饋`}
          prompt={feedbackPrompt(topic, answersSinceFeedback(s.turns, s.feedbacks).map((t) => t.text))}
          kind="feedback"
          onSave={(f) => {
            const latest = sRef.current;
            persist({ ...latest, feedbacks: [...latest.feedbacks, { ...f, afterTurn: latest.turns.length - 1, at: Date.now() }] });
            setAskFb(false);
          }}
          onLater={() => {
            setAskFb(false);
            setSkippedAt(myTurns(s.turns).length);
          }}
        >
          <button className="link small" onClick={finish}>
            不聊了，結束並看報告
          </button>
        </PasteBox>
      )}
      <div ref={endRef} />

      {!pasting && (
      <div className="composer card">
        {retry && (
          <div className="retry-banner">
            <span className="small">再說一次：</span>
            <b>{retry.pattern}</b>
            <div className="small muted">{retry.prompt}</div>
            <button className="link small" onClick={() => setRetry(null)}>
              取消
            </button>
          </div>
        )}
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={canListen() ? '按下面的麥克風說，或直接打字。說完可以先改再送出。' : '打字回答（中英混著也可以）'}
          disabled={!s}
        />
        <div className="row gap composer-actions">
          {canListen() && (
            <button className={`btn mic ${listening ? 'on' : ''}`} onClick={toggleMic} disabled={!s || (!!busy && !listening)}>
              {listening ? '說完了' : '點一下開始說'}
            </button>
          )}
          <button className="btn primary grow" onClick={send} disabled={!draft.trim() || !!busy || listening || !s}>
            送出
          </button>
        </div>
        <div className="row gap composer-actions">
          <button className="btn small" disabled={!!busy || !answersSinceFeedback(s?.turns, s?.feedbacks).length} onClick={() => (ai ? getFeedback(s) : setAskFb(true))}>
            看回饋
          </button>
          <button className="btn small" disabled={busy === '產生報告中…'} onClick={finish}>
            結束並看報告
          </button>
        </div>
        <div className="row gap wrap composer-opts small">
          {canListen() && (
            <label>
              辨識
              <select
                style={{ width: 'auto' }}
                value={lang}
                onChange={(e) => {
                  setLang(e.target.value);
                  savePref('lang', e.target.value);
                }}
              >
                <option value="en-US">英文</option>
                <option value="zh-TW">中英混（以中文辨識）</option>
              </select>
            </label>
          )}
          {canSpeak() && (
            <>
              <label className="opt">
                <input
                  type="checkbox"
                  checked={readAloud}
                  onChange={(e) => {
                    setReadAloud(e.target.checked);
                    savePref('read', e.target.checked);
                  }}
                />
                唸出 AI 的話
              </label>
              <label className="opt">
                <input
                  type="checkbox"
                  checked={slow}
                  onChange={(e) => {
                    setSlow(e.target.checked);
                    savePref('slow', e.target.checked);
                  }}
                />
                慢一點
              </label>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function Bubble({ t, rate }) {
  if (t.role === 'ai') {
    return (
      <div className="bubble ai">
        <p>{t.text}</p>
        {t.help && <p className="bubble-help">{t.help}</p>}
        {canSpeak() && (
          <button className="link small" onClick={() => speak(t.text, rate)}>
            再唸一次
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="bubble me">
      <p>{t.text}</p>
      <span className="bubble-meta small">
        {t.source === 'voice' ? `語音轉文字・${t.sec || 0} 秒` : '打字'}
        {t.retry ? '・再說一次' : ''}
      </span>
    </div>
  );
}

function SaveBtn({ card, save, isSaved }) {
  if (!save) return null;
  const done = isSaved(card);
  return (
    <button className="btn small" disabled={done} onClick={() => save(card)}>
      {done ? '已收藏' : '收藏'}
    </button>
  );
}

function FeedbackCard({ f, save, isSaved, onRetry, rate, title = '回饋' }) {
  if (f.raw && !f.parsed && !f.understood) {
    return (
      <div className="card feedback">
        <h3>{title}</h3>
        <p className="pasted">{f.raw}</p>
      </div>
    );
  }
  return (
    <div className="card feedback">
      <h3>{title}</h3>
      <div className="fb-part">
        <div className="fb-label">1. 我聽懂了什麼</div>
        <p>{f.understood}</p>
      </div>
      {f.fixes?.length > 0 && (
        <div className="fb-part">
          <div className="fb-label">2. 這次最值得修正的</div>
          <ul className="fix-list">
            {f.fixes.map((x, i) => (
              <li key={i}>
                <div className="fix-orig">{x.original}</div>
                <div className="fix-new">{x.corrected}</div>
                <div className="small muted">{x.why}</div>
                <div className="row between">
                  <span className="chip">{ERROR_TYPES[x.type] || '其他'}</span>
                  <SaveBtn card={fixToCard(x)} save={save} isSaved={isSaved} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {f.natural && (
        <div className="fb-part">
          <div className="fb-label">3. 自然口說版本</div>
          <p className="natural">{f.natural}</p>
          <div className="row gap">
            {canSpeak() && (
              <button className="btn small" onClick={() => speak(f.natural, rate)}>
                唸給我聽
              </button>
            )}
            <SaveBtn card={sentenceToCard(f.natural, '自然口說版本')} save={save} isSaved={isSaved} />
          </div>
        </div>
      )}
      {f.retry?.pattern && (
        <div className="fb-part">
          <div className="fb-label">4. 再說一次</div>
          <p>
            <b>{f.retry.pattern}</b>
          </p>
          <p className="small muted">{f.retry.prompt}</p>
          <div className="row gap">
            {onRetry && (
              <button className="btn small primary" onClick={() => onRetry(f.retry)}>
                用這個句型再說一次
              </button>
            )}
            <SaveBtn card={sentenceToCard(f.retry.pattern, '實用句型')} save={save} isSaved={isSaved} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReportView({ s, save, isSaved, onReport }) {
  const r = s.report;
  const fillers = Object.entries(s.fillers || {});
  const answers = myTurns(s.turns);
  const voice = answers.filter((t) => t.source === 'voice').length;
  return (
    <div className="report">
      <section className="section">
        <h2>這次的報告</h2>
        <div className="card">
          <div className="report-stats">
            <div>
              <span className="num big">{answers.length}</span>
              <span className="small muted">次回答</span>
            </div>
            <div>
              <span className="num big">{Math.round((s.speakingSec || 0) / 60)}</span>
              <span className="small muted">分鐘口說</span>
            </div>
            <div>
              <span className="num big">{voice}</span>
              <span className="small muted">次用說的</span>
            </div>
          </div>
          <p className="small">
            <b>發音：尚未評估。</b>
            <span className="muted">目前只有語音轉成的文字，沒有分析錄音，所以不評發音、語調、停頓和語速。</span>
          </p>
          {fillers.length > 0 && (
            <p className="small">
              常用填充詞：
              {fillers.map(([w, n]) => (
                <span key={w} className="chip">
                  {w} ×{n}
                </span>
              ))}
            </p>
          )}
        </div>
      </section>
      {!r && onReport && (
        <PasteBox
          title="拿去給 Claude 寫報告"
          prompt={reportPrompt(s.topic, answers.map((t) => t.text), s.fillers)}
          kind="report"
          onSave={onReport}
        />
      )}
      {!r && !onReport && <p className="muted">這次沒有報告。</p>}
      {r?.strengths?.length > 0 && (
        <section className="section">
          <h2>這次說得清楚的</h2>
          <ul className="plain-list">
            {r.strengths.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      {r && <FeedbackCard f={r} save={save} isSaved={isSaved} title="重點回饋" />}
      {r?.nextFocus?.length > 0 && (
        <section className="section">
          <h2>下次最值得練的</h2>
          <ul className="plain-list">
            {r.nextFocus.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ErrorBox({ err }) {
  return (
    <div className={`card coach-error ${err.setup ? 'setup' : ''}`} role="alert">
      <p>{err.message}</p>
      {err.setup && (
        <ol className="small">
          <li>到 console.anthropic.com 建立 API Key</li>
          <li>Vercel → 專案 → Settings → Environment Variables 加 ANTHROPIC_API_KEY 和 COACH_ALLOWED_EMAILS（你的 Google 信箱）</li>
          <li>Deployments → 最新一筆 → Redeploy</li>
        </ol>
      )}
    </div>
  );
}

// ---- My Progress：統計、歷史、刪除 ----
function Progress({ sessions, onBack, onOpen, onResume }) {
  const { uid } = useData();
  const [deleting, setDeleting] = useState(false);
  if (!sessions) return <p className="muted">載入中…</p>;
  const st = progressStats(sessions, today());

  const deleteAll = async () => {
    if (!window.confirm('刪除所有口說練習紀錄（對話、回饋、報告）？已收藏到卡片庫的句子會留著。刪了不能復原。')) return;
    setDeleting(true);
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'speakSessions'));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
    } catch (e) {
      logError('刪除口說紀錄', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <button className="link" onClick={onBack}>
        ← 回口說
      </button>
      <section className="section">
        <h2>學習紀錄</h2>
        <div className="card report-stats">
          <div>
            <span className="num big">{st.weekCount}</span>
            <span className="small muted">這週練習</span>
          </div>
          <div>
            <span className="num big">{st.weekMinutes}</span>
            <span className="small muted">這週口說分鐘</span>
          </div>
          <div>
            <span className="num big">{st.totalMinutes}</span>
            <span className="small muted">累積口說分鐘</span>
          </div>
        </div>
        {st.recentTopics.length > 0 && <p className="small muted">最近練的主題：{st.recentTopics.map((k) => TOPICS[k]?.label || k).join('、')}</p>}
        <p className="small muted">口說分鐘只算用麥克風說的時間。常犯錯誤統計、句型庫、面試和聽力進度在下一階段加上。</p>
      </section>
      <section className="section">
        <h2>練習紀錄</h2>
        {!sessions.length && <p className="muted">還沒有練習。</p>}
        <ul className="list">
          {sessions.map((s) => (
            <li key={s.id} className="task" onClick={() => onOpen(s.id)}>
              <div className="task-body">
                <div className="task-title">
                  {shortLabel(s.date)}・{TOPICS[s.topic]?.label || s.topic}
                </div>
                <div className="task-meta">
                  <span>回答 {myTurns(s.turns).length} 次</span>
                  {s.speakingSec > 0 && <span>口說 {Math.max(1, Math.round(s.speakingSec / 60))} 分</span>}
                  {!s.endedAtMs && <span className="chip warn">沒按結束</span>}
                  {s.report && <span className="chip ok">有報告</span>}
                </div>
              </div>
              {!s.endedAtMs && (
                <button
                  className="btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume(s);
                  }}
                >
                  繼續
                </button>
              )}
            </li>
          ))}
        </ul>
        {sessions.length > 0 && (
          <button className="btn danger" onClick={deleteAll} disabled={deleting}>
            {deleting ? '刪除中…' : '刪除全部口說紀錄'}
          </button>
        )}
      </section>
    </div>
  );
}

function SessionSheet({ s, onClose }) {
  const { api } = useData();
  return (
    <Sheet title={`${shortLabel(s.date)} ${TOPICS[s.topic]?.label || ''}`} onClose={onClose}>
      <ReportView s={s} save={null} onReport={s.report ? null : (r) => api.set(`speakSessions/${s.id}`, { report: { ...r, at: Date.now() } })} />
      <h3>對話</h3>
      <ol className="talk-list">
        {(s.turns || []).map((t, i) => (
          <li key={i} className="talk-item">
            <Bubble t={t} rate={0.95} />
            {(s.feedbacks || [])
              .filter((f) => f.afterTurn === i)
              .map((f, j) => (
                <FeedbackCard key={j} f={f} rate={0.95} />
              ))}
          </li>
        ))}
      </ol>
      <button
        className="btn danger"
        onClick={() => {
          if (window.confirm('刪除這次練習的紀錄？')) {
            api.remove(`speakSessions/${s.id}`);
            onClose();
          }
        }}
      >
        刪除這次紀錄
      </button>
    </Sheet>
  );
}

// 不接 AI 時：複製指令＋逐字稿給 Claude，再把回覆貼回來存
function PasteBox({ title, prompt, kind, onSave, onLater, children }) {
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      window.prompt('複製下面這段，貼給 Claude', prompt);
    }
  };
  const submit = () => {
    const r = parsePasted(text, kind);
    if (!r.parsed && !r.raw.trim()) return;
    onSave(r);
    setText('');
  };
  return (
    <div className="card paste-box">
      <h3>{title}</h3>
      <ol className="small paste-steps">
        <li>按「複製」，貼到 Claude App 或網頁送出</li>
        <li>把 Claude 的整段回覆複製，貼在下面按「存起來」</li>
      </ol>
      <div className="row gap">
        <button className="btn small primary" onClick={copy}>
          {copied ? '已複製' : '複製指令和逐字稿'}
        </button>
        <a className="btn small" href="https://claude.ai/new" target="_blank" rel="noreferrer">
          打開 Claude
        </a>
        {onLater && (
          <button className="link small" onClick={onLater}>
            先繼續聊
          </button>
        )}
      </div>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="把 Claude 的回覆貼在這裡" />
      <button className="btn small" onClick={submit} disabled={!text.trim()}>
        存起來
      </button>
      {children}
      <p className="small muted">Claude 回覆最後有一段 json，網站就能整理出修正句讓你收藏；沒有的話會存原文。</p>
    </div>
  );
}
