import { getCachedSession } from '@/services/sessionCache';
import { isJudgeModeStored } from '@/services/judgeModePersistence';
import { isJudgeModeEnabled } from '@/store/judgeMode';
import { buildAuthTokenScript } from './authTokenScript';
import { buildJudgeModeScript } from './judgeModeScript';
import { currentWebViewAppInfo } from './webViewAppInfo';

/**
 * 모든 WebView가 문서 실행 전에 심는 부트스트랩 스크립트(토큰 + 앱 정보 + 심사위원용 모드).
 *
 * 화면마다 `getCachedSession()`을 읽고 `buildAuthTokenScript`를 부르는 코드가 다섯 벌
 * 흩어져 있었고, 보물지도 두 곳은 아예 빠져 있었다 — 그래서 그 화면들만 토큰 없이 401을
 * 맞았다(docs/trouble/2026-09-09-webview-token-version-skew.md §D). 조립을 한 곳으로 모아
 * 새 WebView가 생겨도 같은 방식으로 빠질 수 없게 한다.
 *
 * 부트스트랩이 스플래시 구간에서 끝난 뒤에야 화면이 렌더되므로(app/app/_layout.tsx의
 * appReady 게이트) 세션 캐시를 동기로 읽어도 안전하다.
 */
export function buildWebViewBootstrapScript(): string {
  const session = getCachedSession();
  const authScript = buildAuthTokenScript(session ? { accessToken: session.accessToken, tokenType: session.tokenType } : null, currentWebViewAppInfo());

  // 심사위원용 모드도 같은 자리에서 심는다. 부트스트랩이 sqlite에서 되살려 둔 값이라
  // (services/judgeModePersistence.ts) 여기서도 동기로 읽을 수 있다 — 세션 캐시를 동기로
  // 읽어도 안전한 것과 같은 근거(appReady 게이트)다.
  //
  // 저장값을 본 적이 없으면 null을 넘겨 **아무것도 심지 않는다.** 업데이트 직후 첫 실행이 그렇고,
  // 그때 false를 심으면 web이 켜 두었던 모드를 덮어쓴다(judgeModeScript.ts).
  return `${authScript}
${buildJudgeModeScript(isJudgeModeStored() ? isJudgeModeEnabled() : null)}`;
}
