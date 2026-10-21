// 求職追蹤：收件匣裡 kind = 'resume' 的那幾筆。舊的紀錄只會多出欄位，不會被改掉或刪掉

export const TBD = '待確認';

export const JOB_TRACKS = {
  intern: '實習主投',
  fulltime: '畢業後正職主投',
  backup: '全職備選',
  upskill: '補強後備選',
  excluded: '排除（目前不投）',
};
export const TRACK_ORDER = ['intern', 'fulltime', 'backup', 'upskill', 'excluded'];

export const APPLY_STATUSES = ['未確認', '準備中', '已投遞', '面試中', '錄取', '未錄取', '不再考慮'];
// 改版前的狀態：舊紀錄照原樣保留，編輯時也還能選
export const LEGACY_APPLY_STATUSES = ['要投', '已投', '面試', '結果'];
export const RESUME_STATUSES = ['未確認', '未開始', '撰寫中', '已完成'];

export const JOB_CLOSED_STATUSES = new Set(['錄取', '未錄取', '不再考慮', '結果']);
export const isJobClosed = (it) => JOB_CLOSED_STATUSES.has(it.status) || it.track === 'excluded';

// 職缺本身的資訊：重新整理後可以更新
export const LISTING_FIELDS = [
  'company', 'title', 'jobId', 'track', 'priority', 'url', 'urlType', 'officialUrl',
  'resumeVersion', 'resumeFocus', 'gap', 'known', 'toConfirm', 'deadline', 'excludeReason', 'asOf',
];
// 自己的進度：重新匯入也不會蓋掉
export const PROGRESS_FIELDS = ['status', 'resumeStatus', 'startDate', 'daysPerWeek', 'note', 'attachments', 'checkedAt', 'updates'];

export function emptyJob() {
  return {
    kind: 'resume', title: '', company: '', jobId: '', track: '', priority: '',
    url: '', urlType: '', officialUrl: '',
    resumeVersion: '', resumeFocus: '', gap: '', known: '', toConfirm: '',
    deadline: '', status: '未確認', resumeStatus: '未確認',
    startDate: '', daysPerWeek: '', note: '', attachments: [],
    excludeReason: '', asOf: '', checkedAt: '', updates: '',
  };
}

const host = (url) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

export const isLinkedIn = (url) => /(^|\.)linkedin\.com$/.test(host(url)) || /(^|\.)lnkd\.in$/.test(host(url));

const BOARDS = /(^|\.)(104\.com\.tw|1111\.com\.tw|cakeresume\.com|cake\.me|yourator\.co|indeed\.com|glassdoor\.com|518\.com\.tw)$/;

// 只看網址判斷是哪種頁面；LinkedIn 一律是 LinkedIn 職缺頁，不算正式投遞入口
export function guessLinkType(url) {
  const h = host(url);
  if (!h) return '';
  if (isLinkedIn(url)) return 'linkedin';
  if (BOARDS.test(h)) return 'board';
  return 'other';
}

export const LINK_TYPES = {
  linkedin: 'LinkedIn 職缺頁',
  board: '求職網站',
  company: '公司徵才網站',
  other: '其他連結',
};

export const linkTypeOf = (it) => (isLinkedIn(it.url) ? 'linkedin' : it.urlType || guessLinkType(it.url));

// 正式投遞入口不能填 LinkedIn
export function officialUrlError(url) {
  const u = (url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//.test(u)) return '網址要以 https:// 開頭';
  if (isLinkedIn(u)) return 'LinkedIn 是職缺頁，不是正式投遞入口。請填公司官網的投遞網址，找不到就先留空。';
  return '';
}

// 同一個職缺的網址常常帶不同參數；LinkedIn 只看職缺編號
export function jobUrlKey(url) {
  const u = (url || '').trim();
  if (!u) return '';
  let p;
  try {
    p = new URL(u);
  } catch {
    return u.toLowerCase();
  }
  if (isLinkedIn(u)) {
    const m = /\/jobs\/view\/(?:[^/]*-)?(\d+)/.exec(p.pathname) || [null, p.searchParams.get('currentJobId')];
    if (m[1]) return `linkedin:${m[1]}`;
  }
  return `${p.hostname.toLowerCase().replace(/^www\./, '')}${p.pathname.replace(/\/+$/, '').toLowerCase()}`;
}

const idKey = (s) => (s || '').trim().toLowerCase();

// 找出跟這個職缺是同一筆的既有紀錄：職缺代碼相同，或職缺連結／正式入口相同
export function findSameJob(job, existing, exceptId) {
  const jid = idKey(job.jobId);
  const keys = new Set([jobUrlKey(job.url), jobUrlKey(job.officialUrl)].filter(Boolean));
  return existing.find((e) => {
    if (e.kind !== 'resume' || e.id === exceptId) return false;
    if (jid && idKey(e.jobId) === jid) return true;
    return [jobUrlKey(e.url), jobUrlKey(e.officialUrl)].some((k) => k && keys.has(k));
  });
}

const same = (a, b) => String(a ?? '') === String(b ?? '');

// 一批整理好的職缺 → 哪些要新增、哪些更新既有的、哪些已經一樣
// 更新只改職缺資訊；申請狀態、履歷狀態、到職日、出勤、備註、附件都保留原本的
export function planJobImport(batch, existing) {
  const rows = [];
  const pool = existing.filter((e) => e.kind === 'resume');
  for (const raw of batch) {
    const job = { ...emptyJob(), ...raw };
    const inBatch = rows.find((r) => r.action === 'add' && findSameJob(job, [{ ...r.job, id: '__batch' }]));
    if (inBatch) continue;
    const target = findSameJob(job, pool);
    if (!target) {
      rows.push({ action: 'add', job });
      continue;
    }
    const patch = {};
    for (const k of LISTING_FIELDS) {
      const v = job[k];
      if (v === '' || v == null) continue;
      if (!same(target[k], v)) patch[k] = v;
    }
    // 自己的進度欄位：舊紀錄沒有這個欄位才補上預設值
    for (const k of PROGRESS_FIELDS) {
      if (target[k] === undefined && job[k] !== undefined && !(k === 'note' && !job[k])) patch[k] = job[k];
    }
    rows.push({ action: Object.keys(patch).length ? 'update' : 'same', job, target, patch });
  }
  return rows;
}

export const priorityNum = (p) => {
  const n = Number(p);
  return p === '' || p == null || Number.isNaN(n) ? Infinity : n;
};

export function sortJobs(list) {
  return list.slice().sort(
    (a, b) =>
      priorityNum(a.priority) - priorityNum(b.priority) ||
      (a.deadline || '9999').localeCompare(b.deadline || '9999') ||
      (a.company || '').localeCompare(b.company || ''),
  );
}

// filter：track（'all'、'none' 或分類）、status、resumeStatus（'all' 或狀態）、showClosed
export function filterJobs(items, { track = 'all', status = 'all', resumeStatus = 'all', showClosed = false } = {}) {
  return sortJobs(
    items.filter((it) => {
      if (it.kind !== 'resume') return false;
      if (track === 'none' ? TRACK_ORDER.includes(it.track) : track !== 'all' && it.track !== track) return false;
      if (status !== 'all' && (it.status || '未確認') !== status) return false;
      if (resumeStatus !== 'all' && (it.resumeStatus || '未確認') !== resumeStatus) return false;
      // 選了「排除」或已結束的狀態，就直接顯示
      if (!showClosed && track !== 'excluded' && status === 'all' && isJobClosed(it)) return false;
      return true;
    }),
  );
}

export const orTBD = (v) => (v === '' || v == null ? TBD : v);

// 履歷附件：檔案存在 jobFiles/{id}（Firestore 一份文件上限 1 MiB，base64 會變大 1/3）
export const ATTACH_MAX_BYTES = 700 * 1024;
