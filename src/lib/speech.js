// 瀏覽器內建的語音辨識和朗讀（免費，不經過我們的伺服器）。
// 只拿得到「轉好的文字」，拿不到可以評發音的錄音，所以發音一律是「尚未評估」。

const Recognition = () => typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const canListen = () => !!Recognition();
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// 點一下開始、再點一下結束。Chrome 停頓太久會自己停，這裡自動接著聽，直到按結束。
// iPhone（尤其加到主畫面的 App）常常一開就馬上結束，或按了 stop 卻不回 onend：
// 所以重開要隔一下、連續秒結束就放棄，按結束後等不到 onend 也強制收尾，避免卡在「說完了」。
export function startListening({ lang = 'en-US', onText, onEnd, onError }) {
  const Rec = Recognition();
  const rec = new Rec();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  let finals = '';
  let stopped = false;
  let ended = false;
  let quickEnds = 0;
  let runStart = Date.now();
  let timer = null;
  const started = Date.now();

  const finish = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    onEnd?.({ text: finals.trim(), sec: Math.round((Date.now() - started) / 1000), auto: !stopped });
  };
  const begin = () => {
    runStart = Date.now();
    rec.start();
  };

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
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    onError?.(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? '瀏覽器沒有麥克風權限，請在網址列旁邊允許麥克風，或改用打字。' : `語音辨識出錯（${e.error}），可以改用打字。`);
  };
  rec.onend = () => {
    if (ended) return;
    quickEnds = Date.now() - runStart < 1500 ? quickEnds + 1 : 0;
    if (!stopped && quickEnds < 3) {
      timer = setTimeout(() => {
        if (stopped) return finish();
        try {
          begin();
        } catch {
          finish();
        }
      }, 250);
      return;
    }
    finish();
  };
  try {
    begin();
  } catch (e) {
    ended = true;
    onError?.('沒辦法開始語音辨識，可以改用打字。');
  }
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      try {
        rec.stop();
      } catch {
        // 已經停了
      }
      // iOS 有時候 stop 之後不回 onend，等一下還沒結束就直接收尾
      setTimeout(() => {
        if (ended) return;
        try {
          rec.abort();
        } catch {
          // 忽略
        }
        finish();
      }, 1200);
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
