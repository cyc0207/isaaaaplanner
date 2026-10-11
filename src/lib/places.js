// 附近餐廳：Google Places API (New) 的 Nearby Search
// 只要 Pro 等級的欄位（不拿評分、價位、營業時間，那些是 Enterprise，免費額度少很多）

export const PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const FIELDS = [
  'places.id', 'places.displayName', 'places.primaryType', 'places.primaryTypeDisplayName', 'places.types',
  'places.location', 'places.googleMapsUri', 'places.shortFormattedAddress', 'places.businessStatus',
].join(',');
// 只用很早就有的類型；新類型（例如台灣菜）會包含在 restaurant 裡
const INCLUDED = ['restaurant', 'meal_takeaway', 'cafe', 'bakery'];
export const RADII = [500, 1000, 2000];
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

export function normalize(places, here) {
  return (places || [])
    .filter((p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL')
    .map((p) => ({
      id: p.id,
      name: p.displayName?.text || '（沒有名字）',
      group: groupOf(p),
      typeLabel: p.primaryTypeDisplayName?.text || '',
      address: p.shortFormattedAddress || '',
      url: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text || '')}&query_place_id=${p.id}`,
      distance: p.location && here ? distanceM(here, p.location) : null,
    }))
    .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
}

export function groupCounts(list) {
  const m = new Map();
  for (const p of list) m.set(p.group, (m.get(p.group) || 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count }));
}

const cacheKey = (lat, lng, radius) => `planner.places:${lat.toFixed(3)},${lng.toFixed(3)}:${radius}`;

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
export async function searchNearby({ key, latitude, longitude, radius }) {
  const ck = cacheKey(latitude, longitude, radius);
  const cached = readCache(ck);
  if (cached) return { places: cached, cached: true };
  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({
      includedTypes: INCLUDED,
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
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
