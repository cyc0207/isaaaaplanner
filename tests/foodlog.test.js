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
