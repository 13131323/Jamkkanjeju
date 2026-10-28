import { judgeAuthorizationHeader } from '@packages/shared';

/**
 * 요청에 붙일 Authorization을 정하는 규칙과, 401을 받았을 때 세션을 버릴지 정하는 규칙.
 *
 * axios 인스턴스(client.ts)에서 떼어 낸 이유는 두 가지다. 하나는 이 판정에 실제 버그가 있었고
 * 테스트로 고정해야 한다는 것, 다른 하나는 client.ts가 생성 API·sqlite를 함께 끌고 와서
 * 순수 판정만 따로 부르기 어렵다는 것이다(gpsReport.ts를 gpsSender.ts에서 뗀 것과 같은 이유).
 */

/**
 * 이 요청에 붙일 Authorization 헤더. 붙이지 않아야 하면 null.
 *
 * **심사위원용 모드가 켜져 있으면 그 토큰이 앱 토큰보다 우선이다.** web이 이미 같은 규칙을
 * 쓰고 있고(web/src/shared/api/axios/instance.ts), 앱만 자기 익명 토큰으로 부르던 것이
 * 이 모드의 핵심 결함이었다 — 홈(web)은 심사위원 계정의 "진행중인 미션"을 보여 주는데
 * 그 카드를 눌러 들어간 앱 화면은 **다른 사용자**로 진행도를 열었다. 두 규칙이 같아야
 * 홈에서 본 미션을 앱이 그대로 이어받는다.
 *
 * 모드가 꺼지면 그대로 앱 토큰으로 돌아온다 — 여기가 유일한 갈림길이라 되돌릴 상태가 없다.
 *
 * 토큰이 없을 때 헤더를 붙이지 않는 것도 그대로다. `/api/v1/auth/anonymous`는 인증이 필요 없는
 * 엔드포인트라 토큰 없이 나가는 것이 정상 경로다.
 */
export function resolveAuthorizationHeader(judgeModeEnabled: boolean, sessionHeader: string | null): string | null {
  if (judgeModeEnabled) return judgeAuthorizationHeader();
  return sessionHeader;
}

/**
 * 401을 받았을 때 저장된 세션을 버려야 하는가.
 *
 * **거절당한 것이 앱 토큰일 때만 버린다.** 예전에는 401이면 무조건 버렸는데, 그 규칙은 앱 토큰과
 * 무관한 401까지 앱의 신원을 지우는 데 썼다. 실제로 두 경우가 있다.
 *
 * 1. **심사위원용 모드** — 나간 헤더는 심사위원 토큰이다. 이때의 401은 "서버에 그 목업 사용자가
 *    없다"는 뜻이지 앱 토큰이 죽었다는 뜻이 아니다. 여기서 앱 세션을 지우면 모드를 끄는 순간
 *    사용자가 새 익명 사용자가 되어 자기 진행도를 통째로 잃는다. web이 같은 이유로 이 모드에서
 *    토큰 재발급을 건너뛴다(instance.ts).
 * 2. **토큰 없이 나간 요청** — 세션 캐시가 아직 비어 있는 동안(부트스트랩이 끝나기 전) 먼저
 *    흐르는 요청이 있다. 그 401은 저장된 토큰에 대해 아무것도 말해 주지 않는데, 무조건 버리는
 *    규칙은 sqlite의 Session 행까지 지워(clearSession) 다음 실행에서 **완전히 새 사용자**로
 *    시작하게 만들었다.
 *
 *    헤드리스 백그라운드 실행이 원래 이 갈래의 대표 사례였다 — React 트리가 없어 부트스트랩이
 *    돌지 않으므로 캐시가 빈 채로 POST가 나갔다. 지금은 두 백그라운드 태스크가 전송 전에
 *    `hydrateSessionCache()`로 캐시를 채우고 붙일 헤더가 없으면 아예 보내지 않으므로(auth.ts,
 *    gpsBackgroundTask.ts, backgroundTask.ts) 그 경로는 여기까지 오지 않는다. 그래도 이 갈래를
 *    남겨 두는 이유는 포그라운드의 같은 구간이 그대로 있기 때문이다.
 *
 * 나간 헤더와 지금 세션의 헤더를 비교하는 형태인 것은 이 규칙 하나로 위 둘과, 응답을 기다리는
 * 사이 세션이 이미 교체된 경우(재발급 직후 도착한 옛 요청의 401)까지 함께 걸러지기 때문이다.
 */
export function shouldDiscardSessionOnUnauthorized(sentAuthHeader: string | null | undefined, sessionHeader: string | null): boolean {
  if (!sentAuthHeader || !sessionHeader) return false;
  return sentAuthHeader === sessionHeader;
}

/**
 * 요청 인터셉터가 "이번에 무슨 토큰으로 보냈는지" 적어 두는 자리.
 *
 * 응답 인터셉터는 같은 config 객체를 다시 받으므로(web의 `_authRetried`와 같은 수법)
 * 헤더를 되읽는 것보다 이쪽이 확실하다 — axios 1.x는 요청을 보내면서 `config.headers`를
 * AxiosHeaders로 감싸고 키를 소문자로 정규화해서, 우리가 넣은 이름 그대로 남는다는 보장이 없다.
 */
export interface AuthTaggedConfig {
  /** 붙이지 않았으면 null. 필드 자체가 없으면 이 인터셉터를 지나지 않은 요청이다 */
  sentAuthHeader?: string | null;
}

/**
 * 이 요청이 실제로 보낸 Authorization 값. 붙이지 않았거나 알 수 없으면 null.
 *
 * 표시가 없는 config(테스트에서 직접 만든 에러, 인터셉터를 지나지 않은 요청)를 위해 헤더도
 * 함께 본다. 어떤 모양이 와도 던지지 않아야 한다 — 에러를 해석하다가 에러가 나면 원래 에러가
 * 사라진다(utils/apiError.ts와 같은 원칙).
 */
export function readSentAuthorizationHeader(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;

  const config = (error as { config?: unknown }).config;
  if (typeof config !== 'object' || config === null) return null;

  const tagged = (config as AuthTaggedConfig).sentAuthHeader;
  if (tagged !== undefined) return tagged;

  const headers = (config as { headers?: unknown }).headers;
  if (typeof headers !== 'object' || headers === null) return null;

  // 대소문자는 보내는 쪽이 정한다. 우리는 'Authorization'으로 넣지만 axios가 정규화하면
  // 소문자가 될 수 있어 둘 다 본다.
  const record = headers as Record<string, unknown>;
  const value = record.Authorization ?? record.authorization;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
