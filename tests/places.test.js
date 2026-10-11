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
