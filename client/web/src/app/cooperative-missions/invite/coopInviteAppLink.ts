/**
 * 초대 링크가 앱을 여는 마지막 한 칸.
 *
 * 방장이 공유하는 링크는 `https://{web}/cooperative-missions/invite?token=…`이다(앱의
 * `src/config/inviteUrl.ts`가 조립한다). 링크를 https로 두는 이유는 **앱이 없는 사람도 무언가는
 * 봐야 하기 때문**이다 — 커스텀 스킴을 그대로 공유하면 앱이 없는 기기에서는 아무 일도 일어나지
 * 않고, 메신저에 따라 링크로 인식조차 되지 않는다.
 *
 * 그래서 이 페이지가 중간에 서서 토큰을 앱 스킴으로 넘긴다.
 *
 * ## 이 페이지는 이제 "폴백"이다
 *
 * 앱이 깔려 있고 Android App Link 검증이 끝난 기기에서는 이 페이지가 **아예 뜨지 않는다** —
 * 안드로이드가 https 링크를 브라우저 대신 앱으로 바로 넘긴다
 * (`app/app.json`의 `expo.android.intentFilters`, 그리고 이 사이트가 서빙하는
 * `/.well-known/assetlinks.json`이 그 짝이다).
 *
 * 그래도 이 페이지가 필요한 자리는 남는다.
 * - 앱이 없는 기기 → 원스토어로 보내야 한다.
 * - 검증이 아직 안 끝난 기기(설치 직후 몇 초, 네트워크 없음, 사용자가 "브라우저로 열기" 선택).
 * - App Link를 존중하지 않는 인앱 브라우저(카카오톡 등)와 데스크톱.
 * - iOS(이번 작업 범위 밖이라 예전 그대로 커스텀 스킴만 쓴다).
 */

/**
 * 이 랜딩 페이지 자신의 경로. 이 파일이 사는 디렉터리(`src/app/cooperative-missions/invite`)와
 * 같아야 하고, 앱의 `src/config/inviteUrl.ts`가 링크를 조립할 때 쓰는 `COOP_INVITE_PATH`,
 * `app/app.json`의 App Link `pathPrefix`와도 **글자 그대로 같아야 한다.**
 *
 * App Link는 https 주소를 바꾸지 않고 그대로 앱에 넘기므로, 이 경로가 곧 앱이 찾을 라우트
 * 경로이기도 하다. 일치는 앱 쪽 `src/config/appLinks.test.ts`가 실제 파일을 읽어 고정한다.
 */
export const COOP_INVITE_WEB_PATH = '/cooperative-missions/invite';

/**
 * 앱 스킴. `app/app.json`의 `expo.scheme`, 앱의 `src/config/inviteUrl.ts`와 **같은 값이어야 한다.**
 * 스킴은 네이티브 빌드에 박히므로 여기만 고치면 링크가 아무 앱도 열지 못한다.
 */
export const APP_SCHEME = 'tamnalog';

/** 앱에서 이 링크를 받는 라우트. `app/app/mission/invite.tsx`의 파일 경로와 같아야 한다 */
export const COOP_INVITE_APP_PATH = '/mission/invite';

/**
 * `tamnalog:///mission/invite?token={토큰}`.
 *
 * **슬래시가 세 개인 것이 중요하다.** `tamnalog://mission/invite`는 `mission`이 호스트로 읽혀
 * 경로가 `/invite`만 남는 파서가 있다(expo-linking의 `parse`). 호스트를 비워 두면 어느 파서에서도
 * 경로가 `mission/invite` 그대로다.
 *
 * 토큰이 없으면 null이다 — 열어도 방을 찾지 못하는 주소로 앱을 깨우지 않는다.
 * 인코딩 규칙은 앱의 `buildInviteAppLink`와 같아야 한다(같은 토큰을 가리켜야 한다).
 */
export function buildCoopInviteAppLink(teamToken: string | null | undefined): string | null {
  const token = teamToken?.trim();
  if (!token) return null;
  return `${APP_SCHEME}://${COOP_INVITE_APP_PATH}?token=${encodeURIComponent(token)}`;
}
