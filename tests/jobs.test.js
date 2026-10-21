import { describe, it, expect } from 'vitest';
import {
  jobUrlKey, findSameJob, planJobImport, filterJobs, officialUrlError, linkTypeOf, isJobClosed,
} from '../src/lib/jobs.js';
import { inboxDeadlines, emptyItem } from '../src/lib/inbox.js';
import { JOBS_2026_10_21 } from '../src/data/jobs20261021.js';

describe('求職：同一個職缺的判斷', () => {
  it('LinkedIn 只看職缺編號，參數和斜線不影響', () => {
    expect(jobUrlKey('https://www.linkedin.com/jobs/view/4477362860/')).toBe('linkedin:4477362860');
    expect(jobUrlKey('https://tw.linkedin.com/jobs/view/business-consultant-at-ibm-4477362860?trk=x')).toBe('linkedin:4477362860');
    expect(jobUrlKey('https://www.linkedin.com/jobs/search/?currentJobId=4477362860')).toBe('linkedin:4477362860');
  });
  it('職缺代碼不分大小寫，連結相同也算同一筆', () => {
    const old = [
      { id: 'a', kind: 'resume', title: '舊的賓士', jobId: 'mer00048ob' },
      { id: 'b', kind: 'resume', title: 'IBM', url: 'https://linkedin.com/jobs/view/4477362860' },
      { id: 'c', kind: 'competition', title: '比賽', url: 'https://www.linkedin.com/jobs/view/4395978261/' },
    ];
    expect(findSameJob({ jobId: 'MER00048OB' }, old).id).toBe('a');
    expect(findSameJob({ url: 'https://www.linkedin.com/jobs/view/4477362860/' }, old).id).toBe('b');
    expect(findSameJob({ url: 'https://www.linkedin.com/jobs/view/4395978261/' }, old)).toBeUndefined();
    expect(findSameJob({ jobId: 'MER00048OB' }, old, 'a')).toBeUndefined();
  });
});

describe('求職：匯入 2026/10/21 的職缺', () => {
  it('全新的時候：7 筆都新增，狀態都是未確認', () => {
    const rows = planJobImport(JOBS_2026_10_21, []);
    expect(rows.map((r) => r.action)).toEqual(Array(7).fill('add'));
    expect(rows.every((r) => r.job.status === '未確認' && r.job.resumeStatus === '未確認')).toBe(true);
    expect(rows.filter((r) => r.job.track === 'excluded')).toHaveLength(2);
  });
  it('已有相同職缺：更新職缺資訊，不動申請狀態、備註和其他紀錄', () => {
    const existing = [
      { id: 'old', kind: 'resume', title: 'IBM 顧問', company: 'IBM', url: 'https://www.linkedin.com/jobs/view/4477362860', status: '已投', note: '10/1 已寄', deadline: '' },
      { id: 'other', kind: 'resume', title: '別的工作', status: '要投' },
    ];
    const rows = planJobImport(JOBS_2026_10_21, existing);
    const up = rows.find((r) => r.target?.id === 'old');
    expect(up.action).toBe('update');
    expect(up.patch).toMatchObject({ title: '2027 Campus Hire Associate Business Consultant', deadline: '2026-12-13', track: 'fulltime' });
    expect(up.patch.status).toBeUndefined();
    expect(up.patch.note).toBeUndefined();
    expect(up.patch.resumeStatus).toBe('未確認'); // 舊紀錄沒有這欄才補
    expect(rows.filter((r) => r.action === 'add')).toHaveLength(6);
    expect(rows.some((r) => r.target?.id === 'other')).toBe(false);
  });
  it('套用過再算一次：全部都是一樣的，不會重複', () => {
    const existing = JOBS_2026_10_21.map((j, i) => ({ id: `j${i}`, ...emptyItem('resume'), ...j }));
    expect(planJobImport(JOBS_2026_10_21, existing).every((r) => r.action === 'same')).toBe(true);
  });
  it('沒公布的條件留空，不自己補', () => {
    const ibm = JOBS_2026_10_21.find((j) => j.company === 'IBM');
    expect(ibm.officialUrl).toBeUndefined();
    expect(ibm.startDate).toBeUndefined();
    expect(JOBS_2026_10_21.filter((j) => j.deadline).map((j) => j.company)).toEqual(['IBM']);
  });
});

describe('求職：連結類型', () => {
  it('LinkedIn 不能當正式投遞入口', () => {
    expect(officialUrlError('https://www.linkedin.com/jobs/view/1/')).toMatch(/LinkedIn/);
    expect(officialUrlError('https://careers.ibm.com/job/123')).toBe('');
    expect(officialUrlError('')).toBe('');
  });
  it('LinkedIn 網址一律標成 LinkedIn 職缺頁，就算存成別的', () => {
    expect(linkTypeOf({ url: 'https://www.linkedin.com/jobs/view/1/', urlType: 'company' })).toBe('linkedin');
    expect(linkTypeOf({ url: 'https://jobs.mercedes-benz.com/x', urlType: 'company' })).toBe('company');
  });
});

describe('求職：篩選', () => {
  const items = [
    { id: '1', kind: 'resume', title: 'A', track: 'intern', priority: 1, status: '未確認', resumeStatus: '撰寫中' },
    { id: '2', kind: 'resume', title: 'B', track: 'fulltime', priority: 2, status: '已投遞', resumeStatus: '已完成' },
    { id: '3', kind: 'resume', title: 'C', track: 'excluded', status: '未確認' },
    { id: '4', kind: 'resume', title: 'D', track: 'backup', priority: 3, status: '未錄取' },
    { id: '5', kind: 'resume', title: '舊的', status: '要投' },
    { id: '6', kind: 'competition', title: '比賽', status: '考慮中' },
  ];
  const ids = (f) => filterJobs(items, f).map((x) => x.id);
  it('預設：不含排除、已結束和非求職；依優先順序，沒填的排最後', () => {
    expect(ids({})).toEqual(['1', '2', '5']);
  });
  it('依分類、申請狀態、履歷狀態', () => {
    expect(ids({ track: 'fulltime' })).toEqual(['2']);
    expect(ids({ track: 'excluded' })).toEqual(['3']);
    expect(ids({ track: 'none' })).toEqual(['5']);
    expect(ids({ status: '未錄取' })).toEqual(['4']);
    expect(ids({ resumeStatus: '撰寫中' })).toEqual(['1']);
    expect(ids({ showClosed: true })).toEqual(['1', '2', '4', '3', '5']);
  });
  it('排除和已結束的不出現在行事曆', () => {
    expect(isJobClosed(items[2])).toBe(true);
    const dl = inboxDeadlines([
      { id: 'x', kind: 'resume', company: 'IBM', title: '顧問', deadline: '2026-12-13', status: '未確認', track: 'fulltime' },
      { id: 'y', kind: 'resume', title: '排除', deadline: '2026-12-01', status: '未確認', track: 'excluded' },
      { id: 'z', kind: 'resume', title: '不考慮', deadline: '2026-12-01', status: '不再考慮' },
    ]);
    expect(dl.map((d) => d.title)).toEqual(['截止：IBM｜顧問']);
  });
});
