import { describe, it, expect } from 'vitest';
import { analyze, cardAffixes, groupByAffix, buildLexicon, segment, lookup } from '../src/lib/affix.js';
import { parseRSS, extractArticle, safeUrl, unwrapLink, cleanTopics } from '../src/lib/feeds.js';
import { pickNewWords, weekTheme, modeOf, MODES, remainingIn, refillPrompt } from '../src/lib/study.js';
import { THEMES } from '../src/data/decks.js';

describe('字首字根字尾', () => {
  it('拆解常見的字', () => {
    const p = (w) => analyze(w).map((a) => `${a.kind}:${a.part}`);
    expect(p('prevention')).toEqual(['prefix:pre', 'root:ven', 'suffix:tion']);
    expect(p('inspector')).toContain('root:spect');
    expect(p('apple')).toEqual([]);
    expect(p('return').includes('prefix:re')).toBe(true);
    expect(p('red')).toEqual([]);
  });
  it('卡片的字根提示也算', () => {
    const keys = cardAffixes({ type: 'word', front: 'suggest', root: 'sug-（下面）+ gest（帶）' }).map((a) => `${a.kind}:${a.part}`);
    expect(keys).toEqual([]); // sug、gest 不在表裡，不亂分
    const k2 = cardAffixes({ type: 'word', front: 'transfer', root: 'trans-（穿越）+ fer（帶）' }).map((a) => `${a.kind}:${a.part}`);
    expect(k2).toEqual(expect.arrayContaining(['prefix:trans', 'root:fer']));
  });
  it('依字首分組，改錯卡不分', () => {
    const cards = [
      { id: 1, type: 'word', front: 'review' }, { id: 2, type: 'word', front: 'refund' }, { id: 3, type: 'word', front: 'predict' },
      { id: 4, type: 'fix', front: 'I am agree', back: 'I agree' },
    ];
    const g = groupByAffix(cards, 'prefix');
    expect(g[0].affix.part).toBe('re');
    expect(g[0].cards.map((c) => c.id)).toEqual([1, 2]);
    expect(groupByAffix(cards, 'root').find((x) => x.affix.part === 'dict').cards[0].id).toBe(3);
  });
});

describe('閱讀標色', () => {
  const lex = buildLexicon([
    { front: 'manage', type: 'word', level: 'known' },
    { front: 'company', type: 'word', level: 'learning' },
    { front: 'interest rate', type: 'phrase', level: 'new' },
    { front: 'I am agree', type: 'fix' },
  ]);
  it('認得詞尾變化', () => {
    expect(lookup(lex, 'managed').front).toBe('manage');
    expect(lookup(lex, 'Managing').front).toBe('manage');
    expect(lookup(lex, 'companies').front).toBe('company');
    expect(lookup(lex, "company's").front).toBe('company');
    expect(lookup(lex, 'banana')).toBeNull();
  });
  it('片語整段標起來，其他字分開', () => {
    const segs = segment('The company raised interest rates, and we managed.', lex);
    const hits = segs.filter((s) => s.card).map((s) => s.text);
    expect(hits).toEqual(['company', 'interest rates', 'managed']);
    expect(segs.map((s) => s.text).join('')).toBe('The company raised interest rates, and we managed.');
  });
});

describe('抓文章', () => {
  it('解析 RSS，拆掉 Bing 轉址', () => {
    const xml = `<rss><channel><item><title><![CDATA[Rates &amp; you]]></title><link>https://www.bing.com/news/apiclick.aspx?ref=x&amp;url=https%3a%2f%2fexample.com%2fa&amp;c=1</link>
      <description>&lt;p&gt;Central banks &lt;b&gt;raised&lt;/b&gt; rates.&lt;/p&gt;</description><pubDate>Thu, 15 Oct 2026 08:00:00 GMT</pubDate><News:Source>Reuters</News:Source></item>
      <item><title>No link</title></item></channel></rss>`;
    const items = parseRSS(xml, 'Bing');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Rates & you', link: 'https://example.com/a', summary: 'Central banks raised rates.', source: 'Reuters' });
    expect(unwrapLink('https://bbc.co.uk/x')).toBe('https://bbc.co.uk/x');
  });
  it('取出文章段落，去掉短句和訂閱字樣', () => {
    const html = `<html><head><title>T</title><script>var x=1</script></head><body><nav><p>Home News Sport and many other links here today</p></nav>
      <article><h1>Big &amp; bold</h1><p>Short one.</p><p>The central bank raised interest rates by a quarter point on Thursday afternoon.</p>
      <p>Sign up for our newsletter to get the latest updates every single morning.</p><p>Analysts expect another rise before the end of the year, said the report.</p></article></body></html>`;
    const a = extractArticle(html);
    expect(a.title).toBe('Big & bold');
    expect(a.text.split('\n\n')).toHaveLength(2);
  });
  it('擋掉內網和奇怪的網址', () => {
    expect(safeUrl('https://www.bbc.com/news/1')).toBe('https://www.bbc.com/news/1');
    expect(safeUrl('http://localhost:3000')).toBeNull();
    expect(safeUrl('http://169.254.169.254/latest')).toBeNull();
    expect(safeUrl('file:///etc/passwd')).toBeNull();
    expect(cleanTopics(' ETF | | IELTS reading ')).toEqual(['ETF', 'IELTS reading']);
  });
});

describe('每天 20 字與考試卡組', () => {
  it('模式與固定卡組', () => {
    expect(modeOf({ mode: 20 })).toBe(20);
    expect(MODES[20].newWords).toBe(20);
    expect(modeOf({})).toBe(15);
    expect(weekTheme({ fixedTheme: 'ielts' }, '2026-10-21')).toBe('ielts');
  });
  it('雅思一天給 20 個，先從題庫最前面（簡單）開始', () => {
    const w = pickNewWords('ielts', [], 20);
    expect(w).toHaveLength(20);
    expect(w[0].front).toBe(THEMES.ielts.words[0].front);
  });
  it('題庫用完先出待學字，再換其他考試卡組', () => {
    const all = THEMES.ielts.words.map((x) => ({ type: x.type, front: x.front }));
    const items = [...all, { id: 'p1', type: 'word', front: 'mitigate', pending: true, deck: 'ielts', createdAtMs: 1 }];
    const w = pickNewWords('ielts', items, 3);
    expect(w[0]).toMatchObject({ front: 'mitigate', pendingId: 'p1' });
    expect(['toeic', 'toefl']).toContain(w[1].deck);
    expect(remainingIn('ielts', items)).toBe(1);
    expect(refillPrompt('ielts', items)).toContain('雅思（IELTS）');
  });
});
