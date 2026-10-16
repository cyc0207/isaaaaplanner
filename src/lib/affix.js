// 常見字首、字根、字尾：用來把卡片分組，以及在閱讀時拆解單字
// min：拆掉這段之後，剩下的部分至少要幾個字母，避免 apple 被當成 ap- 開頭

export const KINDS = { prefix: '字首', root: '字根', suffix: '字尾' };

const P = (part, zh, min = 3) => ({ kind: 'prefix', part, zh, min });
const R = (part, zh, alts = []) => ({ kind: 'root', part, zh, alts });
const S = (part, zh, min = 3) => ({ kind: 'suffix', part, zh, min });

export const AFFIXES = [
  P('re', '再、回', 4), P('pre', '之前'), P('pro', '向前'), P('dis', '不、相反'), P('un', '不', 4), P('mis', '錯'),
  P('ex', '向外', 4), P('de', '向下、去除', 4), P('inter', '之間'), P('trans', '穿越、轉'), P('sub', '下面'),
  P('super', '上面、超'), P('over', '過度、上方'), P('out', '超過、向外'), P('under', '下面、不足'),
  P('con', '一起', 4), P('com', '一起', 4), P('col', '一起', 4), P('co', '一起', 4), P('multi', '多'), P('auto', '自己'),
  P('im', '不、進入', 4), P('in', '不、進入', 4), P('en', '使…', 4),
  R('spect', '看'), R('vis', '看', ['vid']), R('port', '帶、運'), R('dict', '說'), R('duct', '引導', ['duc']),
  R('fer', '帶'), R('mit', '送', ['miss']), R('pos', '放', ['pon']), R('struct', '建造'), R('tract', '拉'),
  R('scrib', '寫', ['script']), R('graph', '寫、畫'), R('ven', '來', ['vent']), R('cept', '拿', ['ceive', 'ceipt', 'cap']),
  R('fin', '結束、界限'), R('vers', '轉', ['vert']), R('press', '壓'), R('sign', '標記'), R('form', '形狀'),
  R('cred', '相信'), R('ject', '丟'), R('log', '話、學問'), R('fund', '錢、基礎'), R('cap', '頭', ['capit']),
  R('man', '手', ['manu']), R('cur', '跑、關心', ['curr']), R('fect', '做', ['fic', 'fac']), R('pend', '掛、花費', ['pens']),
  R('vol', '意志、轉', ['volv']), R('liqu', '液體'), R('equ', '相等'), R('prov', '證明、有益', ['prob']),
  R('cess', '走', ['ced']), R('tain', '握住', ['ten']), R('plic', '摺', ['ply']), R('stat', '站', ['sist']),
  S('able', '可以…的'), S('ible', '可以…的'), S('tion', '名詞：動作、結果'), S('sion', '名詞：動作、結果'),
  S('ment', '名詞：結果'), S('ness', '名詞：狀態'), S('ity', '名詞：性質'), S('ance', '名詞'), S('ence', '名詞'),
  S('ize', '使…化'), S('ify', '使…'), S('ful', '充滿'), S('less', '沒有'), S('ous', '充滿…的'), S('ive', '…的'),
  S('al', '…的', 4), S('ly', '副詞：…地', 4), S('er', '人、物', 4), S('or', '人、物', 4), S('ist', '人'), S('ship', '身分、狀態'),
  S('ure', '名詞'), S('ary', '…的、相關的'), S('ory', '…的、地方'),
];

const byKey = Object.fromEntries(AFFIXES.map((a) => [`${a.kind}:${a.part}`, a]));
export const affixKey = (a) => `${a.kind}:${a.part}`;
export const affixLabel = (a) => (a.kind === 'prefix' ? `${a.part}-` : a.kind === 'suffix' ? `-${a.part}` : a.part);
export const getAffix = (key) => byKey[key];

// 拆一個單字：回傳找到的字首、字根、字尾和在字裡的位置
export function analyze(word) {
  const w = (word || '').toLowerCase();
  if (!/^[a-z-]+$/.test(w) || w.length < 4) return [];
  const out = [];
  let start = 0;
  let end = w.length;
  const pre = AFFIXES.filter((a) => a.kind === 'prefix').sort((a, b) => b.part.length - a.part.length)
    .find((a) => w.startsWith(a.part) && w.length - a.part.length >= a.min);
  if (pre) {
    out.push({ ...pre, start: 0, end: pre.part.length });
    start = pre.part.length;
  }
  const suf = AFFIXES.filter((a) => a.kind === 'suffix').sort((a, b) => b.part.length - a.part.length)
    .find((a) => w.endsWith(a.part) && w.length - a.part.length >= a.min && w.length - a.part.length >= start + 2);
  if (suf) {
    out.push({ ...suf, start: w.length - suf.part.length, end: w.length });
    end = w.length - suf.part.length;
  }
  // 字根找中間那段（也允許從開頭算，像 port、spect 開頭的字）
  const mid = w.slice(start, end + 1);
  let best = null;
  for (const a of AFFIXES.filter((x) => x.kind === 'root')) {
    for (const form of [a.part, ...a.alts]) {
      const i = mid.indexOf(form);
      if (i >= 0 && (!best || form.length > best.form.length)) best = { a, form, i };
    }
  }
  if (best) out.push({ ...best.a, start: start + best.i, end: start + best.i + best.form.length });
  return out.sort((x, y) => x.start - y.start);
}

// 卡片自己寫的字根提示優先（例如「sug-（下面）+ gest（帶）」），其次用自動拆解
export function cardAffixes(card) {
  if (!card || card.type === 'fix' || card.type === 'link' || card.type === 'sentence' || card.type === 'grammar') return [];
  const word = card.front.trim().split(/\s+/).sort((a, b) => b.length - a.length)[0] || '';
  const found = analyze(word);
  const keys = new Set(found.map(affixKey));
  const hint = (card.root || '').toLowerCase();
  for (const m of hint.matchAll(/(?:^|[\s+（(])(-?)([a-z]{2,})(-?)(?=\s*[（(]|$|\s)/g)) {
    const kind = m[3] ? 'prefix' : m[1] ? 'suffix' : 'root';
    const a = byKey[`${kind}:${m[2]}`] || AFFIXES.find((x) => x.kind === kind && x.alts?.includes(m[2]));
    if (a && !keys.has(affixKey(a))) {
      keys.add(affixKey(a));
      found.push({ ...a, start: -1, end: -1 });
    }
  }
  return found;
}

// 依字首／字根／字尾分組：{ key, affix, cards }，張數多的排前面
export function groupByAffix(cards, kind) {
  const groups = {};
  for (const c of cards) {
    for (const a of cardAffixes(c)) {
      if (a.kind !== kind) continue;
      const k = affixKey(a);
      (groups[k] ||= { key: k, affix: byKey[k], cards: [] }).cards.push(c);
    }
  }
  return Object.values(groups).sort((a, b) => b.cards.length - a.cards.length || a.affix.part.localeCompare(b.affix.part));
}

// ---- 閱讀：找出文章裡哪些字是卡片上的 ----

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildLexicon(cards) {
  const words = new Map();
  const phrases = [];
  for (const c of cards) {
    if (!c.front || c.type === 'fix' || c.type === 'link' || c.type === 'sentence' || c.type === 'grammar') continue;
    const f = c.front.trim().toLowerCase();
    if (/\s/.test(f)) phrases.push([f, c]);
    else if (/^[a-z][a-z'-]*$/.test(f)) words.set(f, c);
  }
  phrases.sort((a, b) => b[0].length - a[0].length);
  const phraseRe = phrases.length ? new RegExp(`\\b(${phrases.map(([p]) => esc(p).replace(/\s+/g, '\\s+')).join('|')})(?:s|es|d|ed|ing)?\\b`, 'gi') : null;
  return { words, phrases: new Map(phrases), phraseRe };
}

// 去掉常見詞尾變化再查：managed → manage、companies → company
export function lookup(lex, token) {
  const w = token.toLowerCase().replace(/[’']s$/, '');
  const cands = [w];
  if (w.endsWith('ies')) cands.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('ied')) cands.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) cands.push(w.slice(0, -2));
  if (w.endsWith('s')) cands.push(w.slice(0, -1));
  if (w.endsWith('ed')) cands.push(w.slice(0, -2), w.slice(0, -1), w.slice(0, -3));
  if (w.endsWith('ing')) cands.push(w.slice(0, -3), `${w.slice(0, -3)}e`, w.slice(0, -4));
  for (const c of cands) if (lex.words.has(c)) return lex.words.get(c);
  return null;
}

// 把文章切成一段一段：{ text, card?, word? }
export function segment(text, lex) {
  const out = [];
  const pushPlain = (s) => {
    for (const part of s.split(/([A-Za-z][A-Za-z'’-]*)/)) {
      if (!part) continue;
      if (/^[A-Za-z]/.test(part)) out.push({ text: part, word: true, card: lookup(lex, part) });
      else out.push({ text: part });
    }
  };
  let last = 0;
  if (lex.phraseRe) {
    lex.phraseRe.lastIndex = 0;
    let m;
    while ((m = lex.phraseRe.exec(text))) {
      pushPlain(text.slice(last, m.index));
      out.push({ text: m[0], word: true, card: lex.phrases.get(m[1].toLowerCase().replace(/\s+/g, ' ')) });
      last = m.index + m[0].length;
    }
  }
  pushPlain(text.slice(last));
  return out;
}

// 熟悉度：還沒複習過或常忘的是「還不熟」，記得三次以上是「熟了」
export const familiarity = (card) => ((card.box || 0) >= 3 ? 'known' : 'learning');
