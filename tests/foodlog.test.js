import { describe, it, expect } from 'vitest';
import { photoStreak, slotNow } from '../src/lib/foodlog.js';

describe('食物打卡', () => {
  it('連續打卡：今天還沒拍不算斷', () => {
    expect(photoStreak(['2026-10-10', '2026-10-11'], '2026-10-12')).toBe(2);
    expect(photoStreak(['2026-10-10', '2026-10-11', '2026-10-12'], '2026-10-12')).toBe(3);
    expect(photoStreak(['2026-10-09', '2026-10-11'], '2026-10-12')).toBe(1);
    expect(photoStreak([], '2026-10-12')).toBe(0);
  });
  it('依時間猜哪一餐，晚上 9 點後還是晚餐', () => {
    expect(slotNow(new Date(2026, 9, 12, 8, 0))).toBe('breakfast');
    expect(slotNow(new Date(2026, 9, 12, 12, 30))).toBe('lunch');
    expect(slotNow(new Date(2026, 9, 12, 22, 0))).toBe('dinner');
  });
});

describe('轉盤打卡', () => {
  it('3 小時內記得轉到什麼，超過就忘了', async () => {
    const store = {};
    globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
    const { rememberSpin, lastSpin, forgetSpin, wheelLabel } = await import('../src/lib/foodlog.js');
    rememberSpin('near', '拉麵一郎', 1000);
    expect(lastSpin(1000 + 2 * 3600e3)).toMatchObject({ source: 'near', name: '拉麵一郎' });
    expect(lastSpin(1000 + 3 * 3600e3 + 1)).toBeNull();
    forgetSpin();
    expect(lastSpin(1001)).toBeNull();
    expect(wheelLabel({ fromWheel: true, wheelSource: 'meals', wheelPick: '雞腿便當' })).toBe('常吃轉盤：雞腿便當');
    expect(wheelLabel({ fromWheel: true })).toBe('轉盤');
    expect(wheelLabel({ fromWheel: false })).toBe('');
  });
});

describe('複評', () => {
  it('店家 id 優先，沒有就用名字', async () => {
    const { reviewKey, reviewOf } = await import('../src/lib/foodlog.js');
    expect(reviewKey({ placeId: 'ChIJabc', name: '拉麵' })).toBe('ChIJabc');
    expect(reviewKey({ name: '阿姨 便當' })).toBe('n_阿姨_便當');
    expect(reviewKey({ name: '' })).toBeNull();
    const reviews = { ChIJabc: { rating: 'bad' }, n_阿姨便當: { rating: 'good' } };
    expect(reviewOf(reviews, { id: 'ChIJabc', name: 'x' }).rating).toBe('bad');
    expect(reviewOf(reviews, { id: 'other', name: '阿姨便當' }).rating).toBe('good');
    expect(reviewOf(reviews, { id: 'zz', name: '沒評過' })).toBeNull();
  });
  it('待複評只問有名字、還沒評、沒跳過的，新的先', async () => {
    const { toReview } = await import('../src/lib/foodlog.js');
    const items = [
      { id: 1, note: 'a', createdAtMs: 1 }, { id: 2, note: 'b', rating: 'good', createdAtMs: 2 }, { id: 3, createdAtMs: 3 },
      { id: 4, wheelPick: 'c', createdAtMs: 4 }, { id: 5, note: 'd', reviewSkipped: true, createdAtMs: 5 },
    ];
    expect(toReview(items).map((i) => i.id)).toEqual([4, 1]);
  });
  it('累計次數、最新評分', async () => {
    const { reviewUpdate } = await import('../src/lib/foodlog.js');
    const a = reviewUpdate(null, { name: '拉麵', placeId: 'p1', rating: 'good', now: 1 });
    const b = reviewUpdate(a, { name: '拉麵', rating: 'bad', now: 2 });
    expect(b).toEqual({ name: '拉麵', placeId: 'p1', rating: 'bad', counts: { good: 1, ok: 0, bad: 1 }, updatedAtMs: 2 });
  });
});

describe('收藏', () => {
  it('只列收藏、分餐廳和飲料', async () => {
    const { favoritesOf, placeInfo } = await import('../src/lib/foodlog.js');
    const reviews = {
      a: { name: '拉麵', fav: true, placeId: 'pa', url: 'u' },
      b: { name: '奶茶', fav: true, kind: 'drink' },
      c: { name: '便當', fav: false, rating: 'bad' },
      n_阿姨: { name: '阿姨', fav: true, rating: 'good' },
    };
    expect(favoritesOf(reviews).map((f) => [f.id, f.name, f.rating])).toEqual(expect.arrayContaining([['n_阿姨', '阿姨', 'good'], ['pa', '拉麵', null]]));
    expect(favoritesOf(reviews)).toHaveLength(2);
    expect(favoritesOf(reviews, 'drink').map((f) => f.name)).toEqual(['奶茶']);
    expect(placeInfo({ id: 'g1', name: 'X', url: 'u', group: '日式' }, 'food')).toEqual({ name: 'X', placeId: 'g1', url: 'u', group: '日式', address: '', kind: 'food' });
  });
});
