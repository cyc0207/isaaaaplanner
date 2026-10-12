import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/firebase.js', () => ({ db: {} }));
const { errorKey, errorInfo, isNoise } = await import('../src/lib/errlog.js');

describe('錯誤紀錄', () => {
  it('同樣的錯誤對到同一筆，數字不同（時間戳、id）也算同一個', () => {
    expect(errorKey('存檔', 'fail at 1728712345678')).toBe(errorKey('存檔', 'fail at 1728799999999'));
    expect(errorKey('存檔', 'a')).not.toBe(errorKey('畫面', 'a'));
  });
  it('Firebase 錯誤會帶代碼', () => {
    expect(errorInfo({ code: 'permission-denied', message: 'Missing permissions' }).message).toBe('[permission-denied] Missing permissions');
    expect(errorInfo('字串').message).toBe('字串');
    expect(errorInfo(null).message).toBe('不明錯誤');
  });
  it('外掛和無害雜訊不記', () => {
    expect(isNoise('ResizeObserver loop limit exceeded')).toBe(true);
    expect(isNoise('Script error.')).toBe(true);
    expect(isNoise('x', 'at chrome-extension://abc/x.js')).toBe(true);
    expect(isNoise('Cannot read properties of undefined')).toBe(false);
  });
});
