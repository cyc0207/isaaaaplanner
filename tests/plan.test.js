import { describe, it, expect } from 'vitest';
import { habitStreak, todayTasks, pendingWeekly, nextDeadline, deadlineReminders, monthToClose, isReconcileDay, fixedDue, captureTasks, splitCapture } from '../src/lib/plan.js';
import { weekday } from '../src/lib/date.js';
import { seedDocs } from '../src/lib/seed.js';

const H = '英文 15 分鐘';
const logs = (days) => Object.fromEntries(days.map((d) => [d, { done: { [H]: true } }]));

describe('連續天數', () => {
  it('打卡後增加；今天還沒打不歸零；中斷一天歸零', () => {
    const l = logs(['2026-10-09', '2026-10-10']);
    expect(habitStreak(l, H, '2026-10-10')).toBe(2);
    expect(habitStreak(l, H, '2026-10-11')).toBe(2);
    l['2026-10-11'] = { done: { [H]: true } };
    expect(habitStreak(l, H, '2026-10-11')).toBe(3);
    expect(habitStreak(l, H, '2026-10-13')).toBe(0);
  });
  it('每日固定項目隔天是未勾（看的是當天的紀錄）', () => {
    const l = logs(['2026-10-11']);
    expect(!!l['2026-10-12']?.done?.[H]).toBe(false);
  });
});

describe('今天的任務', () => {
  it('最多顯示 3 件', () => {
    const tasks = [1, 2, 3, 4].map((i) => ({ id: String(i), date: '2026-10-12', createdAtMs: i }));
    const r = todayTasks(tasks, '2026-10-12');
    expect(r.shown).toHaveLength(3);
    expect(r.overflow).toHaveLength(1);
  });
});

describe('提醒', () => {
  it('2026-10-11 是週日', () => expect(weekday('2026-10-11')).toBe(0));
  it('週二的固定事項沒打勾，週三標延後 1 天', () => {
    const rec = [{ id: 'ethics', title: 'x', rule: 'weekly:tue' }];
    expect(pendingWeekly(rec, new Set(), '2026-10-13', '2026-10-01')[0].delay).toBe(0);
    expect(pendingWeekly(rec, new Set(), '2026-10-14', '2026-10-01')[0].delay).toBe(1);
    expect(pendingWeekly(rec, new Set(['ethics_2026-10-13']), '2026-10-14', '2026-10-01')).toHaveLength(0);
  });
  it('11/1 出現作 10 月的帳，沒完成 11/2 仍然顯示，完成後消失', () => {
    expect(monthToClose({}, '2026-11-01', '2026-10')).toBe('2026-10');
    expect(monthToClose({}, '2026-11-02', '2026-10')).toBe('2026-10');
    expect(monthToClose({ '2026-10': {} }, '2026-11-02', '2026-10')).toBeNull();
    expect(monthToClose({}, '2026-10-11', '2026-10')).toBeNull();
  });
  it('前一天提醒的期限、暫定期限倒數', () => {
    const d = seedDocs('2026-10-11').filter((x) => x.path.startsWith('deadlines/')).map((x) => x.data);
    expect(deadlineReminders(d, '2026-10-14')[0]).toMatchObject({ title: '企業倫理實體課', when: '明天' });
    expect(nextDeadline(d, '2026-11-17')).toMatchObject({ tentative: true, daysLeft: 14 });
  });
  it('對帳日預設每週日', () => {
    expect(isReconcileDay({ cycle: 'weekly', day: 0 }, '2026-10-11')).toBe(true);
    expect(isReconcileDay({ cycle: 'monthly', day: 15 }, '2026-10-15')).toBe(true);
  });
  it('固定支出扣款日前 3 天出現，付了就消失', () => {
    const f = [{ id: 'rent', name: '房租', amount: 3000, day: 14 }];
    expect(fixedDue(f, new Set(), '2026-10-10')).toHaveLength(0);
    expect(fixedDue(f, new Set(), '2026-10-11')).toHaveLength(1);
    expect(fixedDue(f, new Set(['2026-10_rent']), '2026-10-11')).toHaveLength(0);
  });
});

describe('隨手記', () => {
  it('只收沒日期、沒做完的，新的在上面', () => {
    const tasks = [
      { id: 'a', date: null, done: false, createdAtMs: 1 },
      { id: 'b', date: '2026-10-14', done: false, createdAtMs: 2 },
      { id: 'c', date: null, done: true, createdAtMs: 3 },
      { id: 'd', done: false, createdAtMs: 4 },
    ];
    expect(captureTasks(tasks).map((t) => t.id)).toEqual(['d', 'a']);
  });
  it('貼好幾行變好幾件，去掉清單符號和空行', () => {
    expect(splitCapture('- 回信\n\n2. 買牛奶\n• 繳房租 \n')).toEqual(['回信', '買牛奶', '繳房租']);
    expect(splitCapture('  ')).toEqual([]);
  });
});
