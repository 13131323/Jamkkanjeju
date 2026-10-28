import { ERROR_CODE } from '@packages/shared';
import { readApiErrorCode, readApiErrorStatus } from '@/utils/apiError';

/**
 * 협동 미션 API 실패를 화면이 취할 행동으로 좁힌다.
 *
 * 보물찾기의 `resolveTreasureProgressFailure`와 같은 자리다 — 코드 문자열 비교를 화면에
 * 흩뿌리지 않고 여기서 한 번만 한다. `ErrorResponse`가 `{ code: string }` 자유 문자열이라
 * 오타가 컴파일에 걸리지 않으므로, 비교는 `ERROR_CODE` 상수로만 한다.
 */
export type CoopFailure =
  /** 방이 사라졌거나 내가 그 방의 참여자가 아니다. 화면에 남을 이유가 없다 */
  | 'gone'
  /** 이미 끝난 미션 */
  | 'already-completed'
  /** 정원이 찼다(참여 요청) */
  | 'full'
  /** 참여를 받지 않는 단계로 넘어갔다(참여 요청) */
  | 'join-closed'
  /** 초대 링크가 잘못됐거나 만료됐다(참여 요청) */
  | 'invalid-invite'
  /** 지금 단계에서 할 수 없는 동작. 사진 인증은 3단계에서만 받는다 */
  | 'step-not-allowed'
  /** 사진 형식·크기가 서버 조건에 맞지 않는다(JPEG·PNG·WebP, 10MB) */
  | 'invalid-photo'
  /** 이미 인증을 마친 역할 */
  | 'role-already-verified'
  /** 요청이 너무 잦다(429). 곧바로 다시 물으면 제한이 풀리는 시점만 뒤로 밀린다 */
  | 'rate-limited'
  /** 그 외. 재시도가 의미 있을 수 있다 */
  | 'retryable';

/** 요청이 너무 잦다는 표준 응답 코드 */
const HTTP_TOO_MANY_REQUESTS = 429;

export function resolveCoopFailure(error: unknown): CoopFailure {
  // **코드보다 먼저 본다.** 429는 게이트웨이·미들웨어가 돌려주는 경우가 많아
  // 바디에 우리 에러 코드가 없다 — 코드로만 가르면 'retryable'로 떨어져 곧바로 재시도한다.
  if (readApiErrorStatus(error) === HTTP_TOO_MANY_REQUESTS) return 'rate-limited';

  switch (readApiErrorCode(error)) {
    case ERROR_CODE.COOPERATIVE_MISSION_PROGRESS_NOT_FOUND:
    case ERROR_CODE.COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND:
      // 방장이 마지막으로 나가면 진행도 자체가 소프트 딜리트된다. 거절당하면 내 참여자 행이 사라진다.
      // 둘 다 "이 방은 더 이상 없다"로 같게 다룬다 — 화면에서 할 수 있는 일이 같다.
      return 'gone';
    case ERROR_CODE.COOPERATIVE_MISSION_ALREADY_COMPLETED:
      return 'already-completed';
    case ERROR_CODE.COOPERATIVE_MISSION_FULL:
      return 'full';
    case ERROR_CODE.COOPERATIVE_MISSION_JOIN_CLOSED:
      return 'join-closed';
    case ERROR_CODE.INVALID_INVITE_TOKEN:
      return 'invalid-invite';
    case ERROR_CODE.COOPERATIVE_MISSION_STEP_NOT_ALLOWED:
      return 'step-not-allowed';
    case ERROR_CODE.INVALID_REQUEST:
      return 'invalid-photo';
    case ERROR_CODE.COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED:
      return 'role-already-verified';
    default:
      return 'retryable';
  }
}

/** 실패별 안내 문구. 정원 초과는 사용자 지시로 미션 홈에서 토스트로 띄운다 */
export const COOP_FAILURE_MESSAGE: Record<CoopFailure, string> = {
  gone: '미션 방이 사라졌어요.',
  'already-completed': '이미 끝난 미션이에요.',
  full: '정원이 초과되었어요.',
  'join-closed': '이미 시작한 미션이라 참여할 수 없어요.',
  'invalid-invite': '초대 링크가 만료되었거나 잘못된 링크예요.',
  'step-not-allowed': '지금 단계에서는 할 수 없어요.',
  'invalid-photo': '사진을 확인해주세요. (JPEG·PNG·WebP, 10MB 이하)',
  'role-already-verified': '이미 인증을 마친 역할이에요.',
  'rate-limited': '요청이 많아요. 잠시 후 다시 시도해주세요.',
  retryable: '잠시 후 다시 시도해주세요.',
};

/**
 * 폴링을 재시도할지.
 *
 * 방이 사라졌거나 끝난 미션이면 몇 번을 더 물어도 같은 답이 온다. 기본 재시도(3회)를 그대로 두면
 * 2초 간격 폴링이 실패마다 세 번씩 더 요청을 쌓는다.
 *
 * **429는 재시도가 특히 해롭다.** react-query의 기본 재시도 지연은 1초·2초라, 이미 "너무 잦다"는
 * 답을 받은 뒤에 3초 안에 두 번을 더 두드리게 된다. 여기서 멈추고, 다음 주기를
 * `coopPollIntervalMs`가 늦춘 간격으로 미룬다.
 */
export function shouldRetryCoopStatus(failureCount: number, error: unknown): boolean {
  const failure = resolveCoopFailure(error);
  if (failure === 'gone' || failure === 'already-completed' || failure === 'rate-limited') return false;
  return failureCount < 2;
}

/**
 * 화면에 띄울 실패 문구.
 *
 * 아는 실패는 문구가 이미 상황을 설명하므로 그대로 쓴다. **모르는 코드(`retryable`)일 때만**
 * 서버가 준 원문을 괄호에 덧붙인다 — 협동 미션의 에러 코드는 OpenAPI에 열거돼 있지 않아
 * (`ErrorResponse`가 `{ code: string }`이다) 화면에 안 보이면 추적할 방법이 없다.
 */
export function coopFailureMessage(failure: CoopFailure, detail?: string): string {
  const base = COOP_FAILURE_MESSAGE[failure];
  return failure === 'retryable' && detail ? `${base} (${detail})` : base;
}

/**
 * 초대 링크로 들어온 사람에게 보여줄 문구.
 *
 * 그 사람에게 이 방은 "미션 방"이 아니라 **"초대받은 방"**이고, 왜 못 들어가는지가 함께 필요하다
 * (사용자 지시). 링크를 받아 두고 한참 뒤에 눌렀는데 아무 설명 없이 홈으로 떨어지면 앱이
 * 고장난 것으로 읽힌다.
 *
 * **공용 표(`COOP_FAILURE_MESSAGE`)를 고치지 않고 덮어쓰기만 하는 이유**: 그 표는 폴링 실패 등
 * 다른 화면도 함께 쓴다. 거기까지 "초대받은 방"으로 바뀌면 초대와 무관하게 들어온 사람에게
 * 틀린 안내가 된다.
 *
 * 초대 맥락이 따로 없는 실패(정원 초과 등)는 공용 문구가 이미 상황을 설명하므로 그대로 쓴다.
 */
const COOP_INVITE_FAILURE_MESSAGE: Partial<Record<CoopFailure, string>> = {
  gone: '팀원이 모두 나가서 초대받은 방이 없어졌어요.',
  'already-completed': '미션이 끝나서 초대받은 방이 없어졌어요.',
  'invalid-invite': '초대 링크가 만료되어 방에 들어갈 수 없어요.',
};

export function coopInviteFailureMessage(failure: CoopFailure, detail?: string): string {
  return COOP_INVITE_FAILURE_MESSAGE[failure] ?? coopFailureMessage(failure, detail);
}
