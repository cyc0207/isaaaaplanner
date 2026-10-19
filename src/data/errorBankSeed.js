// 初始資料：使用者 2026-10-18 提供的 ChatGPT 口說整理（交換格式 schemaVersion 1.0.0，32 個錯誤、16 個片語、10 個優先複習）。
// 原本使用者在需求裡列的 12 個錯誤、14 個片語都已包含在這份裡（同一批練習），所以不再另外放一份清單，避免同一次錯誤算兩次。
import SPEAKING_1018 from './speaking-2026-10-18.json';
// 2026-10-19 四輪口說（DBS 實習、銀行 BA、風險溝通、和主管意見不同）：34 個錯誤、12 個片語
import SPEAKING_1019 from './speaking-2026-10-19.json';

export const SEED_IMPORT = SPEAKING_1018;
export const SEED_IMPORT_1019 = SPEAKING_1019;

// JSON 匯入範例（匯入頁「看範例」用）：一次 ChatGPT 批改的樣子
export const SAMPLE_IMPORT = {
  schemaVersion: 1,
  session: {
    sourceId: 'chatgpt-2026-10-16-success-r1',
    date: '2026-10-16',
    topic: 'Success and Ambition',
    round: 1,
    transcript: "I think success is not only money. That's meaning I can choose what I want to do.",
    correctedTranscript: "I think success isn't only about money. It means I can choose what I want to do.",
    grammarNotes: ["That's meaning → That means：mean 是動詞"],
    vocabularyNotes: [],
    phraseNotes: ["That doesn't necessarily mean… 可以用來補充觀點"],
    logicNotes: ['先講定義，再舉一個自己的例子會更清楚'],
  },
  errors: [
    {
      verifiedOriginal: "That's meaning I can choose what I want to do.",
      suggestedCorrection: 'That means I can choose what I want to do.',
      pattern: "That's meaning → That means",
      recurrenceGroup: 'that_means',
      errorCategory: 'grammar',
      explanationZh: 'mean 是動詞，不加 is。',
      examples: ['That means we need more time.'],
      inferredExpression: 'Success means having the freedom to choose.',
    },
  ],
  phrases: [
    {
      phrase: "That doesn't necessarily mean…",
      meaningZh: '那不一定代表…',
      usage: '溫和地補充或反駁',
      example: "Having money doesn't necessarily mean you are successful.",
      tags: ['Daily Conversation'],
      kind: 'reusablePhrase',
      addToSrs: true,
    },
  ],
};
