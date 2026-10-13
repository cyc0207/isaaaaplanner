import { describe, it, expect } from 'vitest';
import { scriptOf } from '../src/lib/version.js';

describe('新版本提示', () => {
  it('抓出打包後的主程式檔名', () => {
    expect(scriptOf('<head><script type="module" crossorigin src="/assets/index-5U9wXugw.js"></script></head>')).toBe('/assets/index-5U9wXugw.js');
    expect(scriptOf('<html></html>')).toBe(null);
  });
});
