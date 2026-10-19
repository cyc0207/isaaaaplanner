// 英文課表提醒：把每週課表放進手機行事曆（同一個時間的幾天合成一個每週重複的活動），
// 點活動就打開 /mission（今天的任務）。不用推播、不用伺服器排程。
import { APP_URL } from './reminder.js';
import { KINDS } from './mission.js';

export const MISSION_URL = `${APP_URL}mission`;
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const MONDAY = [2026, 10, 19]; // 從這週一開始重複，固定日期讓檔案內容穩定

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (t) => t.replace(':', '');

function plus(time, min) {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + min;
  return `${pad(Math.floor(t / 60) % 24)}${pad(t % 60)}`;
}

// 第一個符合的日期（YYYYMMDD）：週一開始往後找
function firstDate(wd) {
  const d = new Date(MONDAY[0], MONDAY[1] - 1, MONDAY[2] + ((wd + 6) % 7));
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// 依時間分組；休息日不放
export function reminderGroups(schedule) {
  const groups = new Map();
  for (const wd of [1, 2, 3, 4, 5, 6, 0]) {
    const s = schedule[wd];
    if (!s || s.kind === 'rest' || !s.time) continue;
    if (!groups.has(s.time)) groups.set(s.time, []);
    groups.get(s.time).push({ wd, kind: s.kind });
  }
  return [...groups.entries()].map(([time, days]) => ({
    time,
    days,
    title: `英文任務：${days.map((d) => KINDS[d.kind].short).join('／')}`,
    detail: `${days.map((d) => `星期${NAMES[d.wd]} ${KINDS[d.kind].short}`).join('、')}。點這裡打開今天的任務：${MISSION_URL}`,
  }));
}

// 網址參數：1-2130-freetalk_2-2130-part2…（給 /api/schedule-ics 用）
export const encodeSchedule = (schedule) =>
  [1, 2, 3, 4, 5, 6, 0].map((wd) => `${wd}-${hhmm(schedule[wd]?.time || '0000')}-${schedule[wd]?.kind || 'rest'}`).join('_');

export function decodeSchedule(s) {
  const out = {};
  for (const part of String(s || '').split('_')) {
    const m = part.match(/^([0-6])-(\d{2})(\d{2})-([a-z_0-9]+)$/);
    if (!m || !KINDS[m[4]]) continue;
    const h = Number(m[2]);
    const min = Number(m[3]);
    if (h > 23 || min > 59) continue;
    out[m[1]] = { kind: m[4], time: m[4] === 'rest' ? '' : `${m[2]}:${m[3]}` };
  }
  return out;
}

const esc = (s) => s.replace(/[\;,]/g, (c) => `\\${c}`);

export function buildScheduleIcs(schedule) {
  const events = reminderGroups(schedule).flatMap((g) => {
    const start = firstDate(g.days[0].wd);
    return [
      'BEGIN:VEVENT',
      `UID:english-mission-${hhmm(g.time)}-${g.days.map((d) => d.wd).join('')}@isaaaaplanner`,
      `DTSTAMP:${start}T000000Z`,
      `DTSTART;TZID=Asia/Taipei:${start}T${hhmm(g.time)}00`,
      `DTEND;TZID=Asia/Taipei:${start}T${plus(g.time, 10)}00`,
      `RRULE:FREQ=WEEKLY;BYDAY=${g.days.map((d) => BYDAY[d.wd]).join(',')}`,
      `SUMMARY:${esc(g.title)}`,
      `DESCRIPTION:${esc(g.detail)}`,
      `URL:${MISSION_URL}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(g.title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    ];
  });
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//chenchen-planner//english-mission//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Taipei', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE',
    ...events,
    'END:VCALENDAR', '',
  ].join('\r\n');
}

export const scheduleIcsPath = (schedule) => `/api/schedule-ics?s=${encodeSchedule(schedule)}`;

// Google 日曆一次只能加一個活動，所以每個時間一個連結
export function googleScheduleLinks(schedule) {
  return reminderGroups(schedule).map((g) => {
    const start = firstDate(g.days[0].wd);
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: g.title,
      dates: `${start}T${hhmm(g.time)}00/${start}T${plus(g.time, 10)}00`,
      ctz: 'Asia/Taipei',
      recur: `RRULE:FREQ=WEEKLY;BYDAY=${g.days.map((d) => BYDAY[d.wd]).join(',')}`,
      details: g.detail,
    });
    return { ...g, url: `https://calendar.google.com/calendar/render?${p}` };
  });
}
