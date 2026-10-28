/**
 * 익명 세션 부트스트랩.
 *
 * 앱 시작 시 한 번 돈다. 저장된 토큰이 있으면 그대로 쓰고, 없으면
 * POST /api/v1/auth/anonymous로 발급받아 로컬 DB에 남긴다.
 *
 * 여기에 `hydrateSessionCache`(발급 없이 sqlite만 캐시로 올리는 경로)도 함께 있다 —
 * 백그라운드 태스크처럼 부트스트랩이 돌지 않는 진입점을 위한 것이다. 아래 주석 참고.
 */
import * as Sentry from '@sentry/react-native';
import type { StoredSession } from '@/db/models/Session';
import { clearSession, readSession, saveToken } from '@/db/session';
import { issueAnonymousUserApiV1AuthAnonymousPost } from '@/services/api/auth/auth';
import { resolveAuthorizationHeader } from './authHeader';
import { restoreJudgeMode } from './judgeModePersistence';
import { authorizationHeaderOf, getCachedSession, setCachedSession } from './sessionCache';

export type BootstrapStatus = 'ready' | 'offline' | 'server-error';

export interface BootstrapResult {
  status: BootstrapStatus;
  /** PATCH /users/me 응답을 이미 받아둔 기기인가 = 온보딩을 건너뛸 수 있는가 */
  hasOnboardingResult: boolean;
}

/**
 * 응답이 왔다면 서버까지는 닿은 것이다. 인터넷이 끊긴 상황과 문구가 달라야 해서
 * response 유무로 나눈다.
 */
function classifyFailure(error: unknown): BootstrapStatus {
  const response = (error as { response?: unknown } | null)?.response;
  return response ? 'server-error' : 'offline';
}

/**
 * 토큰을 로컬에 남긴다. **실패해도 던지지 않는다.**
 *
 * 저장은 "다음 실행에서도 같은 사용자로 남기 위한" 편의이고, 발급받은 토큰은 이미 손에 있다.
 * 그런데 sqlite 실패가 그대로 올라가면 세 경로가 전부 토큰을 버렸다.
 *
 * - bootstrap 재사용 경로: 멀쩡한 저장 토큰과 **온보딩 결과까지** 버리고 새 사용자로 시작한다
 * - bootstrap 발급 경로: `classifyFailure`가 `response` 유무로만 보므로 `offline`이 되어,
 *   인터넷이 정상인데도 네트워크 오류 화면에 갇힌다
 * - `reissueSession`: null을 돌려줘 web이 5초 타임아웃 뒤 빈 화면에 머문다
 */
async function saveTokenBestEffort(accessToken: string, tokenType: string, apiOrigin: string): Promise<void> {
  try {
    await saveToken(accessToken, tokenType, apiOrigin);
  } catch (error) {
    // 이번 실행은 메모리 캐시만으로 정상 동작하고 다음 실행에서 새로 받는다.
    // 다만 조용히 넘기면 "매 실행 새 사용자가 되는" 상태를 알 방법이 없어 기록은 남긴다.
    Sentry.captureException(error, { level: 'warning', tags: { area: 'session-persist' } });
  }
}

/**
 * 저장된 세션이 어느 서버 것인지 비교할 때 쓰는 정규화된 주소.
 *
 * 끝 슬래시나 경로 유무로 같은 서버가 달라 보이면 멀쩡한 토큰을 버리게 되므로 origin만 남긴다.
 */
export function apiOriginOf(rawUrl: string | undefined): string {
  if (!rawUrl) return '';

  try {
    return new URL(rawUrl).origin;
  } catch {
    // URL로 파싱되지 않으면 원문끼리 비교한다 — 적어도 같은 설정끼리는 일치한다
    return rawUrl;
  }
}

/**
 * 익명 토큰을 새로 발급받아 저장·캐시한다. 성공하면 새 세션, 실패하면 null.
 *
 * WebView가 401을 만났을 때 쓴다(AUTH_TOKEN_REQUEST). 앱의 401 인터셉터는 세션을 버리기만 해서
 * **다음 앱 실행**에야 새 토큰이 생기고, 그 사이 WebView는 죽은 토큰으로 계속 빈 화면을 띄운다.
 *
 * 저장된 토큰을 재사용하지 않는다 — 방금 서버에서 거절당한 값이라 다시 심어도 401이 반복된다.
 * 온보딩 결과(`user`)도 딸려오지 않는다(서버가 그 사용자를 더 이상 모른다).
 */
export async function reissueSession(): Promise<StoredSession | null> {
  const currentOrigin = apiOriginOf(process.env.EXPO_PUBLIC_API_URL);

  try {
    const issued = await issueAnonymousUserApiV1AuthAnonymousPost();
    const session: StoredSession = {
      accessToken: issued.accessToken,
      tokenType: issued.tokenType,
      user: null,
      apiOrigin: currentOrigin,
    };

    await saveTokenBestEffort(issued.accessToken, issued.tokenType, currentOrigin);
    setCachedSession(session);
    return session;
  } catch {
    // 발급 실패는 여기서 할 수 있는 일이 없다. web은 응답이 오지 않으면 타임아웃으로 포기한다.
    return null;
  }
}

/**
 * sqlite에서 읽은 세션을 메모리 캐시에 올려도 되는가 — 올린다면 어떤 모양으로.
 *
 * `bootstrapSession`의 재사용 판정에서 **쓰기와 발급을 뺀** 순수 부분이다. 판정이 두 벌이
 * 되지 않도록 규칙을 여기 한 곳에만 두고 테스트로 못박는다.
 *
 * - 저장된 행이 없으면 올릴 것이 없다.
 * - 발급한 서버가 지금 서버와 다르면 **올리지 않는다.** 그 토큰은 이 서버에서 401이고,
 *   붙여 봐야 실패할 요청을 한 번 더 내는 것뿐이다.
 * - `apiOrigin`이 null인 행은 이 필드가 생기기 전에 저장된 것이다. `bootstrapSession`과 같이
 *   지금 서버 것으로 본다. 다만 **도장을 찍어 주지는 않는다**(saveToken을 부르지 않는다) —
 *   그건 포그라운드 부트스트랩의 몫이고, 백그라운드는 읽기만 하는 편이 안전하다.
 */
export function hydratableSession(stored: StoredSession | null, currentOrigin: string): StoredSession | null {
  if (!stored) return null;
  if (stored.apiOrigin !== null && stored.apiOrigin !== currentOrigin) return null;

  return { ...stored, apiOrigin: currentOrigin };
}

/**
 * 저장된 세션을 메모리 캐시에 올린다. **토큰을 새로 발급하지 않는다.**
 *
 * 백그라운드 태스크(gpsBackgroundTask.ts, backgroundTask.ts)의 입구다.
 * OS가 앱을 **헤드리스로** 깨우면 React 트리가 하나도 뜨지 않아 `useAppBootstrap`이 돌지
 * 않고, 그러면 `bootstrapSession`도 불리지 않는다. 캐시를 채우는 곳은 auth.ts의 세 지점
 * (`reissueSession`, `bootstrapSession`의 재사용·발급 경로)뿐이라, 그 회차의 요청은
 * **sqlite에 멀쩡한 토큰이 있는데도** Authorization 없이 나가 401로 조용히 버려졌다.
 *
 * **발급까지 하지 않는 것이 요점이다.** 여기서 `issueAnonymous`를 부르면 사용자가 앱을 켠 적도
 * 없는 회차가 새 익명 사용자를 만들어 낸다 — 그 사용자가 캐시에 올라간 채 다음 포그라운드
 * 실행이 sqlite의 원래 토큰을 읽으면 진행도가 갈라진다. 발급의 주인은 포그라운드 하나뿐이다.
 *
 * @returns 캐시에 세션이 올라와 있는가. false면 이번 회차에 보낼 토큰이 없다는 뜻이다.
 */
export async function hydrateSessionCache(): Promise<boolean> {
  // 이미 차 있으면 sqlite를 읽지 않는다. 프로세스가 살아 있는 채로 태스크만 깨는 경우가
  // 흔하고(포그라운드 → 백그라운드 전환), 그때는 부트스트랩이 이미 채워 뒀다.
  if (getCachedSession()) return true;

  // 헤드리스 회차도 포그라운드와 **같은 계정**으로 보내야 한다. 모드가 메모리 전용이던 시절에는
  // 여기서 할 수 있는 일이 없었지만(아래 hasUsableAuthorization 주석 참고), 이제 sqlite에 남아
  // 있으므로 되살린다 — 모드가 켜진 채 백그라운드 전송만 앱 토큰으로 나가면 홈이 보여 준 진행도와
  // 서버에 쌓이는 기록의 주인이 갈린다.
  await restoreJudgeMode();

  try {
    const session = hydratableSession(await readSession(), apiOriginOf(process.env.EXPO_PUBLIC_API_URL));
    if (!session) return false;

    setCachedSession(session);
    return true;
  } catch {
    // sqlite를 못 읽는 것은 이 회차에 보낼 게 없다는 뜻일 뿐이다. **던지면 안 된다** —
    // 백그라운드 태스크가 Failed로 끝나면 OS가 이 태스크를 점점 덜 깨운다.
    return false;
  }
}

/**
 * 지금 요청을 내면 Authorization이 붙는가 = 보낼 가치가 있는가.
 *
 * 판정을 client.ts의 요청 인터셉터와 **같은 함수**(`resolveAuthorizationHeader`)로 하는 것이
 * 핵심이다. 여기서 규칙을 다시 쓰면 언젠가 둘이 갈라져, 보낼 수 있는데 건너뛰거나
 * 못 보내는데 보내는 회차가 생긴다.
 *
 * 심사위원용 모드가 켜져 있으면 앱 토큰이 없어도 붙일 헤더가 있다(심사위원 토큰).
 * 예전에는 그 모드가 메모리 전용이라 헤드리스 기동에서 언제나 false였고, 그래서 이 함수는
 * 헤드리스에서 `hydrateSessionCache`의 결과와 같았다. 지금은 모드가 sqlite에 남고
 * `hydrateSessionCache`가 그것까지 되살리므로(services/judgeModePersistence.ts), 앱 토큰이
 * 없어도 모드가 켜져 있으면 보낼 수 있다 — 두 값이 갈릴 수 있으니 인자를 그대로 받는다.
 */
export function hasUsableAuthorization(judgeModeEnabled: boolean): boolean {
  return resolveAuthorizationHeader(judgeModeEnabled, authorizationHeaderOf(getCachedSession())) !== null;
}

export async function bootstrapSession(): Promise<BootstrapResult> {
  const currentOrigin = apiOriginOf(process.env.EXPO_PUBLIC_API_URL);

  // 심사위원용 모드를 **토큰보다 먼저** 되살린다. 이 값이 아래 발급·재사용 경로에서 나가는
  // 요청의 주인을 정하고(services/authHeader.ts), WebView에 심을 값도 여기서 정해진다
  // (components/HomeWebView/webViewBootstrapScript.ts). 순서가 뒤집히면 부트스트랩 회차만
  // 기본 모드로 나가 콜드 스타트에 한 번 어긋난다.
  await restoreJudgeMode();

  try {
    const stored = await readSession();
    if (stored) {
      // 토큰은 발급한 서버에서만 유효하다. 주소가 바뀌었으면 그 서버의 사용자였던
      // 온보딩 결과까지 함께 버리고 처음부터 다시 시작한다.
      if (stored.apiOrigin !== null && stored.apiOrigin !== currentOrigin) {
        await clearSession();
      } else {
        // apiOrigin이 없는 세션은 이 필드가 생기기 전에 저장된 것이다.
        // 지금 서버 것으로 보고 도장을 찍어둬야 다음에 주소가 바뀔 때 감지된다.
        if (stored.apiOrigin === null) {
          await saveTokenBestEffort(stored.accessToken, stored.tokenType, currentOrigin);
        }
        setCachedSession({ ...stored, apiOrigin: currentOrigin });
        return { status: 'ready', hasOnboardingResult: stored.user !== null };
      }
    }
  } catch {
    // 로컬 DB를 못 읽는 건 발급을 막을 이유가 아니다. 새로 받아서 진행한다.
  }

  try {
    const issued = await issueAnonymousUserApiV1AuthAnonymousPost();
    await saveTokenBestEffort(issued.accessToken, issued.tokenType, currentOrigin);
    setCachedSession({
      accessToken: issued.accessToken,
      tokenType: issued.tokenType,
      user: null,
      apiOrigin: currentOrigin,
    });
    return { status: 'ready', hasOnboardingResult: false };
  } catch (error) {
    return { status: classifyFailure(error), hasOnboardingResult: false };
  }
}
