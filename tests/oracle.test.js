import { describe, it, expect } from 'vitest';
import { LENORMAND, SIBILLA, drawFrom, drawTopic, topicReading, topicAction, oraclePrompt, eatLine, quoteOfDay, BUILTIN_QUOTES, oracleCard } from '../src/lib/oracle.js';

describe('雷諾曼・西比拉', () => {
  it('張數對、id 不重複、內容齊全', () => {
    expect(LENORMAND).toHaveLength(36);
    expect(SIBILLA).toHaveLength(52);
    expect(LENORMAND.every((c) => c.zh && c.key && c.eat && c.wear.length === 3 && c.wear.every(Boolean))).toBe(true);
    expect(SIBILLA.every((c) => c.zh && c.key && c.love && c.act)).toBe(true);
    expect(oracleCard('len-34').zh).toBe('魚');
    expect(oracleCard('sib-52').zh).toBe('勝利');
  });
  it('抽牌不重複', () => {
    for (let k = 0; k < 100; k++) {
      const s = drawFrom('lenormand', 9);
      expect(new Set(s).size).toBe(9);
    }
    expect(drawTopic('wear')).toHaveLength(3);
    expect(drawTopic('eat')).toHaveLength(2);
    expect(drawTopic('love').every((id) => id.startsWith('sib-'))).toBe(true);
    const seq = [0, 0];
    expect(drawFrom('lenormand', 2, () => seq.shift())).toEqual(['len-1', 'len-2']);
  });
  it('牌義和行動分開，不用預言字眼', () => {
    const r = topicReading('wear', ['len-3', 'len-15', 'len-25']);
    expect(r.map((x) => x.pos)).toEqual(['顏色氛圍', '主角單品', '小細節']);
    expect(r[0].text).toBe('海軍藍');
    expect(topicAction('wear', ['len-3', 'len-15', 'len-25'])).toContain('oversize 外套');
    expect(topicAction('eat', ['len-34', 'len-15'])).toContain('海鮮');
    expect(topicAction('love', ['sib-1', 'sib-2', 'sib-41'])).toBe(oracleCard('sib-41').act);
    expect(eatLine({ cards: ['len-34', 'len-15'] })).toBe('魚＋熊：海鮮或魚');
    expect(eatLine(undefined)).toBe('');
    const all = [...LENORMAND.flatMap((c) => [c.key, c.eat, ...c.wear]), ...SIBILLA.flatMap((c) => [c.key, c.love, c.act])].join('');
    expect(all).not.toMatch(/一定會|未來將/);
    const p = oraclePrompt({ day: '2026-10-12', deck: 'sibilla', cards: ['sib-1'], question: '桃花運' });
    expect(p).toContain('【牌義解讀】');
    expect(p).toContain('【今天的行動建議】');
  });
  it('動力小語：同一天同一句，換一句會變，只抽自己的', () => {
    const a = quoteOfDay({ day: '2026-10-12' });
    expect(quoteOfDay({ day: '2026-10-12' })).toEqual(a);
    expect(quoteOfDay({ day: '2026-10-12', offset: 1 }).text).not.toBe(a.text);
    const mine = [{ id: 'q1', text: '語宸加油' }];
    expect(quoteOfDay({ day: '2026-10-13', mine, mineOnly: true })).toEqual({ id: 'q1', text: '語宸加油', mine: true });
    expect(quoteOfDay({ day: '2026-10-13', mineOnly: true }).mine).toBe(false);
    expect(BUILTIN_QUOTES.length).toBeGreaterThan(20);
  });
});

import { COLORS, COLOR_SPOTS, drawColor, colorById, colorLine } from '../src/lib/oracle.js';

describe('穿搭：今天的顏色元素', () => {
  it('抽一個顏色和位置，行動會帶到', () => {
    expect(new Set(COLORS.map((c) => c.id)).size).toBe(COLORS.length);
    expect(COLORS.every((c) => /^#[0-9a-f]{6}$/.test(c.hex) && c.feel)).toBe(true);
    const seq = [0, 0.99999];
    const p = drawColor(() => seq.shift());
    expect(p).toEqual({ colorId: 'c1', spot: COLOR_SPOTS[COLOR_SPOTS.length - 1] });
    expect(colorById('c1').name).toBe('磚紅');
    expect(colorLine({ colorId: 'c5', spot: '用在鞋子' })).toBe('海軍藍・用在鞋子');
    expect(colorLine(undefined)).toBe('');
    expect(topicAction('wear', ['len-3', 'len-15', 'len-25'], { colorId: 'c5', spot: '用在鞋子' })).toContain('今天的顏色是海軍藍，用在鞋子');
    expect(topicAction('wear', ['len-3', 'len-15', 'len-25'])).toContain('今天以海軍藍為主');
  });
});

import { loveDetail } from '../src/lib/oracle.js';

describe('桃花小解析', () => {
  it('每張西比拉都有時機、類型、心動點，三張各看一項', () => {
    expect(SIBILLA.every((c) => c.when && c.type && c.why)).toBe(true);
    const d = loveDetail(['sib-1', 'sib-2', 'sib-3']);
    expect(d.map((x) => x.label)).toEqual(['什麼時候容易遇到', '對方可能是什麼類型', '會因為什麼心動']);
    expect(d[0].text).toBe(oracleCard('sib-1').when);
    expect(d[1].text).toBe(oracleCard('sib-2').type);
    expect(d[2].text).toBe(oracleCard('sib-3').why);
    expect(loveDetail(['sib-1'])).toEqual([]);
    expect(SIBILLA.map((c) => c.when + c.type + c.why).join('')).not.toMatch(/一定會|未來將/);
  });
});
