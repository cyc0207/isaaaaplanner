// 英文課表的行事曆檔：iPhone 點了直接「加入行事曆」。只依網址參數產生，不讀資料庫
// GET /api/schedule-ics?s=1-2130-freetalk_2-2130-part2_…
import { getSchedule } from '../src/lib/mission.js';
import { decodeSchedule, buildScheduleIcs } from '../src/lib/missionIcs.js';

export default function handler(req, res) {
  const schedule = getSchedule({ days: decodeSchedule(req.query.s) });
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="english-schedule.ics"');
  res.setHeader('Cache-Control', 's-maxage=86400');
  res.status(200).send(buildScheduleIcs(schedule));
}
