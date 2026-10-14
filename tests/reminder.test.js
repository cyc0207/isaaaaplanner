import { describe, it, expect } from 'vitest';
import { buildIcs, googleCalendarUrl, icsPath, REMINDER_TIMES } from '../src/lib/reminder.js';

describe('每天提醒開 app', () => {
  it('行事曆檔：台北時間每天重複、準時響、附網址', () => {
    const ics = buildIcs('09:00');
    expect(ics).toContain('DTSTART;TZID=Asia/Taipei:20261001T090000');
    expect(ics).toContain('DTEND;TZID=Asia/Taipei:20261001T090500');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('TRIGGER:PT0M');
    expect(ics).toContain('URL:https://isaaaaplanner.vercel.app/');
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
  });
  it('23:30 結束時間不會超過 24 點', () => {
    expect(buildIcs('23:30')).toContain('DTEND;TZID=Asia/Taipei:20261001T233500');
  });
  it('時間選項和檔名', () => {
    expect(REMINDER_TIMES[0]).toBe('06:00');
    expect(REMINDER_TIMES.at(-1)).toBe('23:30');
    expect(REMINDER_TIMES).toContain('09:00');
    expect(icsPath('21:30')).toBe('/reminder/2130.ics');
  });
  it('Google 日曆連結帶時區和每天重複', () => {
    const u = new URL(googleCalendarUrl('21:00'));
    expect(u.searchParams.get('dates')).toBe('20261001T210000/20261001T210500');
    expect(u.searchParams.get('ctz')).toBe('Asia/Taipei');
    expect(u.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY');
  });
});
