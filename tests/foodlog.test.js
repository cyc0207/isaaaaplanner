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
