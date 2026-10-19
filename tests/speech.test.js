import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startListening } from '../src/lib/speech.js';

// 假的語音辨識：記錄 start 次數，可選擇一開就結束、stop 之後不回 onend（iPhone 的情況）
function install({ endAtOnce = false, silentStop = false } = {}) {
  const made = [];
  class FakeRec {
    constructor() {
      this.starts = 0;
      made.push(this);
    }
    start() {
      this.starts++;
      if (endAtOnce) setTimeout(() => this.onend?.(), 0);
    }
    stop() {
      if (!silentStop) setTimeout(() => this.onend?.(), 0);
    }
    abort() {}
  }
  globalThis.window = { webkitSpeechRecognition: FakeRec };
  return made;
}

describe('startListening', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it('一開就結束時不會無限重開，會收尾', () => {
    const made = install({ endAtOnce: true });
    const onEnd = vi.fn();
    startListening({ onEnd });
    vi.advanceTimersByTime(10000);
    expect(made[0].starts).toBeLessThanOrEqual(3);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0].auto).toBe(true);
  });

  it('按結束後 onend 沒回來，也會收尾', () => {
    install({ silentStop: true });
    const onEnd = vi.fn();
    const l = startListening({ onEnd });
    l.stop();
    vi.advanceTimersByTime(2000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0].auto).toBe(false);
  });

  it('正常按結束只收尾一次並帶回文字', () => {
    const made = install();
    const onEnd = vi.fn();
    const l = startListening({ onEnd });
    made[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'hello there' }], { isFinal: true })] });
    l.stop();
    vi.advanceTimersByTime(2000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0].text).toBe('hello there');
  });
});
