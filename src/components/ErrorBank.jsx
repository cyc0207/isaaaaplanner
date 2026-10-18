import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useData } from '../data.jsx';
import { today, shortLabel } from '../lib/date.js';
import { reviewGrade } from '../lib/english.js';
import { logError } from '../lib/errlog.js';
import { canListen, startListening } from '../lib/speech.js';
import {
  BANK_PROMPT, ERROR_CATEGORIES, EVIDENCE, PHRASE_TAGS, ROW_STATUS, STATUS, bankErrors, bankImportOps, bankPhrases, bankStats, bankStatus,
  buildBankPreview, counts, parseImportText, pickRetry, sessionDocId, validateImport,
} from '../lib/errorBank.js';
import { SAMPLE_IMPORT, SEED_IMPORT } from '../data/errorBankSeed.js';
import { Sheet } from './ui.jsx';

// 匯入過的練習紀錄（原始逐字稿）：只在錯誤庫打開時讀
function useImports(uid) {
  const [list, setList] = useState(null);
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'speakImports'), orderBy('importedAtMs', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        logError('讀取口說匯入紀錄', e, { show: false });
        setList([]);
      },
    );
  }, [uid]);
  return list;
}

const VIEWS = [
  ['errors', '錯誤'],
  ['phrases', '片語'],
  ['stats', '分析'],
  ['sessions', '紀錄'],
  ['import', '匯入'],
];

const countOf = (it) => (it.occurrences || []).filter(counts).length;

// 我的英文錯誤庫：放在 英文 › 口說 裡面，不另開頂層頁
export default function ErrorBank({ onBack, startView = 'errors' }) {
  const { uid, englishItems } = useData();
  const imports = useImports(uid);
  const [view, setView] = useState(VIEWS.some(([k]) => k === startView) ? startView : 'errors');
  const [retry, setRetry] = useState(null);
  const errors = bankErrors(englishItems);

  if (retry) return <Retry pool={retry} onDone={() => setRetry(null)} />;

  return (
    <div className="bank">
      <button className="link" onClick={onBack}>
        ← 回口說
      </button>
      <h2 className="bank-title">我的英文錯誤庫</h2>
      <div className="seg five">
        {VIEWS.map(([k, l]) => (
          <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>
            {l}
          </button>
        ))}
      </div>
      {!errors.length && !bankPhrases(englishItems).length && view !== 'import' && (
        <div className="card bank-empty">
          <p className="strong">錯誤庫還是空的。</p>
          <p className="small muted">先到「匯入」貼上 ChatGPT 的批改 JSON，或載入你列好的初始清單。</p>
          <button className="btn primary small" onClick={() => setView('import')}>
            去匯入
          </button>
        </div>
      )}
      {view === 'errors' && <ErrorList onRetry={(pool) => setRetry(pool)} />}
      {view === 'phrases' && <PhraseList />}
      {view === 'stats' && <Stats />}
      {view === 'sessions' && <Sessions imports={imports} onRetry={(pool) => setRetry(pool)} />}
      {view === 'import' && <ImportPanel onDone={() => setView('errors')} />}
    </div>
  );
}

function StatusChip({ it }) {
  const st = bankStatus(it.box || 0, it.reps || 0);
  return <span className={`chip ${st === 'mastered' ? 'ok' : st === 'new' ? 'warn' : ''}`}>{STATUS[st]}</span>;
}

// ---- 錯誤卡 ----
function ErrorList({ onRetry }) {
  const { englishItems } = useData();
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState(null);
  const all = bankErrors(englishItems);
  const shown = all
    .filter((it) => !cat || it.errorCategory === cat)
    .sort((a, b) => countOf(b) - countOf(a) || (b.lastSeenDate || '').localeCompare(a.lastSeenDate || ''));
  const byCat = all.reduce((c, it) => ({ ...c, [it.errorCategory]: (c[it.errorCategory] || 0) + 1 }), {});
  const t = today();
  if (!all.length) return null;
  return (
    <div>
      <div className="card bank-retry">
        <div>
          <strong>Speaking Retry</strong>
          <p className="small muted">挑 3～5 個錯誤，自己重新說一次，再和正確說法比較。</p>
        </div>
        <button className="btn primary" onClick={() => onRetry(pickRetry(englishItems, { n: 5, t }))}>
          開始
        </button>
      </div>
      <div className="type-chips">
        <button className={`chip-btn ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>
          全部 {all.length}
        </button>
        {Object.entries(ERROR_CATEGORIES).map(([k, l]) =>
          byCat[k] ? (
            <button key={k} className={`chip-btn ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>
              {l} {byCat[k]}
            </button>
          ) : null,
        )}
      </div>
      <ul className="list">
        {shown.map((it) => (
          <li key={it.id} className="task bank-row" onClick={() => setOpen(it.id)}>
            <div className="task-body">
              <div className="fix-orig">{it.originalText || it.front}</div>
              <div className="fix-new">{it.correctedText || it.back}</div>
              <div className="task-meta">
                <span className="chip">{ERROR_CATEGORIES[it.errorCategory] || '其他'}</span>
                <StatusChip it={it} />
                {countOf(it) >= 2 && <span className="chip warn">出現 {countOf(it)} 次</span>}
                {!countOf(it) && <span>未核對</span>}
                {(it.due || '') <= t && <span>今天要複習</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {open && <ErrorDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ErrorDetail({ id, onClose }) {
  const { englishItems, api } = useData();
  const it = englishItems.find((x) => x.id === id);
  if (!it) return null;
  const occ = it.occurrences || [];
  return (
    <Sheet title="錯誤卡" onClose={onClose}>
      <div className="bank-detail">
        <p className="fb-label">我的原句（verifiedOriginal）</p>
        <p className="fix-orig">{it.originalText}</p>
        <p className="fb-label">建議修正（suggestedCorrection）</p>
        <p className="fix-new">{it.correctedText}</p>
        {it.explanationZh && <p>{it.explanationZh}</p>}
        {it.pattern && <p className="small muted">句型：{it.pattern}</p>}
        {(it.examples || []).length > 0 && (
          <>
            <p className="fb-label">延伸例句</p>
            <ul className="plain-list">
              {it.examples.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
        {it.inferredExpression && (
          <>
            <p className="fb-label">延伸說法（inferredExpression，AI 推導，不是你說的）</p>
            <p className="bank-inferred">{it.inferredExpression}</p>
          </>
        )}
        <p className="fb-label">
          出現紀錄：算 {countOf(it)} 次{occ.length > countOf(it) ? `（另有 ${occ.length - countOf(it)} 筆未核對，不算）` : ''}
        </p>
        <ul className="plain-list small">
          {occ.map((o, i) => (
            <li key={i}>
              {shortLabel(o.date)}・{o.topic}
              {o.round ? ` Round ${o.round}` : ''}：「{o.text}」<span className="muted">（{EVIDENCE[o.evidence]}）</span>
            </li>
          ))}
        </ul>
        <div className="task-meta">
          <span className="chip">{ERROR_CATEGORIES[it.errorCategory] || '其他'}</span>
          <StatusChip it={it} />
          <span>下次複習 {it.due ? shortLabel(it.due) : '—'}</span>
          <span>練過 {it.reps || 0} 次</span>
        </div>
        {it.lastRetry && (
          <p className="small muted">
            上次重說（{shortLabel(it.lastRetry.date)}）：{it.lastRetry.text || '（沒有輸入）'}
          </p>
        )}
        <button
          className="btn danger small"
          onClick={() => {
            if (window.confirm('刪除這張錯誤卡？（複習紀錄會一起刪掉，原始逐字稿不受影響）')) {
              api.remove(`englishItems/${it.id}`);
              onClose();
            }
          }}
        >
          刪除
        </button>
      </div>
    </Sheet>
  );
}

// ---- 片語庫 Reusable Expressions ----
function PhraseList() {
  const { englishItems, api } = useData();
  const [tag, setTag] = useState('');
  const all = bankPhrases(englishItems);
  if (!all.length) return null;
  const tags = [...new Set([...PHRASE_TAGS, ...all.flatMap((it) => it.tags || [])])].filter((x) => all.some((it) => (it.tags || []).includes(x)));
  const shown = all.filter((it) => !tag || (it.tags || []).includes(tag)).sort((a, b) => a.front.localeCompare(b.front));
  const t = today();
  return (
    <div>
      <div className="type-chips">
        <button className={`chip-btn ${!tag ? 'on' : ''}`} onClick={() => setTag('')}>
          全部 {all.length}
        </button>
        {tags.map((x) => (
          <button key={x} className={`chip-btn ${tag === x ? 'on' : ''}`} onClick={() => setTag(x)}>
            {x}
          </button>
        ))}
      </div>
      <ul className="list">
        {shown.map((it) => (
          <li key={it.id} className="task bank-phrase">
            <div className="task-body">
              <div className="task-title">
                <span className="eng-front">{it.front}</span>
                {it.back && <span className="muted">・{it.back}</span>}
              </div>
              {it.usage && <div className="small">{it.usage}</div>}
              {it.example && <div className="small flash-example">{it.example}</div>}
              <div className="task-meta">
                {(it.tags || []).map((x) => (
                  <span key={x}>#{x}</span>
                ))}
                {it.kind === 'inferredExpression' && <span className="chip">AI 推導</span>}
                {it.srs !== false && <StatusChip it={it} />}
                <span>來源：{(it.sources || []).map((s) => shortLabel(s.date)).join('、')}</span>
              </div>
            </div>
            <label className="opt small bank-srs">
              <input
                type="checkbox"
                checked={it.srs !== false}
                onChange={(e) => api.update(`englishItems/${it.id}`, e.target.checked ? { srs: true, due: it.due && it.due > t ? it.due : t } : { srs: false })}
              />
              複習
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- 個人錯誤分析 ----
function Stats() {
  const { englishItems } = useData();
  const st = bankStats(englishItems, today());
  if (!st.total && !st.phrases) return null;
  const max = st.categories[0]?.[1] || 1;
  return (
    <div>
      <div className="card report-stats">
        <div>
          <span className="num big">{st.last7.length}</span>
          <span className="small muted">7 天內新增</span>
        </div>
        <div>
          <span className="num big">{st.last30.length}</span>
          <span className="small muted">30 天內新增</span>
        </div>
        <div>
          <span className="num big">{st.repeated.length}</span>
          <span className="small muted">反覆出現</span>
        </div>
        <div>
          <span className="num big">{st.due.length}</span>
          <span className="small muted">待複習</span>
        </div>
        <div>
          <span className="num big">{st.mastered.length}</span>
          <span className="small muted">已學會</span>
        </div>
        <div>
          <span className="num big">{st.total}</span>
          <span className="small muted">錯誤卡</span>
        </div>
      </div>
      <section className="section">
        <h2>最常犯的錯誤類型</h2>
        {!st.categories.length && <p className="muted small">還沒有核對過的錯誤。</p>}
        <ul className="bank-bars">
          {st.categories.map(([k, n]) => (
            <li key={k}>
              <span className="bank-bar-label">{ERROR_CATEGORIES[k]}</span>
              <span className="bank-bar">
                <span style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="num">{n}</span>
            </li>
          ))}
        </ul>
        <p className="small muted">
          次數只算有原始來源的紀錄（逐字稿裡找得到的原句，或你自己列的）。同一次練習同一句只算一次。
          {st.unverified ? ` 有 ${st.unverified} 張卡帶有未核對的原句，沒有算進去。` : ''}
        </p>
      </section>
      <section className="section">
        <h2>反覆出現的錯誤</h2>
        {!st.repeated.length && <p className="muted small">目前沒有出現 2 次以上的錯誤。</p>}
        <ul className="list">
          {st.repeated.map((it) => (
            <li key={it.id} className="task">
              <div className="task-body">
                <div className="fix-orig">{it.originalText}</div>
                <div className="fix-new">{it.correctedText}</div>
                <div className="task-meta">
                  <span className="chip warn">{countOf(it)} 次</span>
                  <span>{(it.occurrences || []).filter(counts).map((o) => o.date).sort().map(shortLabel).join('、')}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="small muted">週三的複習會先排這些。</p>
      </section>
      <section className="section">
        <h2>已學會</h2>
        {!st.mastered.length ? (
          <p className="muted small">複習到「14 天後再看」的卡片會算已學會。</p>
        ) : (
          <p className="small">{st.mastered.map((it) => it.correctedText || it.front).join('・')}</p>
        )}
      </section>
    </div>
  );
}

// ---- 練習紀錄（原始逐字稿）----
function Sessions({ imports, onRetry }) {
  const { englishItems } = useData();
  const [open, setOpen] = useState(null);
  if (!imports) return <p className="muted">載入中…</p>;
  if (!imports.length) return <p className="muted small">還沒有匯入的練習紀錄。</p>;
  const s = imports.find((x) => x.id === open);
  const cardsOf = (id) => bankErrors(englishItems).filter((it) => (it.occurrences || []).some((o) => o.sessionId === id));
  return (
    <div>
      <ul className="list">
        {imports.map((x) => (
          <li key={x.id} className="task" onClick={() => setOpen(x.id)}>
            <div className="task-body">
              <div className="task-title">
                {shortLabel(x.date)}・{x.topic}
                {x.round ? ` Round ${x.round}` : ''}
              </div>
              <div className="task-meta">
                <span>錯誤 {cardsOf(x.id).length}</span>
                {x.kind === 'userList' ? <span className="chip">你自己列的清單</span> : x.transcript ? <span>逐字稿 {x.transcript.length} 字</span> : <span className="chip warn">沒有逐字稿</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {s && (
        <Sheet title={`${shortLabel(s.date)} ${s.topic}`} onClose={() => setOpen(null)}>
          <div className="bank-detail">
            {cardsOf(s.id).length > 0 && (
              <button
                className="btn primary small"
                onClick={() => {
                  setOpen(null);
                  onRetry(pickRetry(englishItems, { sessionId: s.id, n: 5, t: today() }));
                }}
              >
                從這次練習挑 3～5 個重說
              </button>
            )}
            <p className="fb-label">原始逐字稿（我真正說的）</p>
            <p className="pasted">{s.transcript || '（沒有逐字稿）'}</p>
            {s.correctedTranscript && (
              <>
                <p className="fb-label">修正後自然英文（AI 建議）</p>
                <p className="pasted">{s.correctedTranscript}</p>
              </>
            )}
            {[
              ['grammarNotes', '文法問題'],
              ['vocabularyNotes', '詞彙問題'],
              ['phraseNotes', '片語建議'],
              ['logicNotes', '邏輯與表達建議'],
            ].map(([k, l]) =>
              (s[k] || []).length ? (
                <div key={k}>
                  <p className="fb-label">{l}</p>
                  <ul className="plain-list small">
                    {s[k].map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ---- 匯入 ChatGPT 批改結果（JSON）----
function ImportPanel({ onDone }) {
  const { uid, englishItems, api } = useData();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [existing, setExisting] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(BANK_PROMPT);
      setCopied(true);
    } catch {
      window.prompt('複製下面這段，貼給 ChatGPT', BANK_PROMPT);
    }
  };

  const check = async (raw) => {
    setResult('');
    setError('');
    setPreview(null);
    const parsed = parseImportText(raw);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const v = validateImport(parsed.data);
    if (v.fatal.length) {
      setError(`沒辦法匯入：\n${v.fatal.map((x) => `・${x}`).join('\n')}`);
      return;
    }
    setBusy(true);
    try {
      // 看這次練習是不是已經匯入過（用穩定 ID，不靠時間）
      const snap = await getDoc(doc(db, 'users', uid, 'speakImports', sessionDocId(v.session)));
      const ex = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setExisting(ex);
      setPreview(buildBankPreview(parsed.data, englishItems, ex));
    } catch (e) {
      logError('檢查口說匯入', e, { show: false });
      setError(`讀取紀錄失敗，沒有匯入：${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const load = (obj) => {
    const raw = JSON.stringify(obj, null, 2);
    setText(raw);
    check(raw);
  };

  const toggle = (list, i) =>
    setPreview({ ...preview, [list]: preview[list].map((r, j) => (j === i && r.status !== 'invalid' && r.status !== 'same' ? { ...r, selected: !r.selected } : r)) });

  const confirm = () => {
    const { ops, summary } = bankImportOps(preview, englishItems, today(), Date.now(), existing);
    for (let i = 0; i < ops.length; i += 400) api.batch(ops.slice(i, i + 400));
    setResult(ops.length ? `已匯入：新錯誤卡 ${summary.errors}、加到現有卡 ${summary.linked}、新片語 ${summary.phrases}。` : '沒有新的東西要匯入。');
    setPreview(null);
    setText('');
  };

  const picked = preview ? [...preview.errors, ...preview.phrases].filter((r) => r.selected).length : 0;

  return (
    <div>
      <section className="section">
        <h2>1. 請 ChatGPT 整理成 JSON</h2>
        <p className="muted small">練習完，把這段指令貼給 ChatGPT（同一個對話裡），它會把逐字稿、錯誤和片語整理成固定格式。</p>
        <div className="row gap wrap">
          <button className="btn" onClick={copyPrompt}>
            {copied ? '已複製' : '複製指令'}
          </button>
          <button className="btn" onClick={() => load(SAMPLE_IMPORT)}>
            看範例
          </button>
        </div>
      </section>
      <section className="section">
        <h2>2. 貼上 JSON</h2>
        <textarea className="paste" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'{\n  "schemaVersion": 1,\n  "session": { … },\n  "errors": [ … ],\n  "phrases": [ … ]\n}'} />
        <div className="row gap wrap">
          <button className="btn primary" onClick={() => check(text)} disabled={!text.trim() || busy}>
            {busy ? '檢查中…' : '檢查'}
          </button>
          <button className="btn" onClick={() => load(SEED_IMPORT)} disabled={busy}>
            載入初始清單（12 個錯誤、14 個片語）
          </button>
        </div>
        {result && (
          <p className="hint ok">
            {result}{' '}
            <button className="link" onClick={onDone}>
              去看錯誤卡
            </button>
          </p>
        )}
        {error && <p className="hint over pre">{error}</p>}
      </section>
      {preview && (
        <section className="section preview">
          <h2>3. 預覽</h2>
          <div className="card bank-session">
            <strong>
              {preview.session.date}・{preview.session.topic}
              {preview.session.round ? ` Round ${preview.session.round}` : ''}
            </strong>
            <span className="small muted">
              {preview.session.kind === 'userList' ? '你自己列的清單（沒有逐字稿，每筆錯誤算 1 次）' : `逐字稿 ${preview.session.transcript.length} 字`}
              {preview.session.exists ? '・已經匯入過' : ''}
            </span>
          </div>
          {preview.warnings.map((w) => (
            <p key={w} className="hint warn small">
              {w}
            </p>
          ))}
          {preview.errors.length > 0 && <h3>錯誤卡 {preview.errors.length}</h3>}
          <ul className="list bank-preview">
            {preview.errors.map((r, i) => (
              <li key={i} className={`task st-${r.status}`}>
                <input type="checkbox" checked={!!r.selected} disabled={r.status === 'invalid' || r.status === 'same'} onChange={() => toggle('errors', i)} />
                <div className="task-body">
                  <div className="fix-orig">{r.verifiedOriginal || '（沒有原句）'}</div>
                  <div className="fix-new">{r.suggestedCorrection}</div>
                  <div className="task-meta">
                    <span className={`chip ${r.status === 'new' ? 'ok' : r.status === 'similar' || r.status === 'invalid' ? 'warn' : ''}`}>{ROW_STATUS[r.status]}</span>
                    <span className="chip">{ERROR_CATEGORIES[r.errorCategory]}</span>
                    {r.evidence && <span>{EVIDENCE[r.evidence]}</span>}
                  </div>
                  {r.status === 'similar' && <div className="small muted">像現有的：{r.targetText}（勾起來會另存一張，不合併）</div>}
                  {r.status === 'linked' && <div className="small muted">會加到「{r.targetText}」的出現紀錄</div>}
                  {[...(r.problems || []), ...(r.notes || [])].map((x) => (
                    <div key={x} className="small warn-text">
                      {x}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {preview.phrases.length > 0 && <h3>片語 {preview.phrases.length}</h3>}
          <ul className="list bank-preview">
            {preview.phrases.map((r, i) => (
              <li key={i} className={`task st-${r.status}`}>
                <input type="checkbox" checked={!!r.selected} disabled={r.status === 'invalid' || r.status === 'same'} onChange={() => toggle('phrases', i)} />
                <div className="task-body">
                  <div className="task-title">
                    <span className="eng-front">{r.phrase || '（沒有片語）'}</span>
                    {r.meaningZh && <span className="muted">・{r.meaningZh}</span>}
                  </div>
                  <div className="task-meta">
                    <span className={`chip ${r.status === 'new' ? 'ok' : r.status === 'similar' || r.status === 'invalid' ? 'warn' : ''}`}>{ROW_STATUS[r.status]}</span>
                    {r.kind === 'inferredExpression' && <span className="chip">AI 推導</span>}
                    {r.tags.map((x) => (
                      <span key={x}>#{x}</span>
                    ))}
                    <span>{r.addToSrs ? '加入複習' : '不加入複習'}</span>
                  </div>
                  {r.status === 'similar' && <div className="small muted">像現有的：{r.targetText}</div>}
                  {[...(r.problems || []), ...(r.notes || [])].map((x) => (
                    <div key={x} className="small warn-text">
                      {x}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="row gap">
            <button className="btn primary" onClick={confirm} disabled={!picked && !!existing}>
              {picked ? `匯入 ${picked} 筆` : existing ? '沒有新的' : '只存練習紀錄'}
            </button>
            <button className="btn" onClick={() => setPreview(null)}>
              取消
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ---- Speaking Retry：自己重說，再自己比較、自評。網站不判斷對錯 ----
const GRADES = [
  [0, '不會'],
  [1, '有點會'],
  [2, '熟悉'],
];

function Retry({ pool, onDone }) {
  const { englishItems, api } = useData();
  const [chosen, setChosen] = useState(() => new Set(pool.slice(0, Math.min(5, pool.length)).map((x) => x.id)));
  const [queue, setQueue] = useState(null);
  const [i, setI] = useState(0);
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState(false);
  const [listening, setListening] = useState(false);
  const [done, setDone] = useState([]);
  const listener = useRef(null);
  useEffect(() => () => listener.current?.stop(), []);

  if (!pool.length) {
    return (
      <div className="bank">
        <p className="muted">沒有可以重說的錯誤卡。</p>
        <button className="btn" onClick={onDone}>
          回錯誤庫
        </button>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="bank">
        <button className="link" onClick={onDone}>
          ← 回錯誤庫
        </button>
        <h2 className="bank-title">Speaking Retry</h2>
        <p className="small muted">選 3～5 個（反覆出現的排前面）。</p>
        <ul className="list bank-preview">
          {pool.map((it) => (
            <li key={it.id} className="task">
              <input
                type="checkbox"
                checked={chosen.has(it.id)}
                onChange={() => {
                  const n = new Set(chosen);
                  if (n.has(it.id)) n.delete(it.id);
                  else if (n.size < 5) n.add(it.id);
                  setChosen(n);
                }}
              />
              <div className="task-body">
                <div className="fix-orig">{it.originalText}</div>
                <div className="task-meta">
                  <span className="chip">{ERROR_CATEGORIES[it.errorCategory]}</span>
                  {countOf(it) >= 2 && <span className="chip warn">{countOf(it)} 次</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button className="btn primary big" disabled={!chosen.size} onClick={() => setQueue(pool.filter((it) => chosen.has(it.id)).map((it) => it.id))}>
          開始重說 {chosen.size} 句
        </button>
      </div>
    );
  }

  if (i >= queue.length) {
    return (
      <div className="bank">
        <h2 className="bank-title">重說完了</h2>
        <ul className="list">
          {done.map((d) => (
            <li key={d.id} className="task">
              <div className="task-body">
                <div className="fix-new">{d.corrected}</div>
                <div className="task-meta">
                  <span className="chip">{GRADES[d.grade][1]}</span>
                  <span>下次 {shortLabel(d.due)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="small muted">複習時間已經照你的自評更新到原本的複習排程。</p>
        <button className="btn primary" onClick={onDone}>
          回錯誤庫
        </button>
      </div>
    );
  }

  const it = englishItems.find((x) => x.id === queue[i]);
  const next = () => {
    setI(i + 1);
    setDraft('');
    setShown(false);
  };
  if (!it) {
    return (
      <div className="bank">
        <p className="muted">這張卡已經刪掉了。</p>
        <button className="btn" onClick={next}>
          下一張
        </button>
      </div>
    );
  }

  const toggleMic = () => {
    if (listening) {
      listener.current?.stop();
      return;
    }
    const before = draft ? `${draft} ` : '';
    setListening(true);
    listener.current = startListening({
      lang: 'en-US',
      onText: (x) => setDraft(before + x),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
  };

  const grade = (g) => {
    const t = today();
    const upd = reviewGrade(it, g, t);
    api.update(`englishItems/${it.id}`, { ...upd, lastRetry: { text: draft.trim().slice(0, 600), grade: g, date: t } });
    setDone([...done, { id: it.id, corrected: it.correctedText, grade: g, due: upd.due }]);
    next();
  };

  return (
    <div className="bank">
      <div className="row between">
        <span className="chip">
          {i + 1} / {queue.length}
        </span>
        <button className="link small" onClick={onDone}>
          結束
        </button>
      </div>
      <div className="card bank-retry-card">
        <p className="fb-label">我的原句</p>
        <p className="fix-orig big-line">{it.originalText}</p>
        <p className="small muted">
          {ERROR_CATEGORIES[it.errorCategory]}・{it.sourceTopic}
        </p>
        <label className="fb-label">
          自己重新說（或打字）
          <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="用正確的方式重說一次這個意思" />
        </label>
        {canListen() && (
          <button className={`btn mic ${listening ? 'on' : ''}`} onClick={toggleMic}>
            {listening ? '說完了' : '點一下開始說'}
          </button>
        )}
        {!shown ? (
          <button className="btn primary" onClick={() => setShown(true)}>
            看正確說法
          </button>
        ) : (
          <div className="bank-compare">
            <p className="fb-label">我剛剛說的</p>
            <p>{draft.trim() || '（沒有輸入）'}</p>
            <p className="fb-label">正確說法</p>
            <p className="fix-new big-line">{it.correctedText}</p>
            {it.explanationZh && <p className="small">{it.explanationZh}</p>}
            {(it.examples || [])[0] && <p className="small flash-example">{it.examples[0]}</p>}
            <p className="small muted">網站不會自動判斷你說得對不對，請自己比較後選：</p>
            <div className="row gap">
              {GRADES.map(([g, l]) => (
                <button key={g} className={`btn grow ${g === 2 ? 'primary' : ''}`} onClick={() => grade(g)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
