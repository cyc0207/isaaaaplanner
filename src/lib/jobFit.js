// 求職信：找出信裡的職缺連結，再用關鍵字對照我的求職條件，給一個初步判斷
// 只是關鍵字比對，不是 AI；細看請按「複製給 Claude」
import { jobUrlKey } from './jobs.js';

// 信裡的連結 → 職缺頁（LinkedIn 統一成 /jobs/view/編號/，其他去掉追蹤參數）
export function jobLinksIn(links = [], body = '') {
  const all = [...links, ...(body.match(/https?:\/\/[^\s<>"')\]]+/g) || [])];
  const out = [];
  const seen = new Set();
  for (const raw of all) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    let link = '';
    if (/(^|\.)linkedin\.com$/.test(host)) {
      const m = /\/jobs\/view\/(?:[^/]*-)?(\d+)/.exec(u.pathname) || [null, u.searchParams.get('currentJobId')];
      if (m[1]) link = `https://www.linkedin.com/jobs/view/${m[1]}/`;
    } else if (/(^|\.)(104\.com\.tw|1111\.com\.tw)$/.test(host) && /\/job\//.test(u.pathname)) {
      link = `https://${u.hostname}${u.pathname}`;
    } else if (/(^|\.)(cake\.me|cakeresume\.com|yourator\.co)$/.test(host) && /\/jobs\//.test(u.pathname)) {
      link = `https://${u.hostname}${u.pathname}`;
    } else if (!/(^|\.)(google\.com|gmail\.com|facebook\.com|instagram\.com|youtube\.com|twitter\.com|x\.com)$/.test(host) && /\/(jobs?|careers?|positions?|vacanc(y|ies)|opening)s?\b/i.test(u.pathname) && !/unsubscribe|settings|preferences/i.test(u.href)) {
      link = `https://${u.hostname}${u.pathname}`;
    }
    if (!link) continue;
    const key = jobUrlKey(link);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

const has = (re, t) => re.test(t);

// 方向：商業分析、數位轉型、產品／專案、產品營運、AI 應用、跨部門協作
const DIRECTIONS = [
  ['商業分析', /商業分析|business analy|\bBA\b|data analy|數據分析|資料分析/i],
  ['數位轉型', /數位轉型|digital transformation|\bdx\b|數位化/i],
  ['產品／專案', /產品|專案|product|project|\bPM\b|program/i],
  ['營運', /營運|operations?\b|\bops\b/i],
  ['AI／自動化', /\bAI\b|人工智慧|生成式|LLM|自動化|automation|RPA|power platform|power automate/i],
  ['跨部門協作', /跨部門|cross[- ]functional|stakeholder|協調/i],
];
const SKILLS = [
  ['需求／流程／UAT', /需求|流程|UAT|測試|驗收|requirement|process|user acceptance/i],
  ['Python／資料處理', /python|資料處理|data (cleaning|processing)|pandas/i],
];

// 回傳 { verdict, pros, cons, unknown }；verdict：建議投、可以考慮、先不投、資訊不足
export function assessJob(text) {
  const t = text || '';
  const pros = [];
  const cons = [];
  const unknown = [];
  let hard = false;

  const dirs = DIRECTIONS.filter(([, re]) => has(re, t)).map(([l]) => l);
  if (dirs.length) pros.push(`符合方向：${dirs.join('、')}`);
  const skills = SKILLS.filter(([, re]) => has(re, t)).map(([l]) => l);
  if (skills.length) pros.push(`用得上你的經驗：${skills.join('、')}`);

  const intern = has(/實習|intern(ship)?\b|兼職|part[- ]time/i, t);
  const campus = has(/校園|應屆|新鮮人|campus|graduate|entry[- ]level|儲備/i, t);
  if (intern) pros.push('是實習／兼職，比較可能配合每週 3～4 天');
  if (campus) pros.push('校園招募或新鮮人職缺');

  // 年資：抓「N 年以上經驗」「N+ years of experience」
  const yrs = [...t.matchAll(/(\d{1,2})\s*(?:\+|年以上|年\s*以上|年|\s*-\s*\d+\s*years?|\s*years?)[^。\n.;；]{0,20}?(?:工作|相關|實務)?\s*(?:經驗|經歷|experience)/gi)]
    .map((m) => Number(m[1]))
    .filter((n) => n > 0 && n < 30);
  const maxYrs = yrs.length ? Math.max(...yrs) : 0;
  if (maxYrs >= 2) {
    cons.push(`要求 ${maxYrs} 年以上經驗`);
    hard = true;
  } else if (maxYrs === 1) cons.push('要求 1 年經驗，實習經歷可能可以抵，要問');

  if (has(/資深|senior|\blead\b|主管|manager(?!\s*intern)/i, t) && !has(/product manager|project manager|產品經理|專案經理/i, t)) {
    cons.push('看起來是資深或主管職');
    hard = true;
  }
  if (has(/約聘|派遣|contract(or)?\b|temporary|12\s*個月以上|十二個月以上/i, t)) {
    cons.push('約聘／派遣');
    hard = true;
  }
  if (has(/保險[^。\n]{0,15}(經驗|背景)|insurance[^.\n]{0,30}experience|experience[^.\n]{0,20}insurance/i, t)) {
    cons.push('要保險業經驗');
    hard = true;
  }
  if (has(/(熟悉|熟練|精通|proficient|strong|advanced|required|必備)[^。\n.]{0,15}SQL|SQL[^。\n.]{0,15}(必備|required|熟練|熟悉)/i, t)) cons.push('要求 SQL（你最需補強的項目）');
  if (has(/多益|TOEIC|IELTS|雅思|托福|TOEFL|英文檢定|英檢|語言證照/i, t)) cons.push('提到英文檢定，你目前沒有證照，要確認是不是必備');
  if (has(/英文流利|流利.{0,4}英|fluent in english|english.{0,10}(fluent|proficien)|business english/i, t)) cons.push('要求流利英文，面試可能會考英文');
  if (!intern && has(/全職|full[- ]time/i, t)) cons.push('全職：2027/02 前你還在上課，要問能不能先每週 3～4 天');
  if (has(/每週\s*(5|五)\s*天|週一至週五|monday (to|through) friday|5 days a week/i, t)) cons.push('要每週 5 天，跟下學期的課可能衝突');

  if (!has(/到職|報到|start(ing)? date|起始|2027\s*[/年.-]\s*0?[1-3]\b|immediate/i, t)) unknown.push('到職時間');
  if (!has(/每[週周]\s*(至少|最少|可|需)?\s*[\d一二三四五]\s*[天日]|\d\s*(天|days)\s*(\/|per|a)\s*(週|week)|days? a week|週[一二三四五]至/i, t)) unknown.push('每週出勤天數');
  if (!has(/截止|deadline|apply by|before/i, t)) unknown.push('截止日');

  let verdict;
  if (t.trim().length < 30) verdict = '資訊不足';
  else if (hard) verdict = '先不投';
  else if (dirs.length && (intern || campus)) verdict = '建議投';
  else if (dirs.length) verdict = '可以考慮';
  else verdict = '先不投';
  if (verdict === '先不投' && !hard && !dirs.length) cons.push('看不出跟你的方向（商業分析、數位轉型、產品／專案、營運、AI 應用）有關');
  return { verdict, pros, cons, unknown };
}

export const VERDICT_CLASS = { 建議投: 'ok', 可以考慮: '', 先不投: 'warn', 資訊不足: 'warn' };

// 複製給 Claude 細看：一封信可能有好幾個職缺
export function jobMailPrompt(profile, mail) {
  return `請幫我判斷這封求職信裡的職缺要不要投。

【我的求職條件】
${profile}

【規則】
- 信裡有幾個職缺就逐一列出：公司、職稱、連結。
- 每個給一個判斷：建議投／可以考慮／先不投，理由要對照我的條件（到職時間、每週天數、方向、年資、英文、SQL 等）。
- 信裡沒寫的條件寫「待確認」，不要自己補。
- LinkedIn 連結只是職缺頁，不要說成官方投遞入口。
- 建議投的，順便說履歷要強調什麼、最需要補強什麼。
- 不要寫我曾在 DBS 使用英文進行職場溝通。

【信】
標題：${mail.subject}
寄件者：${mail.from}（${mail.date}）
${(mail.jobLinks || []).length ? `職缺連結：\n${mail.jobLinks.join('\n')}\n` : ''}
${(mail.body || mail.snippet || '').slice(0, 8000)}`;
}
