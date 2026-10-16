// Vercel 免費方案的 Serverless Function：抓英文金融新聞 RSS，加上使用者自己想看的主題
// GET /api/articles?topics=wealth%20management|interest%20rates&feeds=1
import { DEFAULT_FEEDS, topicFeed, parseRSS, cleanTopics } from '../src/lib/feeds.js';

const UA = 'Mozilla/5.0 (compatible; isaaaaplanner-reader/1.0)';

async function getFeed(feed, n) {
  try {
    const res = await fetch(feed.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    return parseRSS(await res.text(), feed.name)
      .slice(0, n)
      .map((it) => ({ ...it, feed: feed.name, topic: feed.topic || '' }));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const topics = cleanTopics(req.query.topics);
  const feeds = [...(req.query.feeds === '0' ? [] : DEFAULT_FEEDS.map((f) => [f, 3])), ...topics.map((q) => [topicFeed(q), 4])];
  const lists = await Promise.all(feeds.map(([f, n]) => getFeed(f, n)));
  const seen = new Set();
  const items = lists.flat().filter((it) => !seen.has(it.link) && seen.add(it.link));
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  res.status(200).json({ items, fetchedAt: Date.now() });
}
