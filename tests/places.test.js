import { describe, it, expect } from 'vitest';
import { groupOf, normalize, groupCounts, distanceM } from '../src/lib/places.js';

describe('附近餐廳分類', () => {
  it('先看主要類型，再看其他類型', () => {
    expect(groupOf({ primaryType: 'ramen_restaurant', types: ['restaurant'] })).toBe('日式');
    expect(groupOf({ primaryType: 'taiwanese_restaurant' })).toBe('台式・中式');
    expect(groupOf({ primaryType: 'restaurant', types: ['vegetarian_restaurant', 'restaurant'] })).toBe('素食');
    expect(groupOf({ primaryType: 'coffee_shop' })).toBe('咖啡・甜點');
    expect(groupOf({ primaryType: 'hamburger_restaurant' })).toBe('美式・速食');
    expect(groupOf({ primaryType: 'restaurant', types: ['restaurant', 'food'] })).toBe('其他');
  });
  it('過濾歇業、算距離、由近到遠', () => {
    const here = { latitude: 25.0330, longitude: 121.5654 };
    const list = normalize([
      { id: 'far', displayName: { text: '遠的' }, primaryType: 'ramen_restaurant', location: { latitude: 25.0420, longitude: 121.5654 } },
      { id: 'closed', displayName: { text: '倒了' }, businessStatus: 'CLOSED_PERMANENTLY', location: here },
      { id: 'near', displayName: { text: '近的' }, primaryType: 'thai_restaurant', location: { latitude: 25.0335, longitude: 121.5654 } },
    ], here);
    expect(list.map((p) => p.id)).toEqual(['near', 'far']);
    expect(list[0].distance).toBe(56);
    expect(list[1].distance).toBe(1001);
    expect(groupCounts(list)).toEqual([{ name: '東南亞', count: 1 }, { name: '日式', count: 1 }]);
    expect(list[0].url).toContain('query_place_id=near');
  });
  it('距離公式', () => {
    expect(distanceM({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBe(111195);
  });
});

describe('priceOf', () => {
  it('有 priceLevel 用它分級，有 priceRange 顯示金額', async () => {
    const { priceOf } = await import('../src/lib/places.js');
    expect(priceOf({ priceLevel: 'PRICE_LEVEL_INEXPENSIVE', priceRange: { startPrice: { units: '1' }, endPrice: { units: '200' } } })).toEqual({ price: 'cheap', priceLabel: '$1–200' });
    expect(priceOf({ priceLevel: 'PRICE_LEVEL_EXPENSIVE' })).toEqual({ price: 'high', priceLabel: '$$$' });
    expect(priceOf({ priceRange: { startPrice: { units: '400' }, endPrice: { units: '600' } } })).toEqual({ price: 'mid', priceLabel: '$400–600' });
    expect(priceOf({ priceRange: { startPrice: { units: '1000' } } })).toEqual({ price: 'high', priceLabel: '$1000 以上' });
    expect(priceOf({})).toEqual({ price: 'none', priceLabel: '' });
  });
});

describe('隨機再抓一批', () => {
  it('隨機點落在範圍 75% 內', async () => {
    const { randomPointIn, distanceM } = await import('../src/lib/places.js');
    const c = { latitude: 25.03, longitude: 121.56 };
    for (let i = 0; i < 200; i++) expect(distanceM(c, randomPointIn(c, 10000))).toBeLessThanOrEqual(7600);
  });
  it('合併時去掉重複、照距離排', async () => {
    const { mergePlaces } = await import('../src/lib/places.js');
    const r = mergePlaces([{ id: 'a', distance: 50 }, { id: 'b', distance: 300 }], [{ id: 'b', distance: 300 }, { id: 'c', distance: 100 }, { id: 'c', distance: 100 }]);
    expect(r.added).toBe(1);
    expect(r.list.map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });
  it('sample 同 seed 結果固定、不同 seed 會換', async () => {
    const { sample } = await import('../src/lib/places.js');
    const list = Array.from({ length: 40 }, (_, i) => i);
    expect(sample(list, 12, 7)).toEqual(sample(list, 12, 7));
    expect(sample(list, 12, 7)).toHaveLength(12);
    expect(new Set(sample(list, 12, 7)).size).toBe(12);
    expect(sample(list, 12, 7)).not.toEqual(sample(list, 12, 8));
  });
});

describe('只要這條路上的店', () => {
  it('只留吃的：按摩、診所不算', async () => {
    const { isFoodPlace } = await import('../src/lib/places.js');
    expect(isFoodPlace({ primaryType: 'cantonese_restaurant' })).toBe(true);
    expect(isFoodPlace({ types: ['food', 'store'] })).toBe(true);
    expect(isFoodPlace({ primaryType: 'tea_house' })).toBe(true);
    expect(isFoodPlace({ primaryType: 'massage', types: ['spa', 'health'] })).toBe(false);
    expect(isFoodPlace({ primaryType: 'dentist', types: ['health'] })).toBe(false);
  });
  it('認得出路名', async () => {
    const { isRoad } = await import('../src/lib/places.js');
    expect(isRoad({ types: ['route'], displayName: { text: 'X' } })).toBe(true);
    expect(isRoad({ displayName: { text: '忠孝東路四段' } })).toBe(true);
    expect(isRoad({ displayName: { text: '永康街' } })).toBe(true);
    expect(isRoad({ types: ['tourist_attraction'], displayName: { text: '台北101' } })).toBe(false);
  });
  it('翻頁抓完只留地址在那條路上的', async () => {
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const { searchAlong } = await import('../src/lib/places.js');
    const pages = [
      { places: [{ id: 'a', types: ['restaurant'], shortFormattedAddress: '永康街6號' }, { id: 'b', types: ['restaurant'], shortFormattedAddress: '信義路二段1號' }, { id: 'm', primaryType: 'massage', types: ['spa', 'health'], shortFormattedAddress: '永康街9號' }], nextPageToken: 't2' },
      { places: [{ id: 'c', primaryType: 'chinese_restaurant', formattedAddress: '106台北市大安區永康街31巷2號' }] },
    ];
    const bodies = [];
    const fetchPage2 = async (url, init) => {
      const b = JSON.parse(init.body); bodies.push(b);
      if (b.textQuery === '永康街 小吃') return { ok: true, json: async () => ({ places: [{ id: 'a', types: ['restaurant'], shortFormattedAddress: '永康街6號' }, { id: 'd', types: ['meal_takeaway', 'food'], shortFormattedAddress: '永康街8號' }] }) };
      return { ok: true, json: async () => (b.pageToken ? pages[1] : pages[0]) };
    };
    const r = await searchAlong({ key: 'k', road: '永康街', latitude: 25, longitude: 121, fetchPage: fetchPage2 });
    expect(r.places.map((p) => p.id)).toEqual(['a', 'c', 'd']);
    expect(bodies.map((b) => b.textQuery)).toEqual(['永康街 餐廳', '永康街 餐廳', '永康街 小吃', '永康街 便當 自助餐', '永康街 便當 自助餐']);
    expect(bodies[1].pageToken).toBe('t2');
    expect(r.more).toBe(true);
    const last = await searchAlong({ key: 'k', road: '永康街', latitude: 25, longitude: 121, batch: 5, fetchPage: fetchPage2 });
    expect(last.words).toEqual(['咖啡 甜點', '泰式 越南', '粥 宵夜']);
    expect(last.more).toBe(false);
  });
});

describe('每次隨機進來', () => {
  it('小範圍：中心在半徑一半內、用整個半徑；大範圍：中心在範圍內、半徑至少 1 公里', async () => {
    const { randomArea, distanceM } = await import('../src/lib/places.js');
    const c = { latitude: 25.03, longitude: 121.56 };
    for (let i = 0; i < 100; i++) {
      const a = randomArea(c, 1000);
      expect(a.radius).toBe(1000);
      expect(distanceM(c, a)).toBeLessThanOrEqual(380);
      const b = randomArea(c, 20000);
      expect(b.radius).toBe(6667);
      expect(distanceM(c, b)).toBeLessThanOrEqual(15100);
    }
  });
});
