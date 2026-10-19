import { useEffect, useRef, useState } from 'react';
import { useData } from '../data.jsx';
import { today } from '../lib/date.js';
import { newItem, itemKey } from '../lib/english.js';
import { questionList, answeredAll, TAG_LABEL } from '../lib/mission.js';
import { voiceSupport, playLines, stopAudio, part2Lines } from '../lib/tts.js';

const LETTERS = 'ABCD';
export const LISTEN_TAG = 'TOEIC聽力';

function usePlayer() {
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  useEffect(() => () => stopAudio(), []);
  const play = async (lines, rate) => {
    setPlaying(true);
    await playLines(lines, { rate, onLine: setLine });
    setPlaying(false);
    setLine(-1);
  };
  const stop = () => {
    stopAudio();
    setPlaying(false);
    setLine(-1);
  };
  return { playing, line, play, stop };
}

function Elapsed({ since }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return <span className="num">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

// 先確認裝置能念英文；不能就不讓作答（不用文字假裝聽力）
export function VoiceGate({ children, onPostpone, onSkip }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    voiceSupport().then(setState);
  }, []);
  if (!state) return <p className="muted">檢查這台裝置的英文語音…</p>;
  if (!state.ok) {
    return (
      <div className="card mission-blocked">
        <strong>這台裝置沒辦法播放今天的聽力</strong>
        <p className="small">{state.reason}</p>
        <p className="muted small">聽力題一定要聽得到才算數，所以不會改成看文字作答。任務會留著，換裝置後再做就好。</p>
        <div className="row gap wrap">
          {onPostpone && <button className="btn" onClick={onPostpone}>明天再做</button>}
          {onSkip && <button className="btn" onClick={onSkip}>這次跳過</button>}
        </div>
      </div>
    );
  }
  return children;
}

// ---- Part 2：一題一題聽，畫面不顯示題目和選項 ----
export function Part2Runner({ mission, onAnswer, onFinish }) {
  const items = mission.items;
  const answers = mission.answers || {};
  const firstOpen = items.findIndex((x) => answers[x.id] === undefined);
  const [i, setI] = useState(firstOpen < 0 ? items.length - 1 : firstOpen);
  const [slow, setSlow] = useState(false);
  const p = usePlayer();
  const item = items[i];
  const rate = slow ? 0.8 : 0.95;
  const started = useRef(mission.startedAtMs || Date.now());

  const choose = (k) => {
    onAnswer(item.id, k);
    if (i < items.length - 1) {
      const next = items[i + 1];
      setI(i + 1);
      // 在按鈕的點擊裡直接播下一題，iPhone 才允許出聲
      p.play(part2Lines(next), rate);
    } else p.stop();
  };

  const all = answeredAll(mission, answers);
  return (
    <div className="listen">
      <div className="row between">
        <span className="strong">第 {i + 1}／{items.length} 題</span>
        <span className="muted small">用時 <Elapsed since={started.current} /></span>
      </div>
      <p className="muted small">聽一句話和三個回應，選最適合的回應。題目不會顯示，做完才看得到。</p>
      <div className="listen-play">
        <button className="btn primary big" onClick={() => (p.playing ? p.stop() : p.play(part2Lines(item), rate))}>
          {p.playing ? '停止' : answers[item.id] === undefined ? '播放這題' : '再聽一次'}
        </button>
        <label className="inline small">
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> 放慢
        </label>
      </div>
      <div className="listen-choices three">
        {[0, 1, 2].map((k) => (
          <button key={k} className={`btn big ${answers[item.id] === k ? 'on' : ''}`} onClick={() => choose(k)}>
            {LETTERS[k]}
          </button>
        ))}
      </div>
      <div className="row between">
        <button className="btn small" disabled={i === 0} onClick={() => { p.stop(); setI(i - 1); }}>上一題</button>
        <span className="deck-dots">
          {items.map((x, k) => (
            <i key={x.id} className={k === i ? 'on' : answers[x.id] !== undefined ? 'seen' : ''} />
          ))}
        </span>
        <button className="btn small" disabled={i === items.length - 1} onClick={() => { p.stop(); setI(i + 1); }}>下一題</button>
      </div>
      <button className="btn primary" disabled={!all} onClick={() => { p.stop(); onFinish(); }}>
        {all ? '交卷，看答案和解析' : `還有 ${items.filter((x) => answers[x.id] === undefined).length} 題沒選`}
      </button>
    </div>
  );
}

// ---- Part 3／4：一組一組聽，題目和選項照多益一樣印出來 ----
export function Part34Runner({ mission, onAnswer, onFinish }) {
  const sets = mission.items;
  const answers = mission.answers || {};
  const firstOpen = sets.findIndex((s) => s.questions.some((_, k) => answers[`${s.id}#${k}`] === undefined));
  const [i, setI] = useState(firstOpen < 0 ? sets.length - 1 : firstOpen);
  const [slow, setSlow] = useState(false);
  const p = usePlayer();
  const set = sets[i];
  const rate = slow ? 0.8 : 0.95;
  const started = useRef(mission.startedAtMs || Date.now());
  const all = answeredAll(mission, answers);

  return (
    <div className="listen">
      <div className="row between">
        <span className="strong">第 {i + 1}／{sets.length} 組・{set.type === 'talk' ? '獨白（Part 4）' : '對話（Part 3）'}</span>
        <span className="muted small">用時 <Elapsed since={started.current} /></span>
      </div>
      <p className="muted small">先看題目，再按播放。逐字稿做完才會出現。</p>
      <div className="listen-play">
        <button className="btn primary big" onClick={() => (p.playing ? p.stop() : p.play(set.lines, rate))}>
          {p.playing ? '停止' : '播放這一組'}
        </button>
        <label className="inline small">
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> 放慢
        </label>
      </div>
      {set.questions.map((q, k) => {
        const key = `${set.id}#${k}`;
        return (
          <div key={key} className="card listen-q">
            <p className="strong">{k + 1}. {q.q}</p>
            <div className="listen-options">
              {q.options.map((o, j) => (
                <button key={j} className={`btn opt ${answers[key] === j ? 'on' : ''}`} onClick={() => onAnswer(key, j)}>
                  <b>{LETTERS[j]}</b> {o}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="row between">
        <button className="btn small" disabled={i === 0} onClick={() => { p.stop(); setI(i - 1); }}>上一組</button>
        <button className="btn small" disabled={i === sets.length - 1} onClick={() => { p.stop(); setI(i + 1); }}>下一組</button>
      </div>
      <button className="btn primary" disabled={!all} onClick={() => { p.stop(); onFinish(); }}>
        {all ? '交卷，看答案和逐字稿' : '每一題都選了才能交卷'}
      </button>
    </div>
  );
}

// ---- 做完：答案、逐字稿、解析、重聽、跟讀、存片語 ----
export function ListenResult({ mission, nextFocus }) {
  const { api, englishItems } = useData();
  const p = usePlayer();
  const [slow, setSlow] = useState(false);
  const rate = slow ? 0.8 : 0.95;
  const answers = mission.answers || {};
  const r = mission.result;
  const have = new Set(englishItems.map((it) => itemKey(it.type, it.front)));
  const save = (ph) => {
    if (have.has(itemKey('phrase', ph.en))) return;
    api.add('englishItems', newItem({ type: 'phrase', front: ph.en, back: ph.zh, tags: [LISTEN_TAG], source: 'mission', note: `每日任務 ${mission.date}` }, today()));
  };
  const tags = Object.entries(r?.byTag || {}).sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t);

  return (
    <div className="listen-result">
      {r && (
        <div className="card mission-score">
          <div className="row between">
            <strong>答對 <span className="num big">{r.correct}</span>／{r.total}</strong>
            <span className="muted small">{r.minutes ? `${r.minutes} 分鐘` : ''}</span>
          </div>
          <p className="muted small">非官方練習，只看正確率，不換算多益分數。</p>
          <div className="mission-tags">
            {tags.map(([tag, v]) => (
              <span key={tag} className={`chip ${v.c / v.t < 0.6 ? 'weak' : ''}`}>{TAG_LABEL[tag] || tag} {v.c}/{v.t}</span>
            ))}
          </div>
          {nextFocus && <p className="small">下次會加強：<b>{nextFocus}</b></p>}
        </div>
      )}
      <label className="inline small">
        <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> 重聽時放慢
      </label>

      {mission.kind === 'part2' &&
        mission.items.map((x, k) => {
          const ok = answers[x.id] === x.answer;
          return (
            <div key={x.id} className={`card listen-review ${ok ? 'ok' : 'wrong'}`}>
              <div className="row between">
                <span className="strong">{k + 1}. {ok ? '答對' : `選 ${LETTERS[answers[x.id]] ?? '—'}，答案 ${LETTERS[x.answer]}`}</span>
                <span className="chip">{TAG_LABEL[x.tag]}</span>
              </div>
              <p className="listen-script">{x.q}</p>
              <ol className="listen-opts" type="A">
                {x.options.map((o, j) => (
                  <li key={j} className={j === x.answer ? 'right' : j === answers[x.id] ? 'mine' : ''}>{o}</li>
                ))}
              </ol>
              <p className="small">{x.explain}</p>
              <Phrases list={x.phrases} have={have} save={save} />
              <button className="btn small" onClick={() => p.play(part2Lines(x), rate)}>再聽一次</button>
            </div>
          );
        })}

      {mission.kind === 'part34' &&
        mission.items.map((set, k) => (
          <div key={set.id} className="card listen-review">
            <div className="row between">
              <span className="strong">第 {k + 1} 組：{set.title}</span>
              <button className="btn small" onClick={() => (p.playing ? p.stop() : p.play(set.lines, rate))}>{p.playing ? '停止' : '整段重聽'}</button>
            </div>
            <div className="listen-lines">
              {set.lines.map((l, j) => (
                <button key={j} className={`listen-line ${p.line === j ? 'now' : ''}`} onClick={() => p.play([l], slow ? 0.8 : 0.9)} title="跟讀：點一句播一句">
                  {l.sp !== 'narrator' && <b>{l.sp.replace('2', '')}：</b>}
                  {l.text}
                </button>
              ))}
            </div>
            <p className="muted small">跟讀：點任一句只播那一句，跟著念一次。</p>
            {set.questions.map((q, j) => {
              const key = `${set.id}#${j}`;
              const ok = answers[key] === q.answer;
              return (
                <div key={key} className={`listen-review-q ${ok ? 'ok' : 'wrong'}`}>
                  <p className="strong">{j + 1}. {q.q} {ok ? '・答對' : `・選 ${LETTERS[answers[key]] ?? '—'}，答案 ${LETTERS[q.answer]}`}</p>
                  <p className="small">{q.explain}</p>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}

function Phrases({ list, have, save }) {
  if (!list?.length) return null;
  return (
    <div className="mission-phrases">
      {list.map((ph) => (
        <span key={ph.en} className="row gap">
          <span><b>{ph.en}</b> {ph.zh}</span>
          <button className="btn small" disabled={have.has(itemKey('phrase', ph.en))} onClick={() => save(ph)}>
            {have.has(itemKey('phrase', ph.en)) ? '已存' : '存成卡片'}
          </button>
        </span>
      ))}
    </div>
  );
}

export const questionCount = (mission) => questionList(mission).length;
