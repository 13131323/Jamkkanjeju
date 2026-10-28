import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const metroConfigPath = require.resolve('../metro.config.js');

afterEach(() => {
  delete process.env.TAMNALOG_USB_DEVICE;
  delete require.cache[metroConfigPath];
});

describe('Metro physical-device configuration', () => {
  it('resolves hoisted dependencies while workspace crawling is disabled', () => {
    process.env.TAMNALOG_USB_DEVICE = '1';
    delete require.cache[metroConfigPath];

    const config = require(metroConfigPath);

    // 감시 범위를 줄여도 @packages/shared **는 남는다**. 해석만 놓고 보면
    // app/node_modules 심링크로 충분하지만, 감시하지 않으면 그 소스를 고쳐도
    // 리로드로는 반영되지 않는다 — Metro의 file map이 변경을 모르므로 캐시된 옛 모듈이 나간다.
    // 브릿지 계약이 조용히 옛 버전으로 도는 사고가 두 번 났다(metro.config.js 주석).
    expect(config.watchFolders).toEqual([path.resolve(import.meta.dirname, '..', '..', 'packages', 'shared')]);
    // 루트 node_modules(2,826개/2단계)는 여전히 감시하지 않는다 — 그게 240초 제한을 넘겼던 원인이다
    expect(config.watchFolders).not.toContain(path.resolve(import.meta.dirname, '..', '..', 'node_modules'));
    expect(config.resolver.nodeModulesPaths).toContain(path.resolve(import.meta.dirname, '..', '..', 'node_modules'));
  }, 60_000);
});
