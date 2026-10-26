import { describe, it, expect } from 'vitest';
import { buildEnglishPreview, extractCSV, review, dueItems, normType, toEnglishCSV } from '../src/lib/english.js';
import { parseMessage, guessDeadline, htmlToText } from '../src/lib/gmail.js';

const b64 = (s) => Buffer.from(s, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('英文匯入', () => {
  it('從 ChatGPT 回覆裡挖出 CSV，標出新的、重複、有錯', () => {
    const text = [
      '好的，以下是整理：',
      '```csv',
      'type,front,back,example,tags,source,note',
      'word,deadline,截止日期,The deadline is Friday.,email|比賽,chat,',
      'Phrase,"look forward to","期待",,email,memory,',
      'fix,"I am agree.","I agree.",,文法,chat,',
      'word,Deadline,重複,,,chat,',
      'poem,x,y,,,,',
      '```',
      '總共 5 筆',
    ].join('\n');
    const p = buildEnglishPreview(text, [{ type: 'fix', front: 'I am agree.' }]);
    expect(p.error).toBeNull();
    expect(p.rows.map((r) => r.status)).toEqual(['ok', 'ok', 'duplicate', 'duplicate', 'error']);
    expect(p.rows[0].tags).toEqual(['email', '比賽']);
    expect(p.rows[1].type).toBe('phrase');
  });
  it('沒有表頭就報錯', () => {
    expect(buildEnglishPreview('hello,world', []).error).toBeTruthy();
  });
  it('認得中文的 type', () => {
    expect(normType('單字')).toBe('word');
    expect(normType('resources')).toBe('link');
  });
  it('extractCSV 沒有 code block 也可以', () => {
    expect(extractCSV('type,front\nword,a')).toBe('type,front\nword,a');
  });
  it('匯出的 tags 用 | 接起來', () => {
    expect(toEnglishCSV([{ type: 'word', front: 'a', tags: ['x', 'y'] }])).toContain('word,a,,,x|y');
  });
});

describe('間隔複習', () => {
  it('記得往後一格，忘了回第一格明天再來', () => {
    const a = review({ box: 2, reps: 3, lapses: 0 }, true, '2026-10-11');
    expect(a).toMatchObject({ box: 3, due: '2026-10-18', reps: 4 });
    const b = review({ box: 4 }, false, '2026-10-11');
    expect(b).toMatchObject({ box: 0, due: '2026-10-12', lapses: 1 });
  });
  it('今天到期的才出現，資源連結不練', () => {
    const items = [
      { id: 'a', type: 'word', front: 'a', due: '2026-10-11' },
      { id: 'b', type: 'word', front: 'b', due: '2026-10-12' },
      { id: 'c', type: 'link', front: 'c', due: '2026-10-01' },
      { id: 'd', type: 'word', front: 'd', due: '2026-10-01' },
    ];
    expect(dueItems(items, '2026-10-11').map((x) => x.id)).toEqual(['d', 'a']);
  });
});

describe('Gmail', () => {
  it('解析 multipart 信件，取純文字內文', () => {
    const m = parseMessage({
      id: 'm1', threadId: 't1', internalDate: String(new Date(2026, 9, 10, 9).getTime()), snippet: 'Hi &amp; welcome',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [{ name: 'Subject', value: '2026 創新創業競賽' }, { name: 'From', value: '"教育部" <a@b.tw>' }],
        parts: [
          { mimeType: 'text/plain', body: { data: b64('報名截止：2026/11/30\n歡迎參加') } },
          { mimeType: 'text/html', body: { data: b64('<p>html</p>') } },
        ],
      },
    });
    expect(m).toMatchObject({ subject: '2026 創新創業競賽', from: '教育部', fromAddr: 'a@b.tw', date: '2026-10-10', snippet: 'Hi & welcome' });
    expect(m.body).toBe('報名截止：2026/11/30\n歡迎參加');
  });
  it('只有 HTML 就轉成文字', () => {
    expect(htmlToText('<style>x</style><p>Hello<br>World</p>')).toBe('Hello\nWorld');
  });
  it('猜截止日：關鍵字附近、今天之後最早的', () => {
    const t = '2026-10-11';
    expect(guessDeadline('活動日期 2026/12/20。報名截止日 2026/11/30', t)).toBe('2026-11-30');
    expect(guessDeadline('即日起至 11月5日 止受理報名', t)).toBe('2026-11-05');
    expect(guessDeadline('Applications due Nov 3, 2026', t)).toBe('2026-11-03');
    expect(guessDeadline('收件至 116年1月15日', t)).toBe('2027-01-15');
    expect(guessDeadline('截止 3/1', t)).toBe('2027-03-01');
    expect(guessDeadline('上次活動 2026/12/01 很成功', t)).toBe('');
    expect(guessDeadline('報名截止 2026/09/01', t)).toBe('');
  });
});

import { buildInboxPreview, normDate } from '../src/lib/inbox.js';

describe('收件匣匯入', () => {
  it('認得中文類型、修日期、不合法的進度改成預設、重複的不勾', () => {
    const text = [
      '```',
      'kind,title,company,deadline,submitDate,url,status,note',
      '比賽,創新創業競賽,教育部,2026/11/30,2026-12-15,https://a.tw,要報,',
      'resume,行銷實習生,某公司,下週五,,not-a-url,亂寫,',
      'competition,舊比賽,,,,,,',
      'job?,x,,,,,,',
      '```',
    ].join('\n');
    const p = buildInboxPreview(text, [{ kind: 'competition', title: '舊比賽' }]);
    expect(p.error).toBeNull();
    expect(p.rows.map((r) => r.status_)).toEqual(['ok', 'ok', 'duplicate', 'error']);
    expect(p.rows[0]).toMatchObject({ kind: 'competition', deadline: '2026-11-30', submitDate: '2026-12-15', status: '要報', url: 'https://a.tw' });
    expect(p.rows[1]).toMatchObject({ kind: 'resume', deadline: '', status: '未確認', url: '' });
    expect(p.rows[1].warnings.length).toBe(1);
  });
  it('normDate', () => {
    expect(normDate('2026年1月5日')).toBe('2026-01-05');
    expect(normDate('2026-02-30')).toBeNull();
    expect(normDate('')).toBe('');
  });
});

import { THEMES } from '../src/data/decks.js';
import { weekTheme, pickNewWords, cloze, isCorrect, pickMode, reviewModes, deckToItem } from '../src/lib/study.js';

describe('內建卡組與每日練習', () => {
  it('卡組每行都有六欄、沒有重複', () => {
    for (const { words } of Object.values(THEMES)) {
      expect(words.length).toBeGreaterThan(50);
      for (const w of words) {
        expect(w.front && w.back && w.example, w.front).toBeTruthy();
        expect(w.collocation, w.front).toBeTruthy();
      }
      expect(new Set(words.map((w) => w.front.toLowerCase())).size).toBe(words.length);
    }
  });
  it('大部分例句可以挖空', () => {
    const all = Object.values(THEMES).flatMap((x) => x.words);
    const ok = all.filter((w) => cloze(w.example, w.front)).length;
    expect(ok / all.length).toBeGreaterThan(0.8);
  });
  it('每週主題輪替，可以手動換本週', () => {
    expect(weekTheme({}, '2026-10-12')).toBe('life');
    expect(weekTheme({}, '2026-10-21')).toBe('work');
    expect(weekTheme({}, '2026-10-26')).toBe('finance');
    expect(weekTheme({}, '2026-11-02')).toBe('life');
    expect(weekTheme({}, '2026-10-05')).toBe('finance');
    expect(weekTheme({ theme: 'finance', themeWeek: '2026-10-12' }, '2026-10-14')).toBe('finance');
    expect(weekTheme({ theme: 'finance', themeWeek: '2026-10-12' }, '2026-10-20')).toBe('work');
  });
  it('新字跳過已經有的，主題用完從別的主題補', () => {
    const first = THEMES.life.words[0];
    const items = [{ type: first.type, front: first.front.toUpperCase() }];
    const picked = pickNewWords('life', items, 3);
    expect(picked.map((w) => w.front)).toEqual(THEMES.life.words.slice(1, 4).map((w) => w.front));
    const allLife = THEMES.life.words.map((w) => ({ type: w.type, front: w.front }));
    expect(pickNewWords('life', allLife, 2)[0].deck).toBe('work');
  });
  it('挖空允許字尾變化，片語整段', () => {
    expect(cloze('We managed to finish.', 'manage')).toMatchObject({ answer: 'managed', before: 'We ', after: ' to finish.' });
    expect(cloze("I'm looking forward to it.", 'look forward to')).toBeNull();
    expect(cloze('We need to meet the deadline.', 'deadline').answer).toBe('deadline');
    expect(isCorrect(' Managed ', ['managed'])).toBe(true);
    expect(isCorrect('manage', ['managed', 'manage'])).toBe(true);
  });
  it('第一次翻卡，之後輪流其他方式；改錯卡只翻卡', () => {
    const w = deckToItem(THEMES.work.words[0], '2026-10-11');
    expect(w).toMatchObject({ introducedOn: '2026-10-11', due: '2026-10-11', deck: 'work' });
    expect(pickMode(w)).toBe('flip');
    expect(reviewModes(w)).toEqual(['flip', 'cloze', 'spell']);
    expect(reviewModes({ type: 'fix', front: 'I am agree', back: 'I agree' })).toEqual(['flip']);
  });
});
