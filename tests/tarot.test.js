import { describe, it, expect } from 'vitest';
import { CARDS, drawSpread, cardById, meaningOf, tarotPrompt, tarotStreak, cardNumeral, spreadOf, isFullSpread, suggestActions, parseActions } from '../src/lib/tarot.js';

describe('每日塔羅', () => {
  it('78 張、id 不重複、每張都有正逆位牌義', () => {
    expect(CARDS).toHaveLength(78);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(78);
    expect(CARDS.every((c) => c.zh && c.en && c.up && c.rev)).toBe(true);
    expect(CARDS.filter((c) => c.arcana === 'major')).toHaveLength(22);
  });
  it('三張不重複、各自正逆位', () => {
    for (let k = 0; k < 200; k++) {
      const s = drawSpread();
      expect(s).toHaveLength(3);
      expect(new Set(s.map((x) => x.cardId)).size).toBe(3);
    }
    const seq = [0, 0.1, 0, 0.9, 0.99999, 0.2];
    const s = drawSpread(() => seq.shift());
    expect(s).toEqual([{ cardId: 'major-0', reversed: true }, { cardId: 'major-1', reversed: false }, { cardId: 'pentacles-14', reversed: true }]);
    expect(cardById('cups-1').zh).toBe('聖杯王牌');
    expect(cardNumeral(cardById('major-21'))).toBe('XXI');
    expect(cardNumeral(cardById('swords-12'))).toBe('N');
  });
  it('舊紀錄只有一張，不算完整牌陣', () => {
    expect(spreadOf({ cardId: 'major-1', reversed: false })).toHaveLength(1);
    expect(isFullSpread({ cardId: 'major-1', reversed: false })).toBe(false);
    expect(isFullSpread({ cards: [{}, {}, {}] })).toBe(true);
    expect(spreadOf(undefined)).toEqual([]);
  });
  it('逆位用逆位牌義', () => {
    expect(meaningOf({ cardId: 'major-19', reversed: false })).toContain('開心');
    expect(meaningOf({ cardId: 'major-19', reversed: true })).toContain('低落');
  });
  it('prompt 有日期、三張牌的位置、牌名、正逆位、牌義和今天的事', () => {
    const p = tarotPrompt({ day: '2026-10-12', cards: [{ cardId: 'major-17', reversed: false }, { cardId: 'wands-3', reversed: true }, { cardId: 'cups-1', reversed: false }], tasks: ['寫報告'], energy: 3 });
    expect(p).toContain('2026-10-12');
    expect(p).toContain('1. 過去：星星（The Star）・正位');
    expect(p).toContain('2. 現在：權杖三（Three of Wands）・逆位');
    expect(p).toContain('3. 未來：聖杯王牌');
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

describe('塔羅：今天的行動', () => {
  it('依「現在」那張牌和今天第一件任務給建議，逆位先給緩一點的', () => {
    const up = suggestActions([{ cardId: 'major-0', reversed: false }, { cardId: 'wands-3', reversed: false }, { cardId: 'cups-1', reversed: false }], ['寫報告']);
    expect(up[0]).toBe('先動手做「寫報告」的第一步，計時 10 分鐘');
    const rev = suggestActions([{ cardId: 'major-0', reversed: false }, { cardId: 'swords-3', reversed: true }, { cardId: 'cups-1', reversed: false }], []);
    expect(rev[0]).toBe('想太多時把念頭寫下來，寫完就先放著');
    expect(rev.length).toBeLessThanOrEqual(3);
    expect(rev.some((t) => t.includes('今天最重要的事'))).toBe(true);
  });
  it('貼上 AI 的清單會拆成行動', () => {
    expect(parseActions('【今天的行動建議】\n- [ ] 寫 10 分鐘報告\n- [x] 喝水\n1. 散步\n\n')).toEqual(['寫 10 分鐘報告', '喝水', '散步']);
    expect(parseActions('a\nb\nc\nd')).toHaveLength(3);
  });
  it('prompt 把牌義解讀和行動建議分開，註明不是預測', () => {
    const p = tarotPrompt({ day: '2026-10-12', cards: [{ cardId: 'major-17', reversed: false }, { cardId: 'wands-3', reversed: true }, { cardId: 'cups-1', reversed: false }] });
    expect(p.indexOf('【牌義解讀】')).toBeGreaterThan(0);
    expect(p.indexOf('【今天的行動建議】')).toBeGreaterThan(p.indexOf('【牌義解讀】'));
    expect(p).toContain('不要說成一定會發生的預測');
    expect(p).toContain('- [ ]');
  });
});
