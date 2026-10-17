// 驗證 Firebase 登入的 ID token（不需要服務帳號金鑰）：
// 用 Google 公開的金鑰檢查 RS256 簽章，再檢查發行者、對象、到期時間。
// 檔名開頭是底線，Vercel 不會把它當成一個 API。
import { createPublicKey, verify } from 'node:crypto';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cache = { keys: null, until: 0 };

async function getKeys(fetchImpl = fetch) {
  if (cache.keys && Date.now() < cache.until) return cache.keys;
  const res = await fetchImpl(JWKS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`拿不到 Google 公開金鑰（${res.status}）`);
  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  cache = { keys: Object.fromEntries(keys.map((k) => [k.kid, k])), until: Date.now() + maxAge * 1000 };
  return cache.keys;
}

const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

// 成功回傳 { uid, email }，失敗丟出錯誤
export async function verifyIdToken(token, projectId, { fetchImpl, now = Date.now() } = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('沒有登入資訊');
  const header = b64json(parts[0]);
  const payload = b64json(parts[1]);
  if (header.alg !== 'RS256') throw new Error('登入資訊格式不對');
  const jwk = (await getKeys(fetchImpl))[header.kid];
  if (!jwk) throw new Error('登入資訊的金鑰不認得');
  const ok = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('登入資訊簽章不對');
  const sec = Math.floor(now / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('登入資訊不是這個網站的');
  if (!payload.sub || payload.exp <= sec || payload.iat > sec + 300) throw new Error('登入過期了，請重新整理頁面');
  return { uid: payload.sub, email: (payload.email || '').toLowerCase(), emailVerified: !!payload.email_verified };
}

export function allowedEmail(email, list) {
  const allowed = String(list || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

// 只給測試用：換掉快取的金鑰
export function _setKeysForTest(keys) {
  cache = { keys, until: Date.now() + 3600_000 };
}
