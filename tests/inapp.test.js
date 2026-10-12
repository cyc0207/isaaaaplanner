import { describe, it, expect } from 'vitest';
import { inAppBrowser, chromeIntent } from '../src/lib/inapp.js';

describe('inAppBrowser', () => {
  it('認得 App 內瀏覽器', () => {
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 350.0.0.0')).toBe('Threads');
    expect(inAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 Instagram 300.0')).toBe('Instagram');
    expect(inAppBrowser('Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/400.0]')).toBe('Facebook');
    expect(inAppBrowser('Mozilla/5.0 (iPhone) Mobile/15E148 Safari Line/14.0.0')).toBe('LINE');
  });
  it('一般 Safari、Chrome 不算', () => {
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe(null);
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36')).toBe(null);
  });
  it('Android 叫 Chrome 開', () => {
    expect(chromeIntent('https://isaaaaplanner.vercel.app/food?tab=near')).toBe('intent://isaaaaplanner.vercel.app/food?tab=near#Intent;scheme=https;package=com.android.chrome;end');
  });
});
