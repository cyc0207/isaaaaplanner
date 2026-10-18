import { describe, it, expect } from 'vitest';
import { mergeItems, sundayOf, pickFor, nextAlternative, swapOps, parseDiscoveryJSON, habitEntry } from '../src/lib/discovery.js';

describe('Sunday English Discovery', () => {
  it('內建四週，日期都是星期日，用 Firestore 進度蓋過去', () => {
    const items = mergeItems([{ id: 'ted-sivers-movement', status: 'done', note: 'fun' }]);
    expect(items.map((x) => x.date)).toEqual(['2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08']);
    expect(items[0].status).toBe('done');
    expect(items[0].url).toBe('https://www.ted.com/talks/derek_sivers_how_to_start_a_movement');
  });

  it('找這週的週日，挑當天的教材，沒有就 null', () => {
    expect(sundayOf('2026-10-18')).toBe('2026-10-18');
    expect(sundayOf('2026-10-19')).toBe('2026-10-25');
    expect(sundayOf('2026-10-24')).toBe('2026-10-25');
    const items = mergeItems([]);
    expect(pickFor(items, '2026-10-25').title).toMatch(/Grit/);
    expect(pickFor(items, '2026-11-15')).toBeNull();
  });

  it('換一個：和下一個沒完成的交換日期', () => {
    const items = mergeItems([]);
    const cur = pickFor(items, '2026-10-18');
    const alt = nextAlternative(items, cur, '2026-10-18');
    expect(alt.id).toBe('ted-duckworth-grit');
    expect(swapOps(cur, alt, '2026-10-18')).toEqual([
      { id: 'ted-duckworth-grit', data: { date: '2026-10-18' } },
      { id: 'ted-sivers-movement', data: { date: '2026-10-25' } },
    ]);
    const last = items.find((x) => x.date === '2026-11-08');
    expect(nextAlternative(items.map((x) => ({ ...x, status: 'done' })), last, '2026-11-08')).toBeNull();
  });

  it('貼 JSON：檢查網址、日期、重複', () => {
    const existing = mergeItems([]);
    const text = '```json\n' + JSON.stringify([
      { title: 'A', url: 'https://example.org/a', date: '2026-11-15' },
      { title: 'B', url: 'not a url' },
      { title: 'C', url: 'https://example.org/c', date: '2026-11-16' },
      { title: 'D', url: 'https://www.ted.com/talks/derek_sivers_how_to_start_a_movement' },
      { title: 'E', url: 'https://example.org/e', date: '2026-11-08' },
      { title: 'F', url: 'javascript:alert(1)' },
    ]) + '\n```';
    const { rows } = parseDiscoveryJSON(text, existing);
    expect(rows.map((r) => r.status)).toEqual(['ok', 'error', 'error', 'duplicate', 'taken', 'error']);
    expect(parseDiscoveryJSON('{oops', existing).error).toBeTruthy();
    expect(parseDiscoveryJSON('{"items":[{"title":"X","url":"https://x.org"}]}', existing).rows[0].status).toBe('ok');
  });

  it('首頁習慣：不蓋掉今天已經有的紀錄', () => {
    const item = { id: 'x', title: 'T', minutes: 6 };
    expect(habitEntry(null, item)).toEqual({ minutes: 6, note: 'Sunday English Discovery：T', discovery: 'x' });
    expect(habitEntry({ minutes: 15, note: '網站' }, item)).toEqual({ minutes: 15, note: '網站', discovery: 'x' });
  });
});
