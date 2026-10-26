import { toStr, isValidDateStr } from './date.js';

// Gmail 搜尋語法：https://support.google.com/mail/answer/7190
export const DEFAULT_QUERIES = {
  competition: '(比賽 OR 競賽 OR 徵件 OR 徵選 OR 黑客松 OR 提案 OR hackathon OR competition OR contest) newer_than:60d',
  english: '',
  jobs: '(from:jobalerts-noreply@linkedin.com OR from:jobs-noreply@linkedin.com OR from:jobs-listings@linkedin.com OR from:104.com.tw OR from:cake.me OR from:cakeresume.com OR from:yourator.co OR from:1111.com.tw OR 職缺 OR 徵才 OR 招募 OR 應徵 OR "job alert" OR internship OR 實習生) -subject:比賽 newer_than:30d',
};

export const BOXES = { competition: '比賽', english: '英文信', jobs: '求職信' };

export const gmailLink = (msg, email) =>
  `https://mail.google.com/mail/${email ? `?authuser=${encodeURIComponent(email)}` : 'u/0/'}#all/${msg.threadId || msg.id}`;

function b64urlDecode(data, charset = 'utf-8') {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function htmlToText(html) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 從 Gmail API 的 message（format=full）取出標題、寄件者、日期和純文字內文
export function parseMessage(m) {
  const headers = Object.fromEntries((m.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
  let plain = '';
  let html = '';
  const walk = (p) => {
    if (!p) return;
    const charset = (/charset="?([^";]+)/i.exec(p.headers?.find((h) => h.name.toLowerCase() === 'content-type')?.value || '') || [])[1];
    if (p.body?.data && p.mimeType === 'text/plain' && !plain) plain = b64urlDecode(p.body.data, charset);
    else if (p.body?.data && p.mimeType === 'text/html' && !html) html = b64urlDecode(p.body.data, charset);
    (p.parts || []).forEach(walk);
  };
  walk(m.payload);
  // HTML 信轉成文字會丟掉網址，先把連結抓出來（職缺信靠這個找到職缺頁）
  const links = [];
  for (const r of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) links.push(r[1].replace(/&amp;/g, '&'));
  for (const r of plain.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) links.push(r[0]);
  const ts = Number(m.internalDate) || Date.parse(headers.date) || Date.now();
  return {
    id: m.id,
    threadId: m.threadId,
    subject: headers.subject || '（沒有標題）',
    from: (headers.from || '').replace(/\s*<[^>]+>$/, '').replace(/^"|"$/g, '') || headers.from || '',
    fromAddr: (/<([^>]+)>/.exec(headers.from || '') || [])[1] || headers.from || '',
    ts,
    date: toStr(new Date(ts)),
    snippet: htmlToText(m.snippet || ''),
    body: (plain || htmlToText(html)).trim(),
    links: [...new Set(links.filter((u) => /^https?:\/\//.test(u)))],
  };
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const KEYWORD = /截止|期限|報名至|收件至|收件日|繳交|deadline|due|until|before|apply by|submit by|以前|之前|止/i;

// 從比賽信裡猜報名截止日：找關鍵字附近、在今天之後的日期，取最早的
export function guessDeadline(text, t) {
  if (!text) return '';
  const y0 = Number(t.slice(0, 4));
  const found = [];
  const push = (y, m, d, index, len) => {
    const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (isValidDateStr(s)) found.push({ s, index, len });
  };
  const yearOf = (m, d) => {
    const s = `${y0}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return s < t ? y0 + 1 : y0;
  };
  let r;
  const full = /(20\d\d)\s*[/.\-年]\s*(\d{1,2})\s*[/.\-月]\s*(\d{1,2})/g;
  while ((r = full.exec(text))) push(+r[1], +r[2], +r[3], r.index, r[0].length);
  const roc = /(1[1-2]\d)\s*[/.年]\s*(\d{1,2})\s*[/.月]\s*(\d{1,2})/g; // 民國年
  while ((r = roc.exec(text))) push(+r[1] + 1911, +r[2], +r[3], r.index, r[0].length);
  const md = /(?<![\d/.年])(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})(?![\d/])/g;
  while ((r = md.exec(text))) {
    if (found.some((f) => r.index >= f.index && r.index < f.index + f.len)) continue;
    push(yearOf(+r[1], +r[2]), +r[1], +r[2], r.index, r[0].length);
  }
  const en = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d\d))?/gi;
  while ((r = en.exec(text))) {
    const m = MONTHS[r[1].toLowerCase()];
    push(r[3] ? +r[3] : yearOf(m, +r[2]), m, +r[2], r.index, r[0].length);
  }
  const near = found.filter(({ index, len }) => KEYWORD.test(text.slice(Math.max(0, index - 30), index + len + 12)));
  const future = near.map((f) => f.s).filter((s) => s >= t).sort();
  return future[0] || '';
}

// ---- 呼叫 Gmail API（只讀）----

async function api(token, path) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = j.error?.message || msg;
    } catch {
      /* 不是 JSON */
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function searchIds(token, q, max = 25) {
  const j = await api(token, `messages?maxResults=${max}&q=${encodeURIComponent(q)}`);
  return (j.messages || []).map((m) => m.id);
}

export async function getMessage(token, id) {
  return parseMessage(await api(token, `messages/${id}?format=full`));
}
