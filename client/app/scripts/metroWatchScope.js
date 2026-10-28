const { spawnSync } = require('node:child_process');

/**
 * Metro watcher 범위 결정.
 *
 * ## 배경 (2026-08-15 재조사)
 *
 * `@expo/metro-file-map`은 watcher를 WatchmanWatcher > NativeWatcher > FallbackWatcher 순으로 고른다.
 * - NativeWatcher는 `fs.watch(root, { recursive: true })` 한 번으로 트리 전체를 감시해 매우 싸지만,
 *   `isSupported()`가 `platform() === 'darwin'`으로 막혀 있다. 이는 실수가 아니라 의도된 제한이다 —
 *   구현 위 주석이 "On Windows, this watcher could be used in principle, but needs work around some
 *   Windows-specific edge cases handled in FallbackWatcher, like deduping file change events,
 *   ignoring directory changes, and handling EPERM"이라고 명시한다.
 * - 따라서 Watchman이 없는 Windows에서는 FallbackWatcher가 쓰이고, 이건 디렉터리마다 개별
 *   `fs.watch`를 건다(`#watchdir`).
 *
 * 이 레포는 `.npmrc`의 `node-linker=hoisted` 때문에 루트 `node_modules`가 평탄한 대형 트리이고
 * (측정값 16,631개 디렉터리), Expo 모노레포 기본 설정이 이걸 `watchFolders`에 넣는다.
 * 16.6k개 watcher 등록이 `Watcher.js`의 `MAX_WAIT_TIME = 240000`ms를 넘겨
 * **"Failed to start watch mode"**로 죽는다.
 *
 * ## 해결
 *
 * `watchFolders`에서 루트 트리를 걷어내고 `packages/shared`만 남긴다(metro.config.js).
 * Metro의 `projectRoot`(= app)는 항상 감시 대상이라 앱 소스 hot reload는 유지되고,
 * 루트 패키지는 `resolver.nodeModulesPaths`에 남아 해석에 계속 쓰인다.
 * 잃는 것은 루트 `node_modules`(설치 때만 변한다)와 `web/`(자체 dev 서버가 hot reload를 담당한다)의
 * 변경 감시뿐이다.
 *
 * `packages/shared`를 예외로 남기는 이유는 metro.config.js 주석 참고 — 감시하지 않으면
 * 그 소스를 고쳐도 리로드로는 반영되지 않아 브릿지 계약이 조용히 옛 버전으로 돈다.
 *
 * ## 이전 결론과 달라진 점
 *
 * `docs/trouble/2026-08-08-metro-watcher-scope.md`는 같은 설정을 시도했다가 되돌렸다.
 * 당시 SDK 55에서는 watchFolders 밖 파일에 대한 on-demand filesystem 접근이 없어
 * `expo export`가 루트 `node_modules/expo-router/entry`를 찾지 못했기 때문이다.
 * 현재 SDK 56에서는 그 기능이 들어와 dev 번들과 `expo export` 모두 정상 동작하는 것을 확인했다.
 */

/** Watchman이 있으면 대형 트리도 정상 감시되므로 범위를 줄일 이유가 없다 */
function detectWatchman() {
  try {
    const result = spawnSync('watchman', ['--version'], { stdio: 'ignore', shell: true });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * @param {object} params
 * @param {string} params.platform - process.platform
 * @param {Record<string, string | undefined>} params.env
 * @param {() => boolean} [params.detectWatchman] - 필요할 때만 호출된다(자식 프로세스 비용)
 * @returns {boolean} watchFolders를 비워야 하면 true
 */
function shouldLimitWatchScope({ platform, env, detectWatchman: detect = detectWatchman }) {
  // USB 실기기 실행 경로가 쓰던 기존 플래그. 플랫폼과 무관하게 존중한다
  if (env.TAMNALOG_USB_DEVICE === '1') {
    return true;
  }

  // FallbackWatcher가 강제되는 건 Windows뿐이다. macOS는 NativeWatcher가 싸게 처리하고
  // Linux는 이 레포의 검증 대상이 아니므로 기본 동작을 바꾸지 않는다
  if (platform !== 'win32') {
    return false;
  }

  return !detect();
}

module.exports = { shouldLimitWatchScope, detectWatchman };
