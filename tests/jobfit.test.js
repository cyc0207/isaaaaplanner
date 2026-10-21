import { describe, it, expect } from 'vitest';
import { assessJob, jobLinksIn, jobMailPrompt } from '../src/lib/jobFit.js';
import { parseMessage } from '../src/lib/gmail.js';

const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_');

describe('求職信：找職缺連結', () => {
  it('HTML 信的 href 也抓得到，LinkedIn 統一成職缺編號、重複的只留一個', () => {
    const html = '<a href="https://www.linkedin.com/comm/jobs/view/4477362860/?trackingId=x&amp;refId=y">IBM</a>'
      + '<a href="https://www.linkedin.com/comm/jobs/view/4477362860/?trk=2">again</a>'
      + '<a href="https://www.104.com.tw/job/8abcd?jobsource=mail">104</a>'
      + '<a href="https://www.linkedin.com/comm/psettings/email-unsubscribe">unsubscribe</a>'
      + '<a href="https://careers.example.com/jobs/123?utm_source=x">官網</a>';
    const m = parseMessage({ id: '1', payload: { mimeType: 'text/html', body: { data: b64(html) }, headers: [{ name: 'Subject', value: 'Job alert' }] } });
    expect(jobLinksIn(m.links, m.body)).toEqual([
      'https://www.linkedin.com/jobs/view/4477362860/',
      'https://www.104.com.tw/job/8abcd',
      'https://careers.example.com/jobs/123',
    ]);
  });
});

describe('求職信：初步判斷', () => {
  it('數位轉型實習、每週三天 → 建議投', () => {
    const a = assessJob('台灣某公司 數位轉型實習生\n工作內容：需求訪談、流程優化、Power Automate 自動化、跨部門協調。\n每週至少 3 天，2027 年 2 月到職，截止日 12/31。');
    expect(a.verdict).toBe('建議投');
    expect(a.pros.join()).toMatch(/數位轉型/);
    expect(a.unknown).toEqual([]);
  });
  it('要三年保險經驗的約聘 → 先不投，理由講清楚', () => {
    const a = assessJob('Junior Business Analyst (12 months contract)\nRequirements: 3+ years of experience in insurance operations (NB/POS). Fluent in English.');
    expect(a.verdict).toBe('先不投');
    expect(a.cons.join('|')).toMatch(/3 年以上經驗/);
    expect(a.cons.join('|')).toMatch(/約聘/);
    expect(a.cons.join('|')).toMatch(/保險業經驗/);
    expect(a.cons.join('|')).toMatch(/流利英文/);
  });
  it('全職、要 SQL：可以考慮但列出缺口和待確認', () => {
    const a = assessJob('B2C Business Data Analyst 全職\n需熟練 SQL，會 Python、Tableau 加分。負責商業問題分析與儀表板。');
    expect(a.verdict).toBe('可以考慮');
    expect(a.cons.join('|')).toMatch(/SQL/);
    expect(a.cons.join('|')).toMatch(/全職/);
    expect(a.unknown).toContain('到職時間');
  });
  it('跟方向無關 → 先不投；太短 → 資訊不足', () => {
    expect(assessJob('門市銷售人員，負責顧客服務、商品陳列與收銀結帳，排班制，有獎金與員工折扣，歡迎對零售服務有熱忱的你加入我們的團隊。').verdict).toBe('先不投');
    expect(assessJob('新職缺通知').verdict).toBe('資訊不足');
  });
  it('給 Claude 的 prompt 帶條件、連結，提醒不要把 LinkedIn 當官方入口', () => {
    const p = jobMailPrompt('- 2027/02 起', { subject: 'Job alert', from: 'LinkedIn', date: '2026-10-21', body: '內文', jobLinks: ['https://www.linkedin.com/jobs/view/1/'] });
    expect(p).toMatch(/2027\/02 起/);
    expect(p).toMatch(/jobs\/view\/1/);
    expect(p).toMatch(/不要說成官方投遞入口/);
  });
});
