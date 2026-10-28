import { resolveWebViewUrl } from './webUrl';

/**
 * 협동 미션 초대 링크를 조립한다.
 *
 * 서버는 `teamToken`만 주고 완성된 URL은 주지 않는다. 그래서 앱이 배포 web 도메인과 토큰을
 * 이어 붙여 `Share.share`로 내보낸다.
 *
 * 도메인 해석은 `resolveWebViewUrl`을 그대로 재사용한다 — WebView가 여는 주소와 공유되는
 * 주소가 갈라지면, 개발 중에는 멀쩡히 열리던 링크가 배포본에서만 다른 곳을 가리키게 된다.
 */

/**
 * 초대 링크가 여는 경로. **이 저장소에서 이 문자열의 단일 출처다.**
 *
 * 같은 경로가 네 곳에서 쓰인다. 하나만 바뀌면 나머지는 조용히 어긋나고, 증상은
 * "앱은 열리는데 초대 화면이 안 나온다"라서 알아채기 어렵다.
 *
 * 1. 공유되는 https 링크 — `buildInviteUrl`이 이 상수로 조립한다.
 * 2. web 랜딩 라우트 — `web/src/app/cooperative-missions/invite/page.tsx`.
 * 3. Android App Link 필터 — `app.json`의 `intentFilters[].data.pathPrefix`.
 * 4. App Link가 착지하는 앱 라우트 — `app/cooperative-missions/invite.tsx`.
 *
 * 4번이 https 경로와 **글자 그대로 같아야** 하는 이유는 App Link가 주소를 바꿔 주지 않기
 * 때문이다. expo-router는 https URL에서 origin만 떼고 남은 경로로 라우트를 찾는다
 * (`expo-router/build/fork/extractPathFromURL.js`의 `extractExactPathFromURL`).
 *
 * 네 자리의 일치는 `appLinks.test.ts`가 실제 파일을 읽어 고정한다.
 */
export const COOP_INVITE_PATH = '/cooperative-missions/invite';

/**
 * App Link로 잡는 호스트. production `EXPO_PUBLIC_WEB_URL`의 host와 **같아야 한다**.
 *
 * 값의 출처: `.github/workflows/deploy-web.yml`의 `WEBAPP_NAME: jankkan-jeju-web`(Azure App
 * Service 이름이 곧 `*.azurewebsites.net` 호스트다), 루트 `README.md`의 접속 URL,
 * `app/README.md`의 EAS production 환경변수 표.
 *
 * 이 값은 **네이티브 매니페스트에 박힌다** — `.env`로 바꿀 수 없고, 도메인을 옮기면
 * 앱을 다시 빌드해 스토어에 올려야 한다. 그래서 코드에 상수로 두고 테스트로 고정한다.
 *
 * 호스트가 바뀌면 함께 옮겨야 하는 것: `app.json`의 intentFilters, 새 도메인의
 * `/.well-known/assetlinks.json`, EAS production의 `EXPO_PUBLIC_WEB_URL`.
 */
export const COOP_INVITE_APP_LINK_HOST = 'jankkan-jeju-web.azurewebsites.net';

/**
 * `{base}/cooperative-missions/invite?token={토큰}`.
 *
 * 토큰은 `encodeURIComponent`로 감싼다. 지금 서버 토큰은 URL에 안전한 문자만 쓰지만,
 * 규칙이 바뀌어 base64처럼 `+`·`/`가 섞이면 그대로 붙인 링크는 조용히 다른 토큰으로 읽힌다.
 *
 * 빈 토큰은 던진다. 그런 링크는 열려도 방을 찾지 못하는데, 공유는 이미 끝난 뒤라
 * 방장은 왜 아무도 안 들어오는지 알 수 없다.
 * 도메인 해석 실패는 `resolveWebViewUrl`의 에러를 그대로 통과시킨다(어느 .env 변수가 비었는지 알려준다).
 */
export function buildInviteUrl(teamToken: string, explicitWebUrl: string | undefined, isDev: boolean, devFallbackUrl?: string): string {
  const token = teamToken?.trim();

  if (!token) {
    throw new Error('초대 링크를 만들 teamToken이 없습니다.');
  }

  const base = resolveWebViewUrl(explicitWebUrl, isDev, COOP_INVITE_PATH, devFallbackUrl);

  return `${base}?token=${encodeURIComponent(token)}`;
}

/**
 * 앱 스킴. `app.json`의 `expo.scheme`과 **같은 값이어야 한다** — 이 상수만 바꾸면 링크가
 * 아무 앱도 열지 못한다(스킴은 네이티브 빌드에 박히므로 코드에서 고칠 수 없다).
 */
export const APP_SCHEME = 'tamnalog';

/**
 * 커스텀 스킴이 여는 앱 라우트. `app/mission/invite.tsx`의 파일 경로와 같아야 한다.
 *
 * App Link(https)가 착지하는 라우트는 이쪽이 아니라 `COOP_INVITE_PATH`다 —
 * 두 진입은 경로가 다르고, 두 라우트 파일이 같은 컴포넌트(`CoopInviteEntry`)를 부른다.
 * 이 경로를 App Link 경로에 맞춰 통일하지 않는 이유는 **이미 배포된 web이 이 스킴 주소를
 * 만들어 쓰고 있기 때문**이다. web은 원격 배포라 앱보다 항상 먼저 갱신되는데, 앱 쪽 라우트를
 * 지워 버리면 아직 옛 앱을 쓰는 사용자의 폴백 경로가 끊긴다.
 */
export const COOP_INVITE_APP_PATH = '/mission/invite';

/**
 * `tamnalog:///mission/invite?token={토큰}`.
 *
 * web 랜딩 페이지(`/cooperative-missions/invite`)가 이 주소로 넘겨 앱을 연다. 공유되는 링크가
 * https인 이유는 앱이 없는 사람도 무언가는 봐야 하기 때문이고, 앱이 있는 사람을 앱으로 넘기는
 * 마지막 한 칸이 이 스킴이다.
 *
 * **슬래시가 세 개인 것이 중요하다.** `tamnalog://mission/invite`는 `mission`이 호스트로
 * 읽혀 경로가 `/invite`만 남는 파서가 있다(expo-linking의 `parse`가 그렇다). 호스트를 비워 두면
 * 어느 파서에서든 경로가 `mission/invite` 그대로다.
 *
 * 토큰 인코딩·빈 토큰 규칙은 `buildInviteUrl`과 같다 — 두 링크가 같은 토큰을 가리켜야 한다.
 */
export function buildInviteAppLink(teamToken: string): string {
  const token = teamToken?.trim();

  if (!token) {
    throw new Error('초대 링크를 만들 teamToken이 없습니다.');
  }

  return `${APP_SCHEME}://${COOP_INVITE_APP_PATH}?token=${encodeURIComponent(token)}`;
}
