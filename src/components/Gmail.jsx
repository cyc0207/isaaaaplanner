import { useState } from 'react';
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from '../firebase.js';
import { useData } from '../data.jsx';
import { today } from '../lib/date.js';
import { DEFAULT_QUERIES, searchIds, getMessage, guessDeadline } from '../lib/gmail.js';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_KEY = 'gmailToken';

function cachedToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return t && t.exp > Date.now() ? t.token : null;
  } catch {
    return null;
  }
}

// 用同一個 Google 帳號再授權一次、多要「讀取 Gmail」的權限，拿到一小時有效的存取權杖
// 權杖只放在這個分頁的 sessionStorage，不存進資料庫
async function requestToken() {
  const user = auth.currentUser;
  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);
  provider.setCustomParameters({ login_hint: user.email || '' });
  const res = await reauthenticateWithPopup(user, provider);
  const token = GoogleAuthProvider.credentialFromResult(res)?.accessToken;
  if (!token) throw new Error('Google 沒有給讀信的權限');
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60 * 1000 }));
  } catch {
    /* 無痕模式 */
  }
  return token;
}

function explain(e) {
  if (e.code === 'auth/popup-blocked') return '瀏覽器擋了彈出視窗，請允許這個網站開新視窗後再按一次。';
  if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return '';
  if (e.code === 'auth/user-mismatch') return '要選登入這個網站的同一個 Google 帳號。';
  if (e.status === 403) return `Gmail 拒絕讀取（${e.message}）。請確認 Google Cloud 已啟用 Gmail API，而且授權時有勾「查看你的電子郵件」。`;
  return e.message || String(e);
}

export function useGmailSync() {
  const { mail, gmail, api } = useData();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const queries = { ...DEFAULT_QUERIES, ...gmail.queries };

  const run = async (token) => {
    const known = new Set(mail.map((m) => m.id));
    const t = today();
    const ops = [];
    // 先收英文信：固定寄件者的英文信裡就算出現 contest 也不要算成比賽
    for (const box of ['english', 'competition']) {
      const q = (queries[box] || '').trim();
      if (!q) continue;
      const ids = (await searchIds(token, q, 25)).filter((id) => !known.has(id));
      ids.forEach((id) => known.add(id));
      const msgs = await Promise.all(ids.map((id) => getMessage(token, id)));
      for (const m of msgs) {
        const { body, ...rest } = m;
        ops.push({
          set: `mail/${m.id}`,
          merge: false,
          data: {
            ...rest,
            box,
            body: box === 'english' ? body.slice(0, 40000) : '',
            guess: box === 'competition' ? guessDeadline(`${m.subject}\n${body}`, t) : '',
            status: 'new',
          },
        });
      }
    }
    ops.push({ set: 'settings/gmail', data: { lastSync: Date.now() } });
    api.batch(ops);
    return ops.length - 1;
  };

  const sync = async () => {
    setBusy(true);
    setMsg('');
    try {
      let n;
      const cached = cachedToken();
      try {
        n = await run(cached || (await requestToken()));
      } catch (e) {
        if (!cached || e.status !== 401) throw e;
        sessionStorage.removeItem(TOKEN_KEY);
        n = await run(await requestToken());
      }
      setMsg(n ? `收到 ${n} 封新信。` : '沒有新信。');
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setBusy(false);
    }
  };

  return { sync, busy, msg, queries, lastSync: gmail.lastSync };
}

export function SyncButton({ g }) {
  return (
    <div className="gmail-sync">
      <div className="row between">
        <span className="muted small">
          {g.lastSync ? `上次收信 ${new Date(g.lastSync).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '還沒連結 Gmail'}
        </span>
        <button className="btn small primary" onClick={g.sync} disabled={g.busy}>
          {g.busy ? '收信中…' : g.lastSync ? '收新信' : '連結 Gmail'}
        </button>
      </div>
      {g.msg && <p className="hint">{g.msg}</p>}
    </div>
  );
}

// 收哪些信：兩組 Gmail 搜尋條件
export function QueryEditor({ queries }) {
  const { api } = useData();
  const [f, setF] = useState(queries);
  const [saved, setSaved] = useState(false);
  const edit = (patch) => {
    setF({ ...f, ...patch });
    setSaved(false);
  };
  const save = (e) => {
    e.preventDefault();
    api.set('settings/gmail', { queries: { competition: f.competition.trim(), english: f.english.trim() } });
    setSaved(true);
  };
  return (
    <details className="gmail-queries">
      <summary>只收哪些信</summary>
      <form className="form" onSubmit={save}>
        <label>
          比賽（Gmail 搜尋條件）
          <textarea rows={3} value={f.competition} onChange={(e) => edit({ competition: e.target.value })} />
        </label>
        <label>
          固定英文信（例：from:daily@example.com）
          <input value={f.english} onChange={(e) => edit({ english: e.target.value })} placeholder="from:寄件人信箱" />
        </label>
        <p className="muted small">寫法跟 Gmail 搜尋框一樣。只讀這兩組條件找到的信，不會讀其他信，也不會寄信或刪信。空白就不收那一類。</p>
        <div className="row gap">
          <button className="btn small primary">儲存</button>
          <button type="button" className="btn small" onClick={() => edit({ competition: DEFAULT_QUERIES.competition })}>
            比賽條件回到預設
          </button>
          {saved && <span className="muted small">已儲存</span>}
        </div>
      </form>
    </details>
  );
}
