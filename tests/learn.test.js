import { describe, it, expect } from 'vitest';
import { goalsIn, bigProgress, carryOver, deadlineText, splitTitles, weeksOfMonth } from '../src/lib/learn.js';

const goals = [
  { id: 'b1', level: 'big', title: '多益' },
  { id: 'm1', level: 'month', bigId: 'b1', period: '2026-10', title: '單字', done: true },
  { id: 'm2', level: 'month', bigId: 'b1', period: '2026-10', title: '模考' },
  { id: 'w1', level: 'week', bigId: 'b1', period: '2026-10-05', title: '背單字', done: true },
  { id: 'w2', level: 'week', bigId: 'b1', period: '2026-10-05', title: '聽力' },
  { id: 'w3', level: 'week', bigId: 'gone', period: '2026-10-05', title: '舊的' },
  { id: 'w4', level: 'week', bigId: 'b1', period: '2026-10-12', title: '整理' },
];

describe('learn', () => {
  it('依層級和期間挑', () => {
    expect(goalsIn(goals, 'month', '2026-10', 'b1').map((g) => g.id)).toEqual(['m1', 'm2']);
  });
  it('大目標進度', () => {
    expect(bigProgress(goals, 'b1')).toEqual({ month: { done: 1, total: 2 }, week: { done: 1, total: 3 } });
  });
  it('月裡的每週目標', () => {
    expect(weeksOfMonth(goals, '2026-10', 'b1')).toHaveLength(3);
  });
  it('上週沒完成、大目標還在的才搬', () => {
    expect(carryOver(goals, 'week', '2026-10-12').map((g) => g.id)).toEqual(['w2']);
  });
  it('倒數文字', () => {
    expect(deadlineText('2026-10-20', '2026-10-12')).toBe('還有 8 天');
    expect(deadlineText('2026-10-12', '2026-10-12')).toBe('今天到期');
    expect(deadlineText(null, '2026-10-12')).toBe('');
  });
  it('貼多行變多個目標', () => {
    expect(splitTitles('1. 背單字\n- 聽力\n\n・模考')).toEqual(['背單字', '聽力', '模考']);
  });
});
