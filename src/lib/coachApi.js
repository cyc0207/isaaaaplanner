// 呼叫 /api/coach（Vercel）。帶 Firebase 登入的 ID token，伺服器用它確認是本人
import { auth } from '../firebase.js';

export class CoachError extends Error {
  constructor(message, setup = false) {
    super(message);
    this.setup = setup;
  }
}

export async function callCoach(body) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new CoachError('登入過期了，請重新整理頁面。');
  let res;
  try {
    res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CoachError('連不上網路，等一下再試。');
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 本機 npm run dev 沒有 /api，會拿到網頁而不是 JSON
  }
  if (!json) throw new CoachError(`AI 教練沒有回應（${res.status}）。本機開發時要用 vercel dev 才有 /api。`);
  if (json.error) throw new CoachError(json.error, !!json.setup);
  return json.data;
}

// 伺服器有沒有設定 AI（ANTHROPIC_API_KEY）。沒設定、本機開發或連不上都當作沒有
let readyPromise;
export function coachReady() {
  readyPromise ||= fetch('/api/coach')
    .then((r) => r.json())
    .then((j) => j.ready === true)
    .catch(() => false);
  return readyPromise;
}
