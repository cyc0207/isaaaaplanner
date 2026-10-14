import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { REMINDER_TIMES, buildIcs, icsPath } from './src/lib/reminder.js';

// 打包時產生每個時間的提醒行事曆檔（/reminder/0900.ics…），iPhone 點了直接「加入行事曆」
const reminderFiles = {
  name: 'reminder-ics',
  generateBundle() {
    for (const t of REMINDER_TIMES) this.emitFile({ type: 'asset', fileName: icsPath(t).slice(1), source: buildIcs(t) });
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const t = REMINDER_TIMES.find((x) => req.url === icsPath(x));
      if (!t) return next();
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.end(buildIcs(t));
    });
  },
};

export default defineConfig({
  plugins: [react(), reminderFiles],
  test: { include: ['tests/**/*.test.js'], exclude: ['tests/rules/**'] },
});
