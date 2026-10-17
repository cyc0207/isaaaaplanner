// AI 口說教練：聊天、回饋、報告
// POST /api/coach  Authorization: Bearer <Firebase ID token>
// body: { mode: 'chat'|'feedback'|'report', topic, summary, context, answer, answers, fillers }
// API Key 只放在 Vercel 環境變數 ANTHROPIC_API_KEY；只有 COACH_ALLOWED_EMAILS 裡的帳號能用
import Anthropic from '@anthropic-ai/sdk';
import { verifyIdToken, allowedEmail } from './_auth.js';
import { SYSTEM, buildRequest } from '../src/lib/coachPrompts.js';
import { firebaseConfig } from '../src/firebaseConfig.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const EFFORT = { chat: 'low', feedback: 'medium', report: 'medium' };
// Haiku 沒有伺服器端的備援模型
const USE_FALLBACK = !/haiku/.test(MODEL);

// 同一個帳號每分鐘最多幾次（每個伺服器實例各自算，擋意外連點和被盜用）
const PER_MINUTE = 20;
const hits = new Map();
function tooMany(uid) {
  const now = Date.now();
  const list = (hits.get(uid) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(uid, list);
  return list.length > PER_MINUTE;
}

let client;

async function callModel(req, withFallback) {
  client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 55_000, maxRetries: 1 });
  const params = {
    model: MODEL,
    max_tokens: req.maxTokens,
    system: SYSTEM,
    messages: [{ role: 'user', content: req.user }],
    output_config: { effort: EFFORT[req.mode], format: { type: 'json_schema', schema: req.schema } },
  };
  if (withFallback) return client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  return client.messages.create(params);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI 教練還沒設定：請在 Vercel 加環境變數 ANTHROPIC_API_KEY，然後重新部署。', setup: true });
  }

  let user;
  try {
    user = await verifyIdToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''), firebaseConfig.projectId);
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }
  if (!user.emailVerified || !allowedEmail(user.email, process.env.COACH_ALLOWED_EMAILS)) {
    return res.status(403).json({ error: `這個帳號（${user.email || '沒有 email'}）還不能用 AI 教練：請在 Vercel 環境變數 COACH_ALLOWED_EMAILS 加上它，然後重新部署。`, setup: true });
  }
  if (tooMany(user.uid)) return res.status(429).json({ error: '太快了，等一分鐘再試。' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const built = buildRequest(body);
  if (built.error) return res.status(400).json({ error: built.error });

  try {
    let msg;
    try {
      msg = await callModel(built, USE_FALLBACK);
    } catch (e) {
      // 模型不支援備援參數時，不帶備援再試一次
      if (USE_FALLBACK && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) msg = await callModel(built, false);
      else throw e;
    }
    if (msg.stop_reason === 'refusal') return res.status(200).json({ error: 'AI 這次沒有回答，換個說法再試一次。' });
    if (msg.stop_reason === 'max_tokens') return res.status(200).json({ error: 'AI 回答太長被截斷了，再試一次。' });
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'AI 回傳的格式不對，再試一次。' });
    }
    return res.status(200).json({ data, model: msg.model, usage: { in: msg.usage?.input_tokens || 0, out: msg.usage?.output_tokens || 0 } });
  } catch (e) {
    // 不記錄對話內容，只記錯誤種類
    console.error('coach error', e?.status, e?.name);
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: 'ANTHROPIC_API_KEY 不正確，請到 Vercel 換一把。', setup: true });
    if (e instanceof Anthropic.PermissionDeniedError) return res.status(503).json({ error: `這把 API Key 不能用模型 ${MODEL}。`, setup: true });
    if (e instanceof Anthropic.NotFoundError) return res.status(503).json({ error: `找不到模型 ${MODEL}，請檢查 ANTHROPIC_MODEL。`, setup: true });
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'AI 現在太忙或額度用完了，等一下再試；也可以到 Anthropic Console 看帳單。' });
    if (e instanceof Anthropic.APIConnectionTimeoutError) return res.status(504).json({ error: 'AI 想太久了，再試一次。' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `AI 服務出錯（${e.status ?? '連線'}），再試一次。` });
    return res.status(500).json({ error: 'AI 教練出錯了，再試一次。' });
  }
}
