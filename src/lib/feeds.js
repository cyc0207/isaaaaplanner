// 抓英文文章用：解析 RSS、從網頁取出內文。前端和 /api 的函式共用，沒有用到瀏覽器或 Node 專屬的東西

export const DEFAULT_FEEDS = [
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Guardian Money', url: 'https://www.theguardian.com/money/rss' },
  { name: 'Guardian Business', url: 'https://www.theguardian.com/business/rss' },
  { name: 'CNBC Finance', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
];

export const topicFeed = (q) => ({
  name: `搜尋：${q}`,
  url: `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=en-US&cc=US`,
  topic: q,
});

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…' };
export const decode = (s) =>
  (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9#]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m);

const strip = (s) => decode(decode(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const tag = (xml, name) => (new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml) || [])[1] || '';

// Bing 的連結會包一層轉址，取出真正的網址
export function unwrapLink(link) {
  try {
    const u = new URL(link);
    if (/bing\.com$/.test(u.hostname) && u.searchParams.get('url')) return u.searchParams.get('url');
  } catch {
    /* 不是網址 */
  }
  return link;
}

export function parseRSS(xml, source = '') {
  const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const it = m[0];
    const link = unwrapLink(strip(tag(it, 'link')) || strip(tag(it, 'guid')));
    const title = strip(tag(it, 'title'));
    if (!title || !/^https?:\/\//.test(link)) continue;
    const date = Date.parse(strip(tag(it, 'pubDate'))) || 0;
    items.push({ title, link, date, summary: strip(tag(it, 'description')).slice(0, 400), source: strip(tag(it, 'News:Source')) || source });
  }
  return items;
}

// 從文章網頁取出段落：優先 <article> 裡的 <p>，去掉太短的（按鈕、版權宣告）
export function extractArticle(html) {
  const clean = html.replace(/<(script|style|noscript|svg|figure|aside|nav|footer|header|form)[\s\S]*?<\/\1>/gi, '');
  const title = strip(tag(clean, 'h1')) || strip(tag(clean, 'title'));
  const scope = tag(clean, 'article') || clean;
  const paras = [...scope.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)]
    .map((m) => strip(m[0]))
    .filter((p) => p.split(' ').length >= 8 && !/cookie|subscribe|sign up|newsletter|all rights reserved|©/i.test(p));
  return { title, text: paras.join('\n\n').slice(0, 12000) };
}

// 不讓 /api/article 去抓內網或本機
export function safeUrl(s) {
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname;
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^[\d.]+$/.test(h) || h.includes(':')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const cleanTopics = (s) =>
  (s || '')
    .split('|')
    .map((x) => x.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 6);
