const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { shouldLimitWatchScope } = require('./scripts/metroWatchScope');

const config = getDefaultConfig(__dirname);

/**
 * 범위를 줄이더라도 **반드시 감시해야 하는** 워크스페이스 패키지.
 *
 * 앱이 소스를 함께 빌드하는 것은 이것 하나뿐이고, node_modules를 포함해도 16개 디렉터리(실측)라
 * 감시 비용이 사실상 0이다 — 아래 240초 사고를 만든 루트 node_modules(2,826개)와는 규모가 다르다.
 */
const SHARED_PACKAGE_ROOT = path.resolve(__dirname, '../packages/shared');

// Watchman 없는 Windows에서 루트 node_modules(16.6k 디렉터리)를 감시하려다
// Metro의 240초 제한을 넘겨 "Failed to start watch mode"로 죽는 것을 막는다.
// 판단 근거와 트레이드오프는 scripts/metroWatchScope.js 주석 참고
//
// @packages/shared **만** 남긴다.
//
// 예전에는 통째로 비우고 "패키지 소스를 고치면 수동 리로드(`r`)"로 정리했는데, `r`로는 반영되지
// 않는다 — 감시하지 않는 파일은 Metro의 file map이 변경을 모르므로 캐시된 옛 모듈이 그대로
// 나가고, `--clear` 재시작만이 바꾼다. 브릿지 계약이 조용히 옛 버전으로 도는 사고가 두 번 났다
// (docs/trouble/2026-09-07-bridge-contract-drift.md).
//
// 심링크와 이 watchFolder가 같은 디렉터리를 가리켜 중복 이벤트가 날 수 있지만, 최악이
// "한 번 더 리빌드"다. 조용한 staleness 쪽이 훨씬 나쁘다.
if (shouldLimitWatchScope({ platform: process.platform, env: process.env })) {
  config.watchFolders = [SHARED_PACKAGE_ROOT];
}

module.exports = withNativeWind(config, { input: './global.css' });
