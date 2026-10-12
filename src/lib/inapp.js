// Threads、IG、FB、LINE 這些 App 裡的瀏覽器，Google 不讓登入（會出現 missing initial state 或 disallowed_useragent）
const APPS = [
  [/Barcelona/i, 'Threads'],
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'Facebook'],
  [/Messenger/i, 'Messenger'],
  [/\bLine\//i, 'LINE'],
  [/MicroMessenger/i, '微信'],
  [/KAKAOTALK/i, 'KakaoTalk'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/Twitter/i, 'X'],
];

export function inAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  for (const [re, name] of APPS) if (re.test(ua)) return name;
  return null;
}

export const isAndroid = (ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') => /Android/i.test(ua);

// Android 可以直接叫 Chrome 打開；iPhone 只能請使用者自己按「用瀏覽器開啟」
export function chromeIntent(url) {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
}
