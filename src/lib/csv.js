import { isValidDateStr } from './date.js';

// RFC 4180 解析：處理 BOM、CRLF、雙引號包住且內含逗號／換行／""的欄位
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

// 第一列當欄位名稱，回傳物件陣列
export function parseCSVObjects(text) {
  const rows = parseCSV(text);
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { header, records };
}

function escapeField(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 輸出 UTF-8 with BOM，Excel 打開中文不會亂碼
export function toCSV(header, records) {
  const lines = [header.join(',')];
  for (const r of records) lines.push(header.map((h) => escapeField(r[h])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export const PLAN_HEADER = ['type', 'date', 'title', 'project', 'note', 'done'];
export const LEDGER_HEADER = ['date', 'type', 'amount', 'category', 'account', 'toAccount', 'note'];

export const dupKey = (type, date, title) => `${type}|${date}|${title}`;

// 匯入預覽：每一列標成 ok / duplicate / error
// existing: [{type, date, title}]
export function buildImportPreview(text, existing) {
  const { header, records } = parseCSVObjects(text);
  const missing = ['type', 'date', 'title'].filter((h) => !header.includes(h));
  if (missing.length) return { error: `缺少欄位：${missing.join(', ')}（需要 type,date,title,project,note）`, rows: [] };

  const seen = new Set(existing.map((e) => dupKey(e.type, e.date, e.title)));
  const rows = records.map((r, i) => {
    const row = {
      line: i + 2,
      type: r.type,
      date: r.date,
      title: r.title,
      project: r.project || '',
      note: r.note || '',
      done: /^(true|1|yes|v|是)$/i.test(r.done || ''),
    };
    const errors = [];
    if (row.type !== 'task' && row.type !== 'deadline') errors.push('type 要是 task 或 deadline');
    if (!isValidDateStr(row.date)) errors.push('日期要是 YYYY-MM-DD');
    if (!row.title) errors.push('沒有標題');
    if (errors.length) return { ...row, status: 'error', errors, selected: false };
    const key = dupKey(row.type, row.date, row.title);
    if (seen.has(key)) return { ...row, status: 'duplicate', errors, selected: false };
    seen.add(key);
    return { ...row, status: 'ok', errors, selected: true };
  });
  return { error: null, rows };
}
