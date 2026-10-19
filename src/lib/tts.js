// 聽力題的朗讀：用瀏覽器內建的英文語音，一句一句念，不同說話者用不同聲音。
// 這是真的會出聲音的音訊，但不是錄好的音檔；沒有英文語音的裝置就不派聽力題，不用文字假裝。

import { canSpeak } from './speech.js';

const FEMALE = /samantha|karen|moira|tessa|serena|victoria|allison|ava|susan|zira|aria|jenny|libby|sonia|natasha|female|google us english|google uk english female/i;
const MALE = /daniel|alex|fred|tom|aaron|arthur|oliver|rishi|gordon|lee|david|guy|ryan|william|male/i;

let cache = null;

// iPhone 的語音清單要等一下才會出來
export function loadVoices(timeout = 1500) {
  if (!canSpeak()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', done);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', done);
    setTimeout(done, timeout);
  });
}

export const englishVoices = (voices) => (voices || []).filter((v) => /^en[-_]/i.test(v.lang || ''));

// 依說話者分配聲音：女聲 W、男聲 M、第二位女聲 W2、第二位男聲 M2、獨白 narrator
export function castVoices(voices) {
  const en = englishVoices(voices);
  const fem = en.filter((v) => FEMALE.test(v.name) && !/male/i.test(v.name.replace(/female/i, '')));
  const mal = en.filter((v) => MALE.test(v.name) && !FEMALE.test(v.name));
  const us = (list) => list.find((v) => /en[-_]US/i.test(v.lang)) || list[0];
  const other = (list, not) => list.find((v) => v !== not && !/en[-_]US/i.test(v.lang)) || list.find((v) => v !== not);
  const W = us(fem) || us(en) || null;
  const M = other(mal) || us(mal) || null;
  const W2 = other(fem, W) || null;
  const M2 = mal.find((v) => v !== M) || null;
  return { W, M, W2, M2, narrator: other(en, W) || W, any: en[0] || null };
}

// 只有一個聲音的手機：用音高區分男女
const PITCH = { W: 1.1, W2: 1.25, M: 0.8, M2: 0.9, narrator: 1 };
const OPPOSITE = { W: 'M', W2: 'M', M: 'W', M2: 'W' };

export async function voiceSupport() {
  if (!canSpeak()) return { ok: false, reason: '這個瀏覽器不能朗讀，所以今天的聽力題沒辦法播放。' };
  const voices = await loadVoices();
  const en = englishVoices(voices);
  if (!en.length) return { ok: false, reason: '這台裝置沒有英文語音，所以聽力題沒辦法播放。可以換另一台手機或電腦再做。' };
  cache = castVoices(voices);
  return { ok: true, count: en.length };
}

// Chrome 一段念太久會自己停，所以拆成一句一句
export function splitSentences(text) {
  return (String(text || '').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);
}

let token = 0;

export function stopAudio() {
  token += 1;
  if (canSpeak()) window.speechSynthesis.cancel();
}

// lines：[{ sp, text, pause? }]；回傳 Promise，播完（或被停掉）才結束
export async function playLines(lines, { rate = 0.95, onLine } = {}) {
  if (!canSpeak()) return false;
  if (!cache) cache = castVoices(await loadVoices());
  stopAudio();
  const my = token;
  for (let i = 0; i < lines.length; i++) {
    const { sp = 'narrator', text, pause = 350 } = lines[i];
    onLine?.(i);
    for (const part of splitSentences(text)) {
      if (my !== token) return false;
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(part);
        const v = cache[sp] || cache.any;
        if (v) u.voice = v;
        u.lang = v?.lang || 'en-US';
        u.rate = rate;
        // 男女分不出不同聲音時，用音高分人
        const opp = cache[OPPOSITE[sp]];
        if (!cache[sp] || (opp && (cache[sp] || cache.any) === opp)) u.pitch = PITCH[sp] || 1;
        u.onend = resolve;
        u.onerror = resolve;
        window.speechSynthesis.speak(u);
      });
    }
    if (my !== token) return false;
    await new Promise((r) => setTimeout(r, pause));
  }
  onLine?.(-1);
  return my === token;
}

// Part 2：問題（一個人）→ (A)(B)(C) 回應（另一個人）
export function part2Lines(item) {
  const asker = item.id.charCodeAt(item.id.length - 1) % 2 ? 'W' : 'M';
  const answerer = asker === 'W' ? 'M' : 'W';
  return [
    { sp: asker, text: item.q, pause: 700 },
    ...item.options.map((o, i) => ({ sp: answerer, text: `${'ABC'[i]}. ${o}`, pause: 500 })),
  ];
}
