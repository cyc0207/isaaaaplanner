import { weekDays } from './date.js';
import { DRINK, isLivingExpense, weekDrinkLeft } from './budget.js';

// 今天要不要喝飲料：轉盤格子比例看本週飲料預算、杯數和全糖杯數
// logs：飲料打卡（foodLog），沒順便記帳的那幾杯也算進杯數
export function drinkOdds({ budget, expenses, day, logs = [] }) {
  const cat = (budget?.categories || []).find((c) => c.name === DRINK);
  const perItem = Number(cat?.perItem) || 0;
  const perWeek = Number(cat?.perWeekCount) || 0;
  const { left, weekly } = weekDrinkLeft(budget, expenses, day);
  const days = weekDays(day);
  const week = expenses.filter((e) => isLivingExpense(e) && e.category === DRINK && e.date >= days[0] && e.date <= days[6]);
  const snaps = logs.filter((l) => l.slot === 'drink' && l.date >= days[0] && l.date <= days[6]);
  const { cups, fullSugar, today } = mergeCups(week, snaps, day);

  let drink = 2;
  let skip = 1;
  const reasons = [];
  if (weekly > 0 && left < perItem) {
    drink = 1;
    skip = 4;
    reasons.push(`本週飲料預算剩 $${Math.max(0, left)}，不夠一杯，「不喝」的格子變多`);
  } else if (perWeek > 0 && cups >= perWeek) {
    drink = 1;
    skip = 2;
    reasons.push(`本週已經喝 ${cups} 杯，達到設定的 ${perWeek} 杯`);
  } else if (weekly > 0) {
    reasons.push(`本週還剩 $${left}，大約 ${perItem ? Math.floor(left / perItem) : 0} 杯`);
  }
  if (fullSugar >= 2) {
    skip += 1;
    reasons.push(`本週全糖 ${fullSugar} 杯，要喝的話選無糖或微糖`);
  }
  if (today > 0) {
    skip += 1;
    reasons.push(`今天已經喝過 ${today} 杯`);
  }
  if (!reasons.length) reasons.push('還沒設定飲料預算，用預設比例');
  return { drink, skip, reasons, left, perItem, cups, fullSugar, today };
}

// 記帳的飲料和飲料打卡可能是同一杯：每天取兩邊比較多的那個，不重複算
export function mergeCups(expenses, snaps, day) {
  const per = {};
  const bump = (d, k, full) => {
    per[d] ||= { e: 0, s: 0, ef: 0, sf: 0 };
    per[d][k] += 1;
    if (full) per[d][`${k}f`] += 1;
  };
  for (const e of expenses) bump(e.date, 'e', e.drink?.sugar === '全糖');
  for (const l of snaps) bump(l.date, 's', l.sugar === '全糖');
  let cups = 0;
  let fullSugar = 0;
  for (const v of Object.values(per)) {
    cups += Math.max(v.e, v.s);
    fullSugar += Math.max(v.ef, v.sf);
  }
  const t = per[day];
  return { cups, fullSugar, today: t ? Math.max(t.e, t.s) : 0 };
}

// 轉盤的格子：喝和不喝交錯排
export function drinkSegments({ drink, skip }) {
  const out = [];
  let d = 0;
  let s = 0;
  while (d < drink || s < skip) {
    if (d < drink) out.push({ id: `drink-${d++}`, name: '喝！', yes: true, color: 'var(--wheel-1)' });
    if (s < skip) out.push({ id: `skip-${s++}`, name: '今天不喝', yes: false, color: 'var(--wheel-3)' });
  }
  return out;
}

// 飲料店分類
export const DRINK_GROUPS = [
  ['咖啡', /coffee|咖啡|星巴克|starbucks|路易莎|louisa|cama|伯朗/i],
  ['果汁・冰沙', /juice|果汁|冰沙|smoothie/i],
  ['甜點・冰品', /ice_cream|dessert|冰品|豆花|甜點|雪花冰/i],
  ['手搖飲・茶', /./],
];
