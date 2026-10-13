import { useEffect, useState } from 'react';

// 網站更新後，手機上開著的舊頁面不會自己換新：回到這個頁面時偷看一下網站上的 index.html，
// 主程式檔名（每次部署都會變）跟現在這頁不同，就提示點一下更新
export const scriptOf = (html) => (String(html).match(/<script[^>]+type="module"[^>]+src="([^"]+)"/) || [])[1] || null;

const CHECK_MS = 10 * 60 * 1000;

export function useNewVersion() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const mine = scriptOf(document.documentElement.outerHTML);
    // 本機開發沒有打包過的檔名，不用檢查
    if (!mine || !mine.includes('/assets/')) return undefined;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 60 * 1000) return;
      last = Date.now();
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
        const live = scriptOf(await res.text());
        if (live && live !== mine) setFresh(true);
      } catch {
        // 沒網路就下次再看
      }
    };
    check();
    const t = setInterval(check, CHECK_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return fresh;
}
