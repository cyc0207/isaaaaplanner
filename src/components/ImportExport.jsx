import { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { useData } from '../data.jsx';
import { buildImportPreview } from '../lib/csv.js';
import { runExport, EXPORTS } from '../lib/exporters.js';
import { today, monthKey, monthRange } from '../lib/date.js';

const STATUS_LABEL = { ok: '新的', duplicate: '重複', error: '有錯' };

export default function ImportExport() {
  const data = useData();
  const { tasks, deadlines, api } = data;
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState('');
  const range = monthRange(monthKey(today()));
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [exportMsg, setExportMsg] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResult('');
    setFileName(file.name);
    const text = await file.text();
    const existing = [
      ...tasks.map((t) => ({ type: 'task', date: t.date, title: t.title })),
      ...deadlines.map((d) => ({ type: 'deadline', date: d.date, title: d.title })),
    ];
    setPreview(buildImportPreview(text, existing));
  };

  const toggle = (i) =>
    setPreview({ ...preview, rows: preview.rows.map((r, j) => (j === i && r.status !== 'error' ? { ...r, selected: !r.selected } : r)) });

  const confirm = () => {
    const rows = preview.rows.filter((r) => r.selected && r.status !== 'error');
    const ops = rows.map((r) =>
      r.type === 'task'
        ? {
            add: 'tasks',
            data: { title: r.title, date: r.date, project: r.project, note: r.note, done: r.done, doneAt: r.done ? serverTimestamp() : null, isToday: false },
          }
        : { add: 'deadlines', data: { title: r.title, date: r.date, project: r.project, note: r.note, remindDayBefore: false, tentative: false } },
    );
    // Firestore 一個批次最多 500 筆
    for (let i = 0; i < ops.length; i += 400) api.batch(ops.slice(i, i + 400));
    const skipped = preview.rows.length - rows.length;
    setResult(`已匯入 ${rows.length} 筆${skipped ? `，略過 ${skipped} 筆` : ''}。`);
    setPreview(null);
  };

  const counts = preview?.rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}) || {};
  const selectedCount = preview?.rows.filter((r) => r.selected).length || 0;

  return (
    <div className="import-export">
      <h3>匯入任務與期限（CSV）</h3>
      <p className="muted small">欄位：type,date,title,project,note（type 是 task 或 deadline，日期 YYYY-MM-DD）。</p>
      <label className="btn file-btn">
        選擇 CSV 檔
        <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
      </label>
      {result && <p className="hint ok">{result}</p>}
      {preview?.error && <p className="hint over">{preview.error}</p>}
      {preview && !preview.error && (
        <div className="preview">
          <p>
            <strong>{fileName}</strong>：共 {preview.rows.length} 列・新的 {counts.ok || 0}・重複 {counts.duplicate || 0}・有錯 {counts.error || 0}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>匯入</th>
                  <th>狀態</th>
                  <th>type</th>
                  <th>date</th>
                  <th>title</th>
                  <th>project</th>
                  <th>note</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i} className={`st-${r.status}`}>
                    <td>
                      <input type="checkbox" checked={r.selected} disabled={r.status === 'error'} onChange={() => toggle(i)} aria-label={`匯入第 ${r.line} 列`} />
                    </td>
                    <td>
                      {STATUS_LABEL[r.status]}
                      {r.errors.length > 0 && <div className="small">{r.errors.join('；')}</div>}
                    </td>
                    <td>{r.type}</td>
                    <td>{r.date}</td>
                    <td>{r.title}</td>
                    <td>{r.project}</td>
                    <td>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row gap">
            <button className="btn primary" disabled={!selectedCount} onClick={confirm}>
              確認匯入 {selectedCount} 筆
            </button>
            <button className="btn" onClick={() => setPreview(null)}>
              取消
            </button>
          </div>
        </div>
      )}

      <h3>匯出 CSV</h3>
      <div className="row gap wrap">
        <label className="mini">
          從
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="mini">
          到
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="row gap wrap">
        {Object.entries(EXPORTS).map(([k, e]) => (
          <button
            key={k}
            className="btn"
            disabled={!from || !to || from > to}
            onClick={() => setExportMsg(`已匯出${e.label} ${runExport(data, k, from, to)} 筆`)}
          >
            匯出{e.label}
          </button>
        ))}
      </div>
      {exportMsg && <p className="hint ok">{exportMsg}</p>}
      <p className="muted small">檔案是 UTF-8 with BOM，Excel 直接打開中文不會亂碼；任務和期限的檔案可以直接再匯入。</p>
    </div>
  );
}
