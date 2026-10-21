// 2026/10/21 整理的職缺（不保證仍開放）。沒公布的條件留空，畫面上顯示「待確認」
// 申請狀態、履歷狀態都還不知道，所以是「未確認」

export const JOB_BATCH_ID = '2026-10-21';

const base = { asOf: '2026-10-21', status: '未確認', resumeStatus: '未確認' };

export const JOBS_2026_10_21 = [
  {
    ...base,
    company: '台灣賓士',
    title: 'Information Technology IT 實習生',
    jobId: 'MER00048OB',
    track: 'intern',
    priority: 1,
    url: 'https://jobs.mercedes-benz.com/enUS/intern-information-technology-239294-mer00048ob',
    urlType: 'company',
    resumeVersion: '賓士_IT數位轉型實習_履歷',
    resumeFocus: '需求分析、流程優化、跨部門協調、文件製作、AI 與自動化應用',
    gap: 'Power Platform 實作',
    known: '六個月實習，每週至少三天；要求流利中英文、熟悉 M365／Power Platform／AI 產品',
    toConfirm: '是否接受尚未取得學士學位的在學生；是否接受 2027/02 到職',
    daysPerWeek: '至少 3 天（職缺要求）',
  },
  {
    ...base,
    company: 'IBM',
    title: '2027 Campus Hire Associate Business Consultant',
    track: 'fulltime',
    priority: 2,
    url: 'https://www.linkedin.com/jobs/view/4477362860/',
    urlType: 'linkedin',
    resumeVersion: 'IBM_商業顧問校園招募_履歷',
    resumeFocus: '專題領導、需求與流程分析、進度管理、問題解決、跨部門協作',
    gap: '英文專案簡報與追問應答',
    known: '接受 2026／2027 畢業、可於 2027 年入職者；要求流利中英文',
    deadline: '2026-12-13',
    toConfirm: '確切入職月份；畢業資格與全職出勤能否配合',
  },
  {
    ...base,
    company: 'Shopee',
    title: 'Shopee APP－Business Analyst 商城專案分析',
    track: 'backup',
    priority: 3,
    url: 'https://www.linkedin.com/jobs/view/4395978261/',
    urlType: 'linkedin',
    resumeVersion: 'Shopee_商城專案分析_履歷',
    resumeFocus: '專案協調、目標與進度追蹤、數據分析、簡報、推動問題改善',
    gap: '把數據分析轉成行動方案與 KPI',
    known: '初階全職，偏商業營運與跨部門專案推動',
    toConfirm: '是否接受 2027/02 到職；是否有相近實習職缺或每週四天安排',
  },
  {
    ...base,
    company: 'Infosys',
    title: 'Business Analyst〈系統／資料庫遷移〉',
    track: 'backup',
    priority: 4,
    url: 'https://www.linkedin.com/jobs/view/4476624462/',
    urlType: 'linkedin',
    resumeVersion: 'Infosys_系統需求分析_履歷',
    resumeFocus: '需求文件、系統流程、測試情境、UAT、驗收條件、技術與業務溝通',
    gap: '企業系統與資料遷移流程',
    known: '全職，要求企業系統或遷移相關 BA 經驗',
    toConfirm: '年資接受程度；英文實際使用要求；2027/02 到職與出勤安排',
  },
  {
    ...base,
    company: 'Shopee',
    title: 'B2C Business Data Analyst 數據分析師',
    track: 'upskill',
    priority: 5,
    url: 'https://www.linkedin.com/jobs/view/4360899091/',
    urlType: 'linkedin',
    resumeVersion: 'Shopee_B2C數據分析_履歷',
    resumeFocus: 'Python、資料清理、自動化、商業問題分析',
    gap: 'SQL',
    known: '全職，明確要求熟練 SQL；Python 與儀表板工具為加分',
    toConfirm: '年資要求；2027/02 到職與出勤安排',
  },
  {
    ...base,
    company: 'Infosys',
    title: '保險 NB／POS Business Analyst',
    track: 'excluded',
    url: 'https://www.linkedin.com/jobs/view/4470838874/',
    urlType: 'linkedin',
    excludeReason: '要求至少三年相關保險作業經驗',
  },
  {
    ...base,
    company: 'Ampstek',
    title: 'Junior Business Analyst',
    track: 'excluded',
    url: 'https://www.linkedin.com/jobs/view/4468776468/',
    urlType: 'linkedin',
    excludeReason: '雖寫 Junior，內文要求多年保險經驗，且為十二個月以上約聘',
  },
];

// 我的求職條件（首次顯示用，可以在求職頁改）
export const DEFAULT_JOB_PROFILE = `- 目前在 DBS 星展銀行 WMS 實習，預計至 2027/01/31。
- 下一份工作優先希望 2027/02 起銜接。
- 下學期仍有課，以每週 3～4 天的實習為優先。
- 方向：商業分析、數位轉型、產品／專案、產品營運、AI 應用與跨部門協作。
- 背景：DBS WMS 的 UAT／流程文件經驗、DECORATE ME 專題組長與校內專題發表優勝、Python／資料處理／自動化。
- 目前沒有英文檢定證照。
- 不要寫我曾在 DBS 使用英文進行職場溝通。`;
