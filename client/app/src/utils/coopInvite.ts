/**
 * 초대 딥링크(`tamnalog:///mission/invite?token=…`)로 들어온 진입을 어떻게 처리할지 정한다.
 *
 * 화면(`app/mission/invite.tsx`)이 아니라 여기에 두는 이유는 이 저장소 관례 그대로다 —
 * 판정은 순수 함수로 떼어 테스트로 고정한다(`coopStep.ts`·`coopFailure.ts`·`party.ts`).
 * 딥링크는 손으로 재현하기가 특히 번거로워(링크를 만들고 앱을 죽였다 열어야 한다)
 * 규칙이 코드로 고정돼 있지 않으면 회귀를 알아챌 방법이 없다.
 */

/**
 * 라우트 파라미터에서 팀 토큰을 읽는다.
 *
 * expo-router는 같은 키가 두 번 실리면 배열을 준다(`?token=a&token=b`). 딥링크는 우리가 만든
 * 링크만 오는 게 아니라 메신저가 한 번 가공한 주소일 수도 있어서, 배열이면 **첫 값만** 쓴다.
 * 공백만 있는 값은 없는 것과 같다 — 그대로 보내면 서버가 400으로 돌려줄 뿐이다.
 */
export function readInviteToken(raw: string | string[] | undefined): string | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const token = first?.trim();
  return token ? token : null;
}

/**
 * 초대 링크로 들어왔을 때 이 진입이 할 일.
 *
 * - `join`: 토큰으로 참여 요청을 보낸다.
 * - `onboarding`: 아직 온보딩을 마치지 않은 기기다. 참여자를 식별할 사용자 정보가 없어
 *   요청을 보내 봐야 실패한다 — 온보딩부터 시키고, 토큰은 버린다.
 * - `invalid`: 토큰이 없다. 링크가 잘려서 왔거나 스킴만 열린 경우다.
 */
export type CoopInviteEntry = { kind: 'join'; token: string } | { kind: 'onboarding' } | { kind: 'invalid' };

/**
 * 온보딩을 먼저 본다. 토큰이 있어도 사용자가 없으면 참여 요청이 통하지 않기 때문이다.
 *
 * 온보딩을 마친 뒤 이 초대로 되돌아오게 하지는 **않는다.** 그러려면 토큰을 어딘가에 남겨 두고
 * 온보딩 끝에서 다시 꺼내야 하는데, 그 저장소는 "앱을 지웠다 깔고 한참 뒤에 온보딩을 마친"
 * 경우에도 남아 있어 이미 끝난 미션 방으로 들어가려 든다. 링크는 대화창에 그대로 남아 있으니
 * 다시 누르는 편이 확실하다.
 */
export function resolveCoopInviteEntry(token: string | null, hasOnboardingResult: boolean): CoopInviteEntry {
  if (!hasOnboardingResult) return { kind: 'onboarding' };
  if (token === null) return { kind: 'invalid' };
  return { kind: 'join', token };
}
