// 錯誤紀錄：網站出錯時記到 users/{uid}/errorLog，設定頁的「錯誤紀錄」看得到，齒輪上會有紅點
// 同一個錯誤（來源＋訊息）只存一筆，再發生就加次數，不會灌爆資料庫
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase.js';

let uid = null;
let written = 0;
const MAX_PER_VISIT = 20;
const listeners = new Set();

export function setErrorUser(id) {
  uid = id;
}

// 畫面上要不要跳「出了點狀況」的提示（App 會訂閱）
export function onErrorShown(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 瀏覽器外掛、跨網域腳本、已知無害的雜訊，不記
const NOISE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Load failed$/i, /AbortError/i, /chrome-extension:|moz-extension:|safari-extension:/i];

export function isNoise(message, stack = '') {
  return !message || NOISE.some((r) => r.test(message) || r.test(stack));
}

// 同樣的錯誤對到同一個 id（簡單的字串雜湊）
export function errorKey(source, message) {
  const s = `${source}|${String(message).replace(/\d{4,}/g, '#')}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function errorInfo(err) {
  if (!err) return { message: '不明錯誤', stack: '' };
  if (typeof err === 'string') return { message: err, stack: '' };
  const message = err.message || err.reason?.message || String(err);
  const code = err.code ? `[${err.code}] ` : '';
  return { message: `${code}${message}`.slice(0, 500), stack: String(err.stack || '').slice(0, 1500) };
}

// source：哪裡出錯（例如 "畫面"、"存檔"、"Gmail"），show：要不要跳提示給正在用的人
export function logError(source, err, { show = true } = {}) {
  const { message, stack } = errorInfo(err);
  if (isNoise(message, stack)) return;
  if (show) listeners.forEach((fn) => fn(message));
  if (!uid || written >= MAX_PER_VISIT) return;
  written++;
  const now = Date.now();
  setDoc(
    doc(db, 'users', uid, 'errorLog', errorKey(source, message)),
    {
      source, message, stack,
      page: window.location.pathname,
      ua: navigator.userAgent.slice(0, 200),
      lastAt: now,
      count: increment(1),
      seen: false,
    },
    { merge: true },
  ).catch(() => {}); // 記錄本身失敗就算了，不要再觸發錯誤
}

export function installErrorLogging() {
  window.addEventListener('error', (e) => {
    // 圖片、腳本載入失敗也會觸發，但沒有 error 物件，略過
    if (!e.error && !e.message) return;
    logError('程式', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => logError('程式', e.reason));
}
