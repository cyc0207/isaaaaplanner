import { describe, it, expect } from 'vitest';
import { seedDocs, LEGACY_PERSONAL_SEED, shouldCleanLegacySeed, isUntouchedSeed } from '../src/lib/seed.js';

describe('初始資料不含個人行程', () => {
  it('新帳號不會拿到站長的課程、報告、比賽', () => {
    const docs = seedDocs('2026-10-23');
    const paths = docs.map((d) => d.path);
    expect(paths.some((p) => p.startsWith('deadlines/') || p.startsWith('tasks/'))).toBe(false);
    Object.keys(LEGACY_PERSONAL_SEED).forEach((p) => expect(paths).not.toContain(p));
    const text = JSON.stringify(docs);
    ['DecorateMe', '愛迪達', '企業倫理', '資服競賽', '實習'].forEach((w) => expect(text).not.toContain(w));
  });
});

describe('清掉舊版塞進去的個人行程', () => {
  it('站長（10/13 以前開始用）不清', () => {
    expect(shouldCleanLegacySeed({ startDate: '2026-10-11' })).toBe(false);
    expect(shouldCleanLegacySeed({ startDate: '2026-10-13' })).toBe(false);
    expect(shouldCleanLegacySeed({})).toBe(false);
    expect(shouldCleanLegacySeed(null)).toBe(false);
  });
  it('之後加入的人清一次', () => {
    expect(shouldCleanLegacySeed({ startDate: '2026-10-20' })).toBe(true);
    expect(shouldCleanLegacySeed({ startDate: '2026-10-20', seedCleaned: true })).toBe(false);
  });
  it('改過、打勾過、寫過備註的留著', () => {
    expect(isUntouchedSeed('deadlines/seed-3', { title: '資服競賽決賽 8:00–17:00', note: '' })).toBe(true);
    expect(isUntouchedSeed('deadlines/seed-3', { title: '我自己的比賽', note: '' })).toBe(false);
    expect(isUntouchedSeed('tasks/seed-2', { title: LEGACY_PERSONAL_SEED['tasks/seed-2'], done: true })).toBe(false);
    expect(isUntouchedSeed('deadlines/seed-1', { title: '企業倫理實體課', note: '要帶課本' })).toBe(false);
  });
});
