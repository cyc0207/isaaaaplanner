import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCSV, buildImportPreview, toCSV, PLAN_HEADER } from '../src/lib/csv.js';

const decorate = readFileSync(new URL('./fixtures/DecorateMe_每週任務.csv', import.meta.url), 'utf8');

describe('CSV', () => {
  it('處理 BOM、引號內逗號、跳脫的雙引號與 CRLF', () => {
    const rows = parseCSV('﻿type,title\r\ntask,"a, b ""c"""\r\n');
    expect(rows).toEqual([['type', 'title'], ['task', 'a, b "c"']]);
  });

  it('匯入 DecorateMe 檔案：28 列都正確，再匯入一次全部標成重複', () => {
    const first = buildImportPreview(decorate, []);
    expect(first.error).toBeNull();
    expect(first.rows).toHaveLength(28);
    expect(first.rows.every((r) => r.status === 'ok')).toBe(true);
    expect(first.rows.filter((r) => r.type === 'deadline')).toHaveLength(1);
    expect(first.rows[0].title).toBe('簡報匯出 PDF，翻第 4、16、25 頁檢查有沒有跑版');

    const existing = first.rows.map((r) => ({ type: r.type, date: r.date, title: r.title }));
    const second = buildImportPreview(decorate, existing);
    expect(second.rows.every((r) => r.status === 'duplicate' && !r.selected)).toBe(true);
  });

  it('錯的列標成 error，其他列照常', () => {
    const p = buildImportPreview('type,date,title,project,note\nfoo,2026-10-01,x,,\ntask,2026-13-01,y,,\ntask,2026-10-02,ok,,\n', []);
    expect(p.rows.map((r) => r.status)).toEqual(['error', 'error', 'ok']);
  });

  it('匯出的任務 CSV 有 BOM，可以再匯入且保留 done', () => {
    const csv = toCSV(PLAN_HEADER, [
      { type: 'task', date: '2026-10-12', title: '有逗號, 和 "引號"', project: 'X', note: '', done: true },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const p = buildImportPreview(csv, []);
    expect(p.rows[0]).toMatchObject({ status: 'ok', title: '有逗號, 和 "引號"', done: true });
  });
});

import { exportFileName, ledgerRecords } from '../src/lib/exporters.js';

describe('匯出', () => {
  it('檔名：整月用月份，區間用起訖日', () => {
    expect(exportFileName('任務', '2026-10-01', '2026-10-31')).toBe('planner_任務_2026-10.csv');
    expect(exportFileName('記帳', '2026-10-01', '2026-10-15')).toBe('planner_記帳_2026-10-01_2026-10-15.csv');
  });
  it('記帳匯出指定區間，帳戶用名稱', () => {
    const ex = [
      { date: '2026-09-30', type: 'expense', amount: 1, account: 'cash' },
      { date: '2026-10-02', type: 'transfer', amount: 500, account: 'salary', toAccount: 'cash', category: '' },
    ];
    const r = ledgerRecords(ex, { cash: { name: '現金' }, salary: { name: '薪資戶' } }, '2026-10-01', '2026-10-31');
    expect(r).toEqual([{ date: '2026-10-02', type: 'transfer', amount: 500, category: '', account: '薪資戶', toAccount: '現金', note: '' }]);
  });
});
