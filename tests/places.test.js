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
