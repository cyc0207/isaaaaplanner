// AI 口說教練的 prompt 和回傳格式。前端不用這個檔，給 api/coach.js 用（測試也會用）
import { TOPICS, ERROR_TYPES, clip } from './speak.js';

export const SYSTEM = `You are a friendly English speaking partner and coach inside a personal study app.

The learner:
- Taiwanese, native Mandarin speaker, loves talking and happily speaks at length without fear of mistakes.
- Listening is weaker than speaking, so keep your English clear and not too long.
- Ideas run ahead of their English: common problems are verb tenses, missing be verbs, word forms, prepositions, collocations, sentence structure, and fillers like "actually", "really", "I think".
- Goals: English job interviews, BA/PM workplace communication, TOEIC/IELTS.
- Practises 5 to 10 minutes on weekdays, mostly by voice. Their messages are speech-to-text transcripts, so ignore missing punctuation, capitalisation and obvious recognition slips.

Core principle: encourage expression first, give precise feedback later. Never let corrections make them afraid to speak.

When chatting:
- First work out what they really mean. Never change their meaning or put words in their mouth.
- If the meaning is unclear, ask a short check question instead of guessing.
- Reply naturally (1 to 3 short sentences), then ask exactly ONE follow-up question that builds on what they just said.
- Do not correct grammar during the chat. Do not praise every answer; a brief genuine reaction is enough, and often none.
- They may mix in Chinese. When they do, or when they clearly struggled to say something, offer the natural English for that part.
- Use everyday spoken English at an intermediate level. No idioms that need explaining, no business-report tone.

Never give IELTS, TOEIC or any official exam score, band, or hiring probability. You only see text, so never comment on pronunciation, intonation, stress, pauses or speaking speed.`;

const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Your spoken reply in English: a short natural response plus exactly one follow-up question.' },
    help: { type: 'string', description: 'Only if they used Chinese or clearly struggled: "You could say: ..." with the natural English. Otherwise empty string.' },
    needs_clarification: { type: 'boolean', description: 'True when your question is a check because their meaning was unclear.' },
    summary: { type: 'string', description: 'Updated running memory of the conversation in under 80 English words: facts, opinions and stories they shared, plus the thread you are following.' },
  },
  required: ['reply', 'help', 'needs_clarification', 'summary'],
  additionalProperties: false,
};

const FIX = {
  type: 'object',
  properties: {
    original: { type: 'string', description: 'Their sentence or phrase, quoted as they said it.' },
    corrected: { type: 'string', description: 'Corrected version that keeps their meaning.' },
    why: { type: 'string', description: 'One short explanation in Traditional Chinese (Taiwan).' },
    type: { type: 'string', enum: Object.keys(ERROR_TYPES) },
  },
  required: ['original', 'corrected', 'why', 'type'],
  additionalProperties: false,
};

const FEEDBACK_PROPS = {
  understood: { type: 'string', description: 'In Traditional Chinese (Taiwan), 1-2 sentences: what you understood they wanted to say.' },
  fixes: { type: 'array', items: FIX, description: 'The 2 or 3 issues most worth fixing this time (fewer only if there truly are fewer). Prefer issues that change meaning or repeat.' },
  natural: { type: 'string', description: 'Their answers rewritten as natural spoken English at their level: keep their ideas, simple words, not a formal business text, usable in daily life or an interview.' },
  retry: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'One useful sentence pattern taken from the natural version, e.g. "I felt a sense of achievement when ..."' },
      prompt: { type: 'string', description: 'A short English question asking them to say something again using that pattern.' },
    },
    required: ['pattern', 'prompt'],
    additionalProperties: false,
  },
};

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: FEEDBACK_PROPS,
  required: Object.keys(FEEDBACK_PROPS),
  additionalProperties: false,
};

const REPORT_PROPS = {
  ...FEEDBACK_PROPS,
  strengths: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things they expressed clearly this session, in Traditional Chinese. Concrete, not generic praise.' },
  nextFocus: { type: 'array', items: { type: 'string' }, description: 'Exactly 2 things most worth practising next, in Traditional Chinese, each with a short English example.' },
};

const REPORT_SCHEMA = {
  type: 'object',
  properties: REPORT_PROPS,
  required: Object.keys(REPORT_PROPS),
  additionalProperties: false,
};

const LIMITS = { answer: 2000, summary: 1200, context: 6, answers: 20 };

const lines = (arr) => arr.map((t) => `${t.role === 'me' ? 'Learner' : 'You'}: ${clip(t.text, 1200)}`).join('\n');

// 檢查前端送來的內容，組成一次 API 呼叫。回傳 { error } 或 { system, user, schema, maxTokens }
export function buildRequest(body) {
  const mode = body?.mode;
  const topic = TOPICS[body?.topic] ? body.topic : 'free';
  const topicLine = `Topic: ${TOPICS[topic].en}.`;
  const summary = clip(body?.summary, LIMITS.summary);
  if (mode === 'chat') {
    const context = (Array.isArray(body.context) ? body.context : []).slice(-LIMITS.context);
    const answer = clip(body.answer, LIMITS.answer);
    if (!context.length && !answer) {
      return {
        mode, schema: CHAT_SCHEMA, maxTokens: 2000,
        user: `${topicLine}\nStart the conversation: greet briefly and ask one natural, easy-to-answer opening question on this topic. Leave help empty and summary empty.`,
      };
    }
    if (!answer) return { error: '沒有收到你的回答' };
    return {
      mode, schema: CHAT_SCHEMA, maxTokens: 2000,
      user: [
        topicLine,
        `Conversation memory so far: ${summary || '(none yet)'}`,
        `Most recent turns:\n${lines(context)}`,
        `Learner just said (speech transcript):\n${answer}`,
        'Reply and ask one follow-up question. Update the memory.',
      ].join('\n\n'),
    };
  }
  if (mode === 'feedback' || mode === 'report') {
    const answers = (Array.isArray(body.answers) ? body.answers : []).slice(-LIMITS.answers).map((a) => clip(a, LIMITS.answer)).filter(Boolean);
    if (!answers.length) return { error: '還沒有回答可以給回饋' };
    const fillers = Object.entries(body.fillers || {}).slice(0, 6).map(([w, n]) => `"${clip(w, 20)}" x${Number(n) || 0}`).join(', ');
    const common = [
      topicLine,
      `Conversation memory: ${summary || '(none)'}`,
      `Learner's answers (speech transcripts, oldest first):\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
    ];
    if (mode === 'feedback') {
      return {
        mode, schema: FEEDBACK_SCHEMA, maxTokens: 3000,
        user: [...common, 'Give short feedback on these answers in the four parts of the schema. Pick only the 2-3 most valuable fixes; do not list every error.'].join('\n\n'),
      };
    }
    return {
      mode, schema: REPORT_SCHEMA, maxTokens: 4000,
      user: [
        ...common,
        fillers ? `Filler words counted by the app: ${fillers}.` : '',
        'Write the end-of-session learning report. No scores, no exam bands, no percentages, nothing about pronunciation. For "natural", rewrite the most important answer only.',
      ].filter(Boolean).join('\n\n'),
    };
  }
  return { error: '不認得的模式' };
}
