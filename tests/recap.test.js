import { describe, it, expect } from 'vitest';
import { pickPhotos, gridFor, weekStats } from '../src/lib/recap.js';

const it_ = (id, date, extra = {}) => ({ id, date, slot: 'dinner', createdAtMs: Number(id.slice(1)), ...extra });

describe('recap', () => {
  it('照片少於格子就全放、照日期排', () => {
    expect(pickPhotos([it_('a2', '2026-10-13'), it_('a1', '2026-10-12')], 4).map((p) => p.id)).toEqual(['a1', 'a2']);
  });
  it('照片太多時每天輪流挑', () => {
    const items = [it_('a1', '2026-10-12'), it_('a2', '2026-10-12'), it_('a3', '2026-10-12'), it_('b1', '2026-10-13'), it_('c1', '2026-10-14')];
    expect(pickPhotos(items, 4).map((p) => p.id)).toEqual(['a1', 'a2', 'b1', 'c1']);
  });
  it('格子只用需要的列數', () => {
    expect(gridFor(1, 'square')).toEqual({ cols: 1, rows: 1 });
    expect(gridFor(3, 'square')).toEqual({ cols: 2, rows: 2 });
    expect(gridFor(6, 'square')).toEqual({ cols: 3, rows: 2 });
    expect(gridFor(20, 'square')).toEqual({ cols: 3, rows: 3 });
    expect(gridFor(2, 'story')).toEqual({ cols: 1, rows: 2 });
    expect(gridFor(6, 'story')).toEqual({ cols: 2, rows: 3 });
    expect(gridFor(20, 'story')).toEqual({ cols: 3, rows: 4 });
  });
  it('一週統計', () => {
    const s = weekStats([it_('a1', '2026-10-12', { fromWheel: true, rating: 'good' }), it_('a2', '2026-10-12', { slot: 'lunch' }), it_('b1', '2026-10-13')]);
    expect(s).toMatchObject({ meals: 3, days: 2, wheel: 1, good: 1 });
    expect(s.topSlot).toBeTruthy();
  });
});
