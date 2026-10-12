import { DRINK_GROUPS } from './drinks.js';

// 附近餐廳：Google Places API (New) 的 Nearby Search
// 多拿價位（priceLevel、priceRange）做價格篩選；這兩個是 Enterprise 欄位，每月免費 1,000 次（Pro 是 5,000 次），
// 所以結果照樣快取 6 小時。評分、營業時間不拿。

export const PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby';
export const TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = [
  'places.id', 'places.displayName', 'places.primaryType', 'places.primaryTypeDisplayName', 'places.types',
  'places.location', 'places.googleMapsUri', 'places.shortFormattedAddress', 'places.businessStatus',
  'places.priceLevel', 'places.priceRange',
].join(',');
const PLACE_FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.googleMapsUri';

// 價位分三級；Google 沒標價的歸「未標價」
export const PRICES = [['cheap', '$ 便宜'], ['mid', '$$ 中等'], ['high', '$$$ 貴'], ['none', '未標價']];
const LEVELS = { PRICE_LEVEL_FREE: 'cheap', PRICE_LEVEL_INEXPENSIVE: 'cheap', PRICE_LEVEL_MODERATE: 'mid', PRICE_LEVEL_EXPENSIVE: 'high', PRICE_LEVEL_VERY_EXPENSIVE: 'high' };
export function priceOf(p) {
  const start = Number(p.priceRange?.startPrice?.units);
  const end = Number(p.priceRange?.endPrice?.units);
  const label = start ? (end ? `$${start}–${end}` : `$${start} 以上`) : '';
  let bucket = LEVELS[p.priceLevel];
  if (!bucket && start) bucket = start < 200 ? 'cheap' : start < 500 ? 'mid' : 'high';
  return { price: bucket || 'none', priceLabel: label || (bucket ? PRICES.find(([k]) => k === bucket)[1].split(' ')[0] : '') };
}
// 只用很早就有的類型；新類型（例如台灣菜）會包含在 restaurant 裡
const INCLUDED = ['restaurant', 'meal_takeaway', 'cafe', 'bakery'];
export const RADII = [500, 1000, 2000, 5000, 10000, 20000, 50000];
const CACHE_MS = 6 * 60 * 60 * 1000;

// 依類型分組；越前面越優先
export const GROUPS = [
  ['素食', /vegetarian|vegan/],
  ['早午餐', /breakfast|brunch/],
  ['日式', /japanese|sushi|ramen|izakaya/],
  ['韓式', /korean/],
  ['火鍋', /hot_pot|shabu/],
  ['麵・水餃', /noodle|dumpling/],
  ['東南亞', /thai|vietnamese|indonesian|indian|malaysian|singapore/],
  ['美式・速食', /fast_food|hamburger|american|pizza|sandwich|fried_chicken|chicken/],
  ['西式', /italian|french|steak|western|mediterranean|spanish|mexican|european/],
  ['台式・中式', /taiwanese|chinese|cantonese|asian|buffet|meal_takeaway/],
  ['咖啡・甜點', /cafe|coffee|bakery|dessert|ice_cream|tea|juice|bubble|confectionery|donut/],
];
export const OTHER = '其他';

// 飲料店：名稱和類型一起看
export function drinkGroupOf(place) {
  const s = `${place.primaryType || ''} ${(place.types || []).join(' ')} ${place.displayName?.text || ''}`;
  return DRINK_GROUPS.find(([, re]) => re.test(s))[0];
}

export function groupOf(place) {
  const primary = place.primaryType || '';
  for (const [name, re] of GROUPS) if (re.test(primary)) return name;
  const all = (place.types || []).join(' ');
  for (const [name, re] of GROUPS) if (re.test(all)) return name;
  return OTHER;
}

export function distanceM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function normalize(places, here, kind = 'food', radius = null) {
  return (places || [])
    .filter((p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL')
    .map((p) => ({
      id: p.id,
      name: p.displayName?.text || '（沒有名字）',
      group: kind === 'drink' ? drinkGroupOf(p) : groupOf(p),
      typeLabel: p.primaryTypeDisplayName?.text || '',
      address: p.shortFormattedAddress || '',
      url: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text || '')}&query_place_id=${p.id}`,
      distance: p.location && here ? distanceM(here, p.location) : null,
      ...priceOf(p),
    }))
    .filter((p) => !radius || p.distance == null || p.distance <= radius)
    .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
}

// 「再抓一批」：在範圍內隨機挑一點，用小一點的半徑再找 20 家，跟原本的合併
export function randomPointIn(center, radius, rnd = Math.random) {
  const d = radius * 0.75 * Math.sqrt(rnd());
  const t = 2 * Math.PI * rnd();
  const dLat = (d * Math.cos(t)) / 111320;
  const dLng = (d * Math.sin(t)) / (111320 * Math.cos((center.latitude * Math.PI) / 180));
  return { latitude: center.latitude + dLat, longitude: center.longitude + dLng };
}
export const subRadius = (r) => Math.max(500, Math.round(r / 3));
// 每次找都在範圍內隨機挑一個中心，找它最近的 20 家，所以每次進來的店都不一樣
export function randomArea(center, r, rnd = Math.random) {
  if (r <= 1000) return { ...randomPointIn(center, r * 0.5, rnd), radius: r };
  return { ...randomPointIn(center, r, rnd), radius: Math.max(1000, subRadius(r)) };
}
export function mergePlaces(list, more) {
  const seen = new Set(list.map((p) => p.id));
  const added = more.filter((p) => !seen.has(p.id) && seen.add(p.id));
  return { list: [...list, ...added].sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9)), added: added.length };
}

// 從清單隨機挑 n 個；同一個 seed 結果固定，畫面重畫不會一直換
export function sample(list, n, seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export function groupCounts(list) {
  const m = new Map();
  for (const p of list) m.set(p.group, (m.get(p.group) || 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count }));
}

const cacheKey = (lat, lng, radius, kind) => `planner.places:${kind}:${lat.toFixed(3)},${lng.toFixed(3)}:${radius}`;

function readCache(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    if (v && Date.now() - v.at < CACHE_MS) return v.places;
  } catch {
    // 無痕模式等情況讀不到快取，直接重抓
  }
  return null;
}

function writeCache(key, places) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), places }));
  } catch {
    // 存不進去就算了
  }
}

// 同一個位置 6 小時內不重抓，省額度
// 飲料店用 Text Search：手搖飲在 Google 地圖的類型很雜，用關鍵字找比較準
async function fetchDrinks({ key, latitude, longitude, radius }) {
  const res = await fetch(TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({
      textQuery: '飲料店 手搖飲 咖啡',
      pageSize: 20,
      rankPreference: radius <= 1000 ? 'DISTANCE' : 'RELEVANCE',
      languageCode: 'zh-TW',
      regionCode: 'TW',
      locationBias: { circle: { center: { latitude, longitude }, radius } },
    }),
  });
  return res;
}

export async function searchNearby({ key, latitude, longitude, radius, kind = 'food', rank = null }) {
  const ck = cacheKey(latitude, longitude, radius, kind);
  const cached = readCache(ck);
  if (cached) return { places: cached, cached: true };
  const res = kind === 'drink' ? await fetchDrinks({ key, latitude, longitude, radius }) : await fetch(PLACES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({
      includedTypes: INCLUDED,
      maxResultCount: 20,
      // 一次最多 20 家：近的範圍抓最近的，遠的範圍抓比較熱門的，才不會都擠在旁邊
      rankPreference: rank || (radius <= 1000 ? 'DISTANCE' : 'POPULARITY'),
      languageCode: 'zh-TW',
      regionCode: 'TW',
      locationRestriction: { circle: { center: { latitude, longitude }, radius } },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  writeCache(ck, body.places || []);
  return { places: body.places || [], cached: false };
}

// 查到的是一條路（Google 類型 route，或名字是「…路／街／大道／巷／段」）
export function isRoad(p) {
  return (p.types || []).includes('route') || /(路|街|大道|巷|段)$/.test(p.displayName?.text || '');
}

// 地址在這條路上嗎：「永康街6號」「106台北市大安區永康街6號」都算
export function onRoad(address, road) {
  return !!road && !!address && address.includes(road);
}

// 沿著一條路找：Text Search 一次一組關鍵字最多 60 家，所以換好幾組關鍵字找，
// 再只留餐飲類、地址在這條路上的。一批用 3 組，按「再抓一批」換下 3 組。
export const ROAD_KEYWORDS = {
  food: [
    '餐廳', '小吃', '便當 自助餐', '早餐 早午餐', '麵 水餃', '燒臘 飯', '健康餐 沙拉', '素食',
    '拉麵 日式', '韓式', '火鍋', '燒肉 牛排', '義大利麵 西式', '炸雞 漢堡', '鹹酥雞 滷味', '咖啡 甜點', '泰式 越南', '粥 宵夜',
  ],
  drink: ['飲料店', '手搖飲', '咖啡', '果汁 茶'],
};
export const ROAD_BATCH = 3;

// Text Search 用關鍵字找，會混進按摩店、診所這種：只留餐飲類
const FOOD_TYPES = /restaurant|^food$|meal_|cafe|coffee|bakery|dessert|confectioner|ice_cream|juice|tea|bar$|bistro|diner|deli|sandwich|snack|food_court|cafeteria/;
export function isFoodPlace(p) {
  return [p.primaryType, ...(p.types || [])].some((t) => t && FOOD_TYPES.test(t));
}

async function textAll({ key, textQuery, latitude, longitude, fetchPage }) {
  const ck = `planner.places:text:${textQuery}:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = readCache(ck);
  if (cached) return cached;
  const all = [];
  let pageToken;
  for (let i = 0; i < 3; i++) {
    const res = await fetchPage(TEXT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': `${FIELDS},nextPageToken` },
      body: JSON.stringify({
        textQuery,
        pageSize: 20,
        languageCode: 'zh-TW',
        regionCode: 'TW',
        locationBias: { circle: { center: { latitude, longitude }, radius: 2000 } },
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
    all.push(...(body.places || []));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  writeCache(ck, all);
  return all;
}

export async function searchAlong({ key, road, latitude, longitude, kind = 'food', batch = 0, fetchPage = fetch }) {
  const words = ROAD_KEYWORDS[kind] || ROAD_KEYWORDS.food;
  const these = words.slice(batch * ROAD_BATCH, (batch + 1) * ROAD_BATCH);
  const seen = new Set();
  const places = [];
  for (const w of these) {
    for (const p of await textAll({ key, textQuery: `${road} ${w}`, latitude, longitude, fetchPage })) {
      if (seen.has(p.id) || !isFoodPlace(p) || !onRoad(p.shortFormattedAddress || p.formattedAddress, road)) continue;
      seen.add(p.id);
      places.push(p);
    }
  }
  return { places, words: these, more: (batch + 1) * ROAD_BATCH < words.length };
}

// 輸入街道、地址或地標，找出它的位置（用同一把 Places 金鑰的 Text Search，不用另外開 Geocoding）
export async function findPlace({ key, text }) {
  const q = text.trim();
  const ck = `planner.placefind2:${q}`;
  const cached = readCache(ck);
  if (cached) return cached;
  const res = await fetch(TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACE_FIELDS },
    body: JSON.stringify({ textQuery: q, pageSize: 5, languageCode: 'zh-TW', regionCode: 'TW' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const found = (body.places || []).filter((p) => p.location).map((p) => ({
    id: p.id,
    label: p.displayName?.text || q,
    address: p.formattedAddress || '',
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    road: isRoad(p) ? p.displayName?.text || q : null,
    // 查的是一家吃的店，就可以直接收藏
    food: isFoodPlace(p),
    name: p.displayName?.text || q,
    url: p.googleMapsUri || '',
    group: groupOf(p),
  }));
  writeCache(ck, found);
  return found;
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('這個瀏覽器不能定位'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? '沒有允許定位。到瀏覽器設定打開這個網站的位置權限。' : '定位失敗，等一下再試。')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
