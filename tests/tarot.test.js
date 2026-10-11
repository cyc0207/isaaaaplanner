import { describe, it, expect } from 'vitest';
import { CARDS, drawCard, cardById, meaningOf, tarotPrompt, tarotStreak, cardNumeral } from '../src/lib/tarot.js';

describe('每日塔羅', () => {
  it('78 張、id 不重複、每張都有正逆位牌義', () => {
    expect(CARDS).toHaveLength(78);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(78);
    expect(CARDS.every((c) => c.zh && c.en && c.up && c.rev)).toBe(true);
    expect(CARDS.filter((c) => c.arcana === 'major')).toHaveLength(22);
  });
  it('抽牌涵蓋第一張到最後一張、正逆位', () => {
    expect(drawCard(0, 0.1)).toEqual({ cardId: 'major-0', reversed: true });
    expect(drawCard(0.99999, 0.9)).toEqual({ cardId: 'pentacles-14', reversed: false });
    expect(cardById('cups-1').zh).toBe('聖杯王牌');
    expect(cardNumeral(cardById('major-21'))).toBe('XXI');
    expect(cardNumeral(cardById('swords-12'))).toBe('N');
  });
  it('逆位用逆位牌義', () => {
    expect(meaningOf({ cardId: 'major-19', reversed: false })).toContain('開心');
    expect(meaningOf({ cardId: 'major-19', reversed: true })).toContain('低落');
  });
  it('prompt 有日期、牌名、正逆位、牌義和今天的事', () => {
    const p = tarotPrompt({ day: '2026-10-12', draw: { cardId: 'wands-3', reversed: true }, tasks: ['寫報告'], energy: 3 });
    expect(p).toContain('2026-10-12');
    expect(p).toContain('權杖三（Three of Wands）・逆位');
    expect(p).toContain('進度延誤');
    expect(p).toContain('寫報告');
    expect(p).toContain('精力（1～5）：3');
  });
  it('連續天數', () => {
    const log = { '2026-10-10': {}, '2026-10-11': {} };
    expect(tarotStreak(log, '2026-10-12')).toBe(2);
    expect(tarotStreak({ ...log, '2026-10-12': {} }, '2026-10-12')).toBe(3);
  });
});
