// 每天提醒開 app：產生行事曆檔（.ics，iPhone 行事曆）和 Google 日曆連結（Android）
// 不用推播、不用伺服器，提醒交給手機自己的行事曆，關掉網頁也會響
export const APP_URL = 'https://isaaaaplanner.vercel.app/';
export const TITLE = '打開「今天」看看今天的 3 件事';
const DETAILS = `點這裡打開：${APP_URL}`;
const START_DATE = '20261001'; // 從過去某天開始每天重複，固定日期讓檔案內容穩定

// 每 30 分鐘一個選項，06:00 到 23:30
export const REMINDER_TIMES = Array.from({ length: 36 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
export const DEFAULT_TIME = '09:00';

const hhmm = (time) => time.replace(':', '');
const plus5 = (time) => {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + 5;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}${String(t % 60).padStart(2, '0')}`;
};

export const icsPath = (time) => `/reminder/${hhmm(time)}.ics`;

export function buildIcs(time) {
  const t = hhmm(time);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//chenchen-planner//reminder//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Taipei',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:open-app-${t}@isaaaaplanner`,
    `DTSTAMP:${START_DATE}T000000Z`,
    `DTSTART;TZID=Asia/Taipei:${START_DATE}T${t}00`,
    `DTEND;TZID=Asia/Taipei:${START_DATE}T${plus5(time)}00`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${TITLE}`,
    `DESCRIPTION:${DETAILS}`,
    `URL:${APP_URL}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${TITLE}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function googleCalendarUrl(time) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    dates: `${START_DATE}T${hhmm(time)}00/${START_DATE}T${plus5(time)}00`,
    ctz: 'Asia/Taipei',
    recur: 'RRULE:FREQ=DAILY',
    details: DETAILS,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
