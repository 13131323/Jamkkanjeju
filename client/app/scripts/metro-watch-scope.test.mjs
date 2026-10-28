import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { shouldLimitWatchScope } = require('./metroWatchScope.js');

/** detectWatchman이 실제로 호출되는지까지 보기 위해 호출 횟수를 센다 */
function stubDetect(result) {
  const calls = { count: 0 };
  const detect = () => {
    calls.count += 1;
    return result;
  };
  return { detect, calls };
}

describe('shouldLimitWatchScope', () => {
  it('Watchman이 없는 Windows에서는 감시 범위를 줄인다', () => {
    const { detect } = stubDetect(false);

    expect(shouldLimitWatchScope({ platform: 'win32', env: {}, detectWatchman: detect })).toBe(true);
  });

  it('Watchman이 있는 Windows에서는 기본 watchFolders를 유지한다', () => {
    const { detect } = stubDetect(true);

    expect(shouldLimitWatchScope({ platform: 'win32', env: {}, detectWatchman: detect })).toBe(false);
  });

  it('macOS는 NativeWatcher가 처리하므로 건드리지 않는다', () => {
    const { detect, calls } = stubDetect(false);

    expect(shouldLimitWatchScope({ platform: 'darwin', env: {}, detectWatchman: detect })).toBe(false);
    // 불필요한 자식 프로세스 실행을 막기 위해 Windows가 아니면 탐지 자체를 하지 않는다
    expect(calls.count).toBe(0);
  });

  it('TAMNALOG_USB_DEVICE=1은 플랫폼과 무관하게 범위를 줄인다(기존 동작 유지)', () => {
    const { detect, calls } = stubDetect(true);

    expect(
      shouldLimitWatchScope({
        platform: 'darwin',
        env: { TAMNALOG_USB_DEVICE: '1' },
        detectWatchman: detect,
      }),
    ).toBe(true);
    expect(calls.count).toBe(0);
  });

  it('TAMNALOG_USB_DEVICE가 1이 아니면 플래그로 취급하지 않는다', () => {
    const { detect } = stubDetect(true);

    expect(
      shouldLimitWatchScope({
        platform: 'win32',
        env: { TAMNALOG_USB_DEVICE: '0' },
        detectWatchman: detect,
      }),
    ).toBe(false);
  });
});
