import { parseCSVObjects } from './csv.js';
import { isValidDateStr } from './date.js';
import { extractCSV } from './english.js';

export const KINDS = { competition: '比賽', resume: '履歷', other: '其他' };

export const STATUSES = {
  competition: ['考慮中', '要報', '已報', '放棄'],
  resume: ['要投', '已投', '面試', '結果'],
  other: ['考慮中', '要做', '完成', '放棄'],
};

// 已經結束的不再出現在行事曆
const CLOSED = new Set(['放棄', '結果', '完成']);

export const isPending = (item) => item.status === '考慮中';

// 收件匣的截止日轉成行事曆上的期限（唯讀，點了回收件匣編輯）
export function inboxDeadlines(inbox) {
  const out = [];
  for (const it of inbox) {
    if (CLOSED.has(it.status)) continue;
    const kind = KINDS[it.kind] || '其他';
    if (it.deadline) {
      out.push({
        id: `inbox:${it.id}:deadline`, inboxId: it.id, fromInbox: true, date: it.deadline,
        title: `${it.kind === 'competition' ? '報名截止' : '截止'}：${it.title}`, project: kind, note: '', remindDayBefore: true, tentative: false,
      });
    }
    if (it.kind === 'competition' && it.submitDate) {
      out.push({
        id: `inbox:${it.id}:submit`, inboxId: it.id, fromInbox: true, date: it.submitDate,
        title: `繳件：${it.title}`, project: kind, note: '', remindDayBefore: true, tentative: false,
      });
    }
  }
  return out;
}

export function emptyItem(kind = 'competition') {
  return { kind, title: '', company: '', deadline: '', submitDate: '', url: '', status: STATUSES[kind][0], canReuseProject: false, note: '' };
}

// ---- 從 ChatGPT 匯入：貼上它整理的 CSV ----

export const INBOX_HEADER = ['kind', 'title', 'company', 'deadline', 'submitDate', 'url', 'status', 'note'];

const KIND_ALIASES = {
  competition: 'competition', 比賽: 'competition', 競賽: 'competition', contest: 'competition', hackathon: 'competition', 黑客松: 'competition', 提案: 'competition',
  resume: 'resume', 履歷: 'resume', job: 'resume', 職缺: 'resume', 實習: 'resume', internship: 'resume', 工作: 'resume',
  other: 'other', 其他: 'other',
};

export const normKind = (k) => KIND_ALIASES[(k || '').trim().toLowerCase()] || KIND_ALIASES[(k || '').trim()] || '';

// 2026/11/30、2026.11.30、2026-1-5 都轉成 2026-11-30；認不得就回傳 null
export function normDate(s) {
  const t = (s || '').trim();
  if (!t) return '';
  const m = /^(20\d\d)\s*[/.\-年]\s*(\d{1,2})\s*[/.\-月]\s*(\d{1,2})日?$/.exec(t);
  if (!m) return null;
  const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return isValidDateStr(d) ? d : null;
}

export const inboxKey = (kind, title) => `${kind}|${(title || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;

export function buildInboxPreview(text, existing) {
  const { header, records } = parseCSVObjects(extractCSV(text, /^\s*"?kind"?\s*,\s*"?title"?/i));
  const h = header.map((x) => x.toLowerCase());
  if (!h.includes('kind') || !h.includes('title')) {
    return { error: '找不到表頭 kind,title,company,deadline,submitDate,url,status,note。請確認貼上的是 ChatGPT 給的 CSV。', rows: [] };
  }
  const seen = new Set(existing.map((e) => inboxKey(e.kind, e.title)));
  const rows = records.map((r0, i) => {
    const r = Object.fromEntries(Object.entries(r0).map(([k, v]) => [k.toLowerCase(), v]));
    const kind = normKind(r.kind);
    const errors = [];
    const warnings = [];
    if (!kind) errors.push(`不認得的 kind「${r.kind}」`);
    if (!r.title) errors.push('title 是空的');
    const fixDate = (v, label) => {
      const d = normDate(v);
      if (d === null) {
        warnings.push(`${label}「${v}」看不懂，先留空`);
        return '';
      }
      return d;
    };
    const statuses = STATUSES[kind] || STATUSES.other;
    const row = {
      line: i + 2,
      rawKind: r.kind,
      ...emptyItem(kind || 'other'),
      kind: kind || 'other',
      title: r.title || '',
      company: r.company || '',
      deadline: fixDate(r.deadline, '截止日'),
      submitDate: kind === 'competition' ? fixDate(r.submitdate, '繳件日') : '',
      url: /^https?:\/\//.test(r.url || '') ? r.url : '',
      status: statuses.includes(r.status) ? r.status : statuses[0],
      note: r.note || '',
    };
    if (errors.length) return { ...row, status_: 'error', errors, warnings, selected: false };
    const key = inboxKey(row.kind, row.title);
    if (seen.has(key)) return { ...row, status_: 'duplicate', errors, warnings, selected: false };
    seen.add(key);
    return { ...row, status_: 'ok', errors, warnings, selected: true };
  });
  return { error: null, rows };
}

export const INBOX_GPT_PROMPT = `我想把你知道的、跟我有關的比賽、實習／工作機會整理出來，匯入我自己的計畫網站。請照下面四步做。

第一步：先說清楚你能看到哪些來源
1. 你的「記憶」裡跟我參加比賽、找實習或工作有關的內容
2. 你能參考的過去對話（如果我有開「參考聊天紀錄」）
3. 這個對話裡我貼給你的東西
請老實說哪些看得到、哪些看不到。看不到的部分，告訴我具體要怎麼補給你。

第二步：蒐集
列出所有我提過、想報、已報、在準備的比賽，想投或已投的實習／工作，以及其他有期限的機會。
每一筆盡量找出：名稱、主辦單位或公司、報名截止日、繳件日、官方網址、我目前的進度。
不要編造。日期或網址不確定就留空，並在 note 寫「不確定」。重複的合併成一筆。已經過期很久、確定沒在進行的也列出來，status 寫「放棄」或「結果」。

第三步：輸出成 CSV
只輸出一個 code block，第一行固定是表頭：
kind,title,company,deadline,submitDate,url,status,note
- kind 只能是：competition（比賽）、resume（實習或工作）、other（其他）
- title：比賽名稱或職缺名稱
- company：主辦單位或公司，沒有就留空
- deadline：報名或投遞截止日，格式 YYYY-MM-DD
- submitDate：比賽的繳件日，格式 YYYY-MM-DD，沒有就留空
- url：官方網址
- status：competition 只能填 考慮中、要報、已報、放棄；resume 只能填 要投、已投、面試、結果；other 只能填 考慮中、要做、完成、放棄
- note：補充，例如可以用哪個現有專題去投、需要準備什麼
欄位裡有逗號、換行或雙引號時，整格用雙引號包起來，裡面的雙引號寫成兩個。

第四步：統計
輸出完用兩行告訴我：總共幾筆、每種 kind 各幾筆，以及最近一個截止日是哪一筆。`;
