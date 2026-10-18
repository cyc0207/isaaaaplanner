import { describe, it, expect } from 'vitest';
import {
  getSchedule, slotFor, buildMission, grade, answeredAll, pendingMissions, tagStats, tagWeights, recentAccuracy, targetLevel,
  weekSummary, questionList, TAG_LABEL, KINDS, PART2_COUNT,
} from '../src/lib/mission.js';
import { PART2, PART34, FREE_TALK_PROMPTS, INTERVIEW_QUESTIONS } from '../src/data/listeningBank.js';
import { reminderGroups, encodeSchedule, decodeSchedule, buildScheduleIcs, googleScheduleLinks } from '../src/lib/missionIcs.js';
import { splitSentences, castVoices, part2Lines } from '../src/lib/tts.js';
import { addDays } from '../src/lib/date.js';

const S = getSchedule(null);
const strip = (m) => ({ ...m, createdAtMs: 0 });

// 把一份任務「做完」：answerFn(題目) 回傳選的答案
function complete(m, answerFn) {
  const answers = Object.fromEntries(questionList(m).map((q) => [q.key, answerFn(q)]));
  const g = grade(m, answers);
  return { ...m, id: m.date, answers, status: 'done', result: { correct: g.correct, total: g.total, byTag: g.byTag } };
}

describe('題庫', () => {
  it('Part 2：id 不重複、三個選項、答案在選項裡、題型有名稱', () => {
    expect(new Set(PART2.map((x) => x.id)).size).toBe(PART2.length);
    expect(PART2.length).toBeGreaterThanOrEqual(PART2_COUNT * 4);
    for (const x of PART2) {
      expect(x.options).toHaveLength(3);
      expect(new Set(x.options).size).toBe(3);
      expect(x.answer).toBeGreaterThanOrEqual(0);
      expect(x.answer).toBeLessThan(3);
      expect(TAG_LABEL[x.tag]).toBeTruthy();
      expect(x.explain).toBeTruthy();
    }
  });

  it('Part 2：正解不會老是同一個字母', () => {
    const c = [0, 0, 0];
    PART2.forEach((x) => (c[x.answer] += 1));
    for (const n of c) expect(n).toBeGreaterThanOrEqual(8);
  });

  it('Part 3/4：每組 3 題、4 個選項、答案在選項裡；對話 8 組、獨白 4 組', () => {
    expect(new Set(PART34.map((x) => x.id)).size).toBe(PART34.length);
    expect(PART34.filter((s) => s.type === 'conversation')).toHaveLength(8);
    expect(PART34.filter((s) => s.type === 'talk')).toHaveLength(4);
    for (const s of PART34) {
      expect(s.lines.length).toBeGreaterThan(0);
      expect(s.questions).toHaveLength(3);
      for (const q of s.questions) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(4);
        expect(TAG_LABEL[q.tag]).toBeTruthy();
        expect(q.explain).toBeTruthy();
      }
    }
  });

  it('Free Talk 和面試題 id 不重複、主題是口說教練有的', () => {
    for (const pool of [FREE_TALK_PROMPTS, INTERVIEW_QUESTIONS]) {
      expect(new Set(pool.map((p) => p.id)).size).toBe(pool.length);
      for (const p of pool) expect(['free', 'work', 'career', 'life']).toContain(p.topic);
    }
  });
});

describe('課表', () => {
  it('預設：一 Free Talk、二 Part 2、三 Part 3/4、四面試 21:30，五紙本多益、六檢討 10:00、日休息', () => {
    expect(S[1]).toEqual({ kind: 'freetalk', time: '21:30' });
    expect(S[2]).toEqual({ kind: 'part2', time: '21:30' });
    expect(S[3]).toEqual({ kind: 'part34', time: '21:30' });
    expect(S[4]).toEqual({ kind: 'interview', time: '21:30' });
    expect(S[5].kind).toBe('toeic_read');
    expect(S[6]).toEqual({ kind: 'toeic_review', time: '10:00' });
    expect(S[0]).toEqual({ kind: 'rest', time: '' });
  });

  it('改過的天蓋掉預設，壞掉的資料用預設', () => {
    const s = getSchedule({ days: { 2: { kind: 'rest', time: '21:30' }, 3: { kind: 'nope' } } });
    expect(s[2]).toEqual({ kind: 'rest', time: '' });
    expect(s[3]).toEqual(S[3]);
  });

  it('2026-10-20 是星期二，派 Part 2；星期五、六、日不建任務文件', () => {
    expect(slotFor('2026-10-20', S).kind).toBe('part2');
    expect(buildMission('2026-10-23', S)).toBeNull(); // 五：紙本多益在 12 週計畫裡
    expect(buildMission('2026-10-24', S)).toBeNull(); // 六
    expect(buildMission('2026-10-25', S)).toBeNull(); // 日
  });
});

describe('派題', () => {
  it('星期二：12 題 Part 2，題目整份存在任務裡', () => {
    const m = buildMission('2026-10-20', S, []);
    expect(m.kind).toBe('part2');
    expect(m.items).toHaveLength(12);
    expect(m.resourceIds).toEqual(m.items.map((x) => x.id));
    expect(m.status).toBe('ready');
    expect(m.minutes).toBe(15);
  });

  it('同一天、同樣紀錄 → 一模一樣的題目（重整不會換題）', () => {
    const a = buildMission('2026-10-20', S, []);
    const b = buildMission('2026-10-20', S, []);
    expect(strip(a)).toEqual(strip(b));
  });

  it('星期三：2 組對話＋1 篇獨白', () => {
    const m = buildMission('2026-10-21', S, []);
    expect(m.items.map((s) => s.type).sort()).toEqual(['conversation', 'conversation', 'talk']);
    expect(questionList(m)).toHaveLength(9);
  });

  it('星期一、四：給一題口說題目，帶口說教練的主題', () => {
    const mon = buildMission('2026-10-19', S, []);
    expect(mon.kind).toBe('freetalk');
    expect(FREE_TALK_PROMPTS.map((p) => p.id)).toContain(mon.prompt.id);
    const thu = buildMission('2026-10-22', S, []);
    expect(thu.kind).toBe('interview');
    expect(INTERVIEW_QUESTIONS.map((p) => p.id)).toContain(thu.prompt.id);
  });

  it('連續 4 個星期二不重複題目；第 5 週才從最早做過的開始', () => {
    let history = [];
    const seen = [];
    for (let w = 0; w < 4; w++) {
      const m = complete(buildMission(addDays('2026-10-20', 7 * w), S, history), (q) => q.answer);
      seen.push(...m.resourceIds);
      history = [m, ...history];
    }
    expect(new Set(seen).size).toBe(48);
    const fifth = buildMission('2026-11-17', S, history);
    const firstWeek = new Set(history[history.length - 1].resourceIds);
    expect(fifth.resourceIds.every((id) => firstWeek.has(id))).toBe(true);
  });

  it('面試題不連續重複', () => {
    let history = [];
    const ids = [];
    for (let w = 0; w < 6; w++) {
      const m = { ...buildMission(addDays('2026-10-22', 7 * w), S, history), status: 'done' };
      ids.push(m.prompt.id);
      history = [{ ...m, id: m.date }, ...history];
    }
    expect(new Set(ids).size).toBe(6);
  });

  it('間接問句一直錯 → 下一次 Part 2 間接問句變多', () => {
    // 第一週：間接問句全錯、其他全對
    const first = buildMission('2026-10-20', S, []);
    const done = complete(first, (q) => (q.tag === 'indirect' ? (q.answer + 1) % 3 : q.answer));
    // 為了讓間接問句的作答數夠，再加一份全錯的紀錄
    const extra = { ...done, id: '2026-10-13', date: '2026-10-13', resourceIds: [], result: { correct: 0, total: 4, byTag: { indirect: { c: 0, t: 4 } } } };
    const history = [done, extra];
    expect(tagWeights(tagStats(history, 'part2')).indirect).toBe(3);

    // 比較很多個日期的平均：有弱點紀錄時抽到的間接問句比較多
    const count = (h) => {
      let n = 0;
      for (let k = 0; k < 20; k++) n += buildMission(addDays('2026-10-27', 7 * k), S, h).items.filter((x) => x.tag === 'indirect').length;
      return n;
    };
    const neutral = [{ ...done, result: { ...done.result, byTag: {} } }];
    expect(count(history)).toBeGreaterThan(count(neutral));
  });

  it('沒有紀錄就不假設程度：難度用中間值', () => {
    expect(recentAccuracy([], 'part2')).toBeNull();
    expect(targetLevel(null)).toBe(2);
    expect(targetLevel(0.9)).toBe(3);
    expect(targetLevel(0.5)).toBe(1);
  });
});

describe('作答與紀錄', () => {
  it('計分：答對數、各題型、錯題', () => {
    const m = buildMission('2026-10-20', S, []);
    const answers = Object.fromEntries(m.items.map((x, i) => [x.id, i < 3 ? (x.answer + 1) % 3 : x.answer]));
    const g = grade(m, answers);
    expect(g.total).toBe(12);
    expect(g.correct).toBe(9);
    expect(g.wrong).toHaveLength(3);
    expect(g.wrong[0]).toMatchObject({ key: m.items[0].id, answer: m.items[0].answer });
    expect(Object.values(g.byTag).reduce((s, v) => s + v.t, 0)).toBe(12);
    expect(answeredAll(m, answers)).toBe(true);
    expect(answeredAll(m, {})).toBe(false);
  });

  it('Part 3/4 的題目 key 是「組#題號」', () => {
    const m = buildMission('2026-10-21', S, []);
    const keys = questionList(m).map((q) => q.key);
    expect(keys[0]).toMatch(/^p[34]-\d\d#0$/);
  });

  it('還沒做完的任務：最近 7 天、不含今天、不含完成和跳過', () => {
    const h = [
      { date: '2026-10-20', status: 'ready' },
      { date: '2026-10-21', status: 'done' },
      { date: '2026-10-19', status: 'skipped' },
      { date: '2026-10-22', status: 'in_progress' },
      { date: '2026-10-10', status: 'ready' },
    ];
    expect(pendingMissions(h, '2026-10-22').map((m) => m.date)).toEqual(['2026-10-20']);
  });

  it('本週完成數和分鐘', () => {
    const h = [
      { date: '2026-10-19', status: 'done', result: { minutes: 12 } },
      { date: '2026-10-20', status: 'done', result: { minutes: 15 } },
      { date: '2026-10-21', status: 'ready' },
      { date: '2026-10-12', status: 'done', result: { minutes: 30 } },
    ];
    expect(weekSummary(h, '2026-10-19')).toEqual({ done: 2, total: 3, minutes: 27 });
  });

  it('只有做完的任務才算進弱點', () => {
    const h = [{ kind: 'part2', status: 'in_progress', result: { byTag: { wh: { c: 0, t: 5 } } } }];
    expect(tagStats(h, 'part2')).toEqual({});
  });
});

describe('行事曆提醒', () => {
  it('同一個時間的幾天合成一個每週活動，休息日不放', () => {
    const g = reminderGroups(S);
    expect(g.map((x) => x.time)).toEqual(['21:30', '21:00', '10:00']);
    expect(g[0].days.map((d) => d.wd)).toEqual([1, 2, 3, 4]);
    const ics = buildScheduleIcs(S);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH');
    expect(ics).toContain('DTSTART;TZID=Asia/Taipei:20261019T213000');
    expect(ics).toContain('DTSTART;TZID=Asia/Taipei:20261024T100000');
    expect(ics).toContain('URL:https://isaaaaplanner.vercel.app/mission');
    expect(ics).not.toContain('BYDAY=SU');
  });

  it('網址參數可以還原課表；亂填的部分忽略', () => {
    const custom = getSchedule({ days: { 2: { kind: 'rest' }, 0: { kind: 'part2', time: '08:00' } } });
    expect(getSchedule({ days: decodeSchedule(encodeSchedule(custom)) })).toEqual(custom);
    expect(decodeSchedule('9-2130-part2_1-9999-part2_1-2130-hack')).toEqual({});
  });

  it('Google 日曆每個時間一個連結', () => {
    const links = googleScheduleLinks(S);
    expect(links).toHaveLength(3);
    expect(decodeURIComponent(links[0].url)).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH');
  });
});

describe('朗讀', () => {
  it('長段落拆成一句一句', () => {
    expect(splitSentences('Hi there. How are you? Fine!')).toEqual(['Hi there.', 'How are you?', 'Fine!']);
    expect(splitSentences('No end')).toEqual(['No end']);
  });

  it('Part 2：先念問題，再念 A、B、C，問的人和答的人不同', () => {
    const lines = part2Lines(PART2[0]);
    expect(lines).toHaveLength(4);
    expect(lines[1].text.startsWith('A. ')).toBe(true);
    expect(lines[0].sp).not.toBe(lines[1].sp);
  });

  it('分配聲音：有女聲、男聲時分開；沒有英文語音就是空的', () => {
    const vs = [
      { name: 'Samantha', lang: 'en-US' }, { name: 'Daniel', lang: 'en-GB' }, { name: 'Karen', lang: 'en-AU' }, { name: 'Mei-Jia', lang: 'zh-TW' },
    ];
    const c = castVoices(vs);
    expect(c.W.name).toBe('Samantha');
    expect(c.M.name).toBe('Daniel');
    expect(c.W2.name).toBe('Karen');
    expect(castVoices([{ name: 'Mei-Jia', lang: 'zh-TW' }]).any).toBeNull();
  });

  it('每種任務都有名稱和分鐘數', () => {
    for (const k of Object.values(KINDS)) expect(k.label).toBeTruthy();
  });
});
