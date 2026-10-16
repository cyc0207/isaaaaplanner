// 取出一篇文章的內文，給網站的「閱讀」用
// GET /api/article?url=https://...
import { extractArticle, safeUrl } from '../src/lib/feeds.js';

export default async function handler(req, res) {
  const url = safeUrl(req.query.url);
  if (!url) return res.status(400).json({ error: '網址不正確' });
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; isaaaaplanner-reader/1.0)', Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(200).json({ url, title: '', text: '', error: `原網站回應 ${r.status}` });
    const html = (await r.text()).slice(0, 2_000_000);
    const { title, text } = extractArticle(html);
    res.setHeader('Cache-Control', 's-maxage=86400');
    return res.status(200).json({ url: r.url || url, title, text });
  } catch (e) {
    return res.status(200).json({ url, title: '', text: '', error: '抓不到這篇（可能需要登入或擋了程式）' });
  }
}
