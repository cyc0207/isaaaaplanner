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
