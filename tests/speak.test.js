import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  countFillers, recentContext, answersSinceFeedback, feedbackDue, speakingSec, progressStats, normFeedback, normReport, fixToCard, FEEDBACK_EVERY,
} from '../src/lib/speak.js';
import { buildRequest, SYSTEM } from '../src/lib/coachPrompts.js';
import { verifyIdToken, allowedEmail, _setKeysForTest } from '../api/_auth.js';

const me = (text, extra = {}) => ({ role: 'me', text, source: 'text', ...extra });
const ai = (text) => ({ role: 'ai', text });

describe('填充詞', () => {
  it('數 actually、really、I think，不算單字裡面的', () => {
    const r = countFillers(['Actually I think it was really really fun.', 'I thinking about it, actually.', 'ummm um ok']);
    expect(r).toEqual({ really: 2, actually: 2, 'I think': 1, um: 1 });
    expect(Object.keys(r)[0]).toBe('actually'); // 次數一樣時照清單順序
  });
  it('沒有就是空的', () => {
    expect(countFillers('Hello there')).toEqual({});
  });
});

describe('對話上下文與回饋時機', () => {
  const turns = [ai('Q1'), me('a1'), ai('Q2'), me('a2'), ai('Q3'), me('a3'), ai('Q4'), me('a4'), ai('Q5')];
  it('只帶最近 6 則', () => {
    expect(recentContext(turns).map((t) => t.text)).toEqual(['Q2', 'a2', 'Q3', 'a3', 'Q4', 'a4', 'Q5'].slice(-6));
  });
  it(`每回答 ${FEEDBACK_EVERY} 次給一次回饋`, () => {
    expect(feedbackDue(turns.slice(0, 7), [])).toBe(false);
    expect(feedbackDue(turns, [])).toBe(true);
    const fbs = [{ afterTurn: 8 }];
    expect(answersSinceFeedback(turns, fbs)).toEqual([]);
    expect(feedbackDue([...turns, me('a5')], fbs)).toBe(false);
  });
  it('口說秒數只算語音', () => {
    expect(speakingSec([me('a', { source: 'voice', sec: 30 }), me('b', { sec: 99 }), ai('x')])).toBe(30);
  });
});

describe('學習紀錄統計', () => {
  it('本週次數、分鐘、最近主題；沒結束的不算', () => {
    const sessions = [
      { date: '2026-10-16', topic: 'work', endedAtMs: 1, startedAtMs: 3, speakingSec: 300 },
      { date: '2026-10-12', topic: 'free', endedAtMs: 1, startedAtMs: 2, speakingSec: 120 },
      { date: '2026-10-05', topic: 'life', endedAtMs: 1, startedAtMs: 1, speakingSec: 600 },
      { date: '2026-10-16', topic: 'career', endedAtMs: 0, startedAtMs: 4, speakingSec: 999 },
    ];
    const st = progressStats(sessions, '2026-10-17');
    expect(st.weekCount).toBe(2);
    expect(st.weekMinutes).toBe(7);
    expect(st.totalMinutes).toBe(17);
    expect(st.recentTopics).toEqual(['work', 'free', 'life']);
  });
  it('沒有資料時都是 0，不捏造', () => {
    expect(progressStats([], '2026-10-17')).toMatchObject({ weekCount: 0, totalMinutes: 0, recentTopics: [] });
  });
});

describe('整理 AI 回饋', () => {
  it('最多 3 個修正、未知類型變 other、缺欄位補空', () => {
    const f = normFeedback({
      understood: '你覺得很有成就感',
      fixes: [
        { original: 'I feel very achievement.', corrected: 'I felt a sense of achievement.', why: 'achievement 是名詞', type: 'word_form' },
        { original: 'a', corrected: 'b', why: '', type: 'weird' },
        { original: 'c', corrected: 'd', type: 'tense' },
        { original: 'e', corrected: 'f', type: 'tense' },
        { original: '', corrected: 'g' },
      ],
    });
    expect(f.fixes).toHaveLength(3);
    expect(f.fixes[1].type).toBe('other');
    expect(f.natural).toBe('');
    expect(f.retry).toEqual({ pattern: '', prompt: '' });
    expect(JSON.stringify(f)).not.toContain('undefined');
  });
  it('報告多了優點和下次重點', () => {
    const r = normReport({ strengths: ['a', 'b', 'c', 'd'], nextFocus: ['x', 'y', 'z'] });
    expect(r.strengths).toHaveLength(3);
    expect(r.nextFocus).toHaveLength(2);
  });
  it('修正句存成改錯卡', () => {
    const c = fixToCard({ original: 'I feel very achievement.', corrected: 'I felt a sense of achievement.', why: '名詞', type: 'word_form' });
    expect(c).toMatchObject({ type: 'fix', front: 'I feel very achievement.', back: 'I felt a sense of achievement.', tags: ['口說', '詞性'], source: 'coach' });
  });
});

describe('prompt 組裝', () => {
  it('開場不需要回答', () => {
    const r = buildRequest({ mode: 'chat', topic: 'career' });
    expect(r.error).toBeUndefined();
    expect(r.user).toMatch(/BA or PM/);
  });
  it('聊天只帶摘要和最近 6 則，太長的回答會截斷', () => {
    const context = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'me' : 'ai', text: `turn${i}` }));
    const r = buildRequest({ mode: 'chat', topic: 'nope', summary: 'likes coffee', context, answer: 'x'.repeat(5000) });
    expect(r.user).toContain('likes coffee');
    expect(r.user).not.toContain('turn13');
    expect(r.user).toContain('turn14');
    expect(r.user).toContain('free chat');
    expect(r.user.length).toBeLessThan(3000);
  });
  it('有對話但沒有回答是錯誤；不認得的模式是錯誤', () => {
    expect(buildRequest({ mode: 'chat', context: [{ role: 'ai', text: 'hi' }] }).error).toBeTruthy();
    expect(buildRequest({ mode: 'hack' }).error).toBeTruthy();
    expect(buildRequest(null).error).toBeTruthy();
  });
  it('報告要求不給分數、不評發音', () => {
    const r = buildRequest({ mode: 'report', answers: ['I go there yesterday'], fillers: { actually: 3 } });
    expect(r.user).toMatch(/No scores/);
    expect(r.user).toContain('"actually" x3');
    expect(SYSTEM).toMatch(/never comment on pronunciation/);
    expect(r.schema.required).toEqual(expect.arrayContaining(['understood', 'fixes', 'natural', 'retry', 'strengths', 'nextFocus']));
  });
});

// ---- 登入驗證 ----
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' };
const PROJECT = 'isaplanner-489f0';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeToken(payload = {}, { kid = 'k1', key = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b64({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'u1', email: 'Me@Example.com', email_verified: true, iat: now - 10, exp: now + 3600, ...payload });
  const sig = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url');
  return `${head}.${body}.${sig}`;
}

describe('Firebase ID token 驗證', () => {
  beforeEach(() => _setKeysForTest({ k1: jwk }));
  it('正確的 token 通過', async () => {
    await expect(verifyIdToken(makeToken(), PROJECT)).resolves.toEqual({ uid: 'u1', email: 'me@example.com', emailVerified: true });
  });
  it('別的專案、過期、簽章不對、亂碼都擋', async () => {
    await expect(verifyIdToken(makeToken({ aud: 'other' }), PROJECT)).rejects.toThrow();
    await expect(verifyIdToken(makeToken({ exp: 1 }), PROJECT)).rejects.toThrow(/過期/);
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await expect(verifyIdToken(makeToken({}, { key: other }), PROJECT)).rejects.toThrow(/簽章/);
    await expect(verifyIdToken(makeToken({}, { kid: 'nope' }), PROJECT)).rejects.toThrow();
    await expect(verifyIdToken('abc', PROJECT)).rejects.toThrow();
  });
  it('允許名單不分大小寫', () => {
    expect(allowedEmail('me@example.com', ' Me@Example.com , b@c.d')).toBe(true);
    expect(allowedEmail('x@example.com', 'me@example.com')).toBe(false);
    expect(allowedEmail('me@example.com', '')).toBe(false);
  });
});

// ---- /api/coach ----
const create = vi.fn();
const betaCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class BadRequestError extends APIError {}
  class Anthropic {
    constructor() {
      this.messages = { create };
      this.beta = { messages: { create: betaCreate } };
    }
  }
  Object.assign(Anthropic, {
    APIError, BadRequestError, AuthenticationError: class extends APIError {}, PermissionDeniedError: class extends APIError {},
    NotFoundError: class extends APIError {}, RateLimitError: class extends APIError {}, APIConnectionTimeoutError: class extends APIError {},
  });
  return { default: Anthropic };
});

function mockRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.setHeader = (k, v) => (res.headers[k] = v);
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
}

describe('/api/coach', () => {
  beforeEach(() => {
    _setKeysForTest({ k1: jwk });
    create.mockReset();
    betaCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test';
    process.env.COACH_ALLOWED_EMAILS = 'me@example.com';
  });
  const call = async (body, token = makeToken()) => {
    const { default: handler } = await import('../api/coach.js');
    const res = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, res);
    return res;
  };

  it('沒設 Key 時說明要怎麼設', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await call({ mode: 'chat' });
    expect(res.statusCode).toBe(503);
    expect(res.body.setup).toBe(true);
  });
  it('不在允許名單就擋，不呼叫 AI', async () => {
    const res = await call({ mode: 'chat' }, makeToken({ email: 'stranger@example.com' }));
    expect(res.statusCode).toBe(403);
    expect(betaCreate).not.toHaveBeenCalled();
  });
  it('沒登入就擋', async () => {
    const res = await call({ mode: 'chat' }, '');
    expect(res.statusCode).toBe(401);
  });
  it('回傳 AI 的 JSON，請求帶格式與備援', async () => {
    betaCreate.mockResolvedValue({
      stop_reason: 'end_turn', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: 'text', text: JSON.stringify({ reply: 'Hi! How was your day?', help: '', needs_clarification: false, summary: '' }) }],
    });
    const res = await call({ mode: 'chat', topic: 'life' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.reply).toMatch(/How was your day/);
    const params = betaCreate.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.fallbacks).toBe('default');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params.output_config.effort).toBe('low');
  });
  it('拒答時給友善訊息', async () => {
    betaCreate.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    const res = await call({ mode: 'chat', topic: 'life' });
    expect(res.body.error).toBeTruthy();
  });
});
