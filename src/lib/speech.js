// 瀏覽器內建的語音辨識和朗讀（免費，不經過我們的伺服器）。
// 只拿得到「轉好的文字」，拿不到可以評發音的錄音，所以發音一律是「尚未評估」。

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const canListen = () => !!Recognition;
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// 點一下開始、再點一下結束。Chrome 停頓太久會自己停，這裡自動接著聽，直到按結束
export function startListening({ lang = 'en-US', onText, onEnd, onError }) {
  const rec = new Recognition();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  let finals = '';
  let stopped = false;
  const started = Date.now();

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finals += `${r[0].transcript.trim()} `;
      else interim += r[0].transcript;
    }
    onText?.((finals + interim).replace(/\s+/g, ' ').trim());
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    stopped = true;
    onError?.(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? '瀏覽器沒有麥克風權限，請在網址列旁邊允許麥克風，或改用打字。' : `語音辨識出錯（${e.error}），可以改用打字。`);
  };
  rec.onend = () => {
    if (!stopped) {
      try {
        rec.start();
        return;
      } catch {
        // 重開失敗就當作結束
      }
    }
    onEnd?.({ text: finals.trim(), sec: Math.round((Date.now() - started) / 1000) });
  };
  try {
    rec.start();
  } catch (e) {
    onError?.('沒辦法開始語音辨識，可以改用打字。');
  }
  return {
    stop() {
      stopped = true;
      rec.stop();
    },
  };
}

let voice;
function pickVoice() {
  if (voice !== undefined) return voice;
  const vs = window.speechSynthesis.getVoices();
  if (!vs.length) return null;
  voice = vs.find((v) => v.lang === 'en-US' && /samantha|google us|aria|jenny/i.test(v.name)) || vs.find((v) => v.lang === 'en-US') || vs.find((v) => v.lang?.startsWith('en')) || null;
  return voice;
}

export function speak(text, rate = 0.95) {
  if (!canSpeak() || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const v = pickVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
