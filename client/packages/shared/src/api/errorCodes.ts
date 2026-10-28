/**
 * 에러코드 단일 출처.
 *
 * 서버 에러 바디 규격이 확정되기 전이라, 지금은 HTTP status에서 코드를 유도하는 매핑만 둔다.
 * 서버가 code 필드를 내려주기 시작하면 ERROR_CODE에 도메인 코드를 추가하고
 * resolveErrorCode가 바디의 code를 우선 사용하도록 바꾸면 된다.
 */

export const ERROR_CODE = {
  /** 원인을 특정하지 못한 경우 */
  UNKNOWN: 'UNKNOWN',
  /** 요청 자체가 나가지 못했거나 응답을 못 받은 경우 */
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  /** 422 등 입력값 검증 실패 */
  VALIDATION: 'VALIDATION',
  SERVER: 'SERVER',

  // ── 협동 미션 도메인 코드 (서버가 code 필드로 내려준다) ──
  COOPERATIVE_MISSION_NOT_FOUND: 'COOPERATIVE_MISSION_NOT_FOUND',
  COOPERATIVE_MISSION_PROGRESS_NOT_FOUND: 'COOPERATIVE_MISSION_PROGRESS_NOT_FOUND',
  COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND: 'COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND',
  COOPERATIVE_ROLE_PROGRESS_NOT_FOUND: 'COOPERATIVE_ROLE_PROGRESS_NOT_FOUND',
  COOPERATIVE_MISSION_ALREADY_COMPLETED: 'COOPERATIVE_MISSION_ALREADY_COMPLETED',
  COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED: 'COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED',
  COOPERATIVE_MISSION_STEP_NOT_ALLOWED: 'COOPERATIVE_MISSION_STEP_NOT_ALLOWED',
  COOPERATIVE_ROLE_PROGRESS_ACCESS_DENIED: 'COOPERATIVE_ROLE_PROGRESS_ACCESS_DENIED',
  /** 사진 누락·허용하지 않는 형식(JPEG/PNG/WebP 외)·10MB 초과 */
  INVALID_REQUEST: 'INVALID_REQUEST',
  // 참여 요청(POST /cooperative-missions/join-requests)
  INVALID_INVITE_TOKEN: 'INVALID_INVITE_TOKEN',
  COOPERATIVE_MISSION_FULL: 'COOPERATIVE_MISSION_FULL',
  COOPERATIVE_MISSION_JOIN_CLOSED: 'COOPERATIVE_MISSION_JOIN_CLOSED',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/** 사용자에게 그대로 보여줄 수 있는 기본 문구 */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  [ERROR_CODE.UNKNOWN]: '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
  [ERROR_CODE.NETWORK]: '네트워크에 연결할 수 없어요. 연결 상태를 확인해주세요.',
  [ERROR_CODE.TIMEOUT]: '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.',
  [ERROR_CODE.BAD_REQUEST]: '요청을 처리할 수 없어요.',
  [ERROR_CODE.UNAUTHORIZED]: '로그인이 필요해요.',
  [ERROR_CODE.FORBIDDEN]: '접근 권한이 없어요.',
  [ERROR_CODE.NOT_FOUND]: '요청하신 정보를 찾을 수 없어요.',
  [ERROR_CODE.VALIDATION]: '입력값을 다시 확인해주세요.',
  [ERROR_CODE.SERVER]: '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',

  [ERROR_CODE.COOPERATIVE_MISSION_NOT_FOUND]: '미션 정보를 찾을 수 없어요.',
  [ERROR_CODE.COOPERATIVE_MISSION_PROGRESS_NOT_FOUND]: '진행 중인 미션을 찾을 수 없어요.',
  [ERROR_CODE.COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND]: '이 미션에 참여 중이 아니에요.',
  [ERROR_CODE.COOPERATIVE_ROLE_PROGRESS_NOT_FOUND]: '역할 정보를 찾을 수 없어요.',
  [ERROR_CODE.COOPERATIVE_MISSION_ALREADY_COMPLETED]: '이미 끝난 미션이에요.',
  [ERROR_CODE.COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED]: '이미 인증을 마친 역할이에요.',
  [ERROR_CODE.COOPERATIVE_MISSION_STEP_NOT_ALLOWED]: '지금 단계에서는 할 수 없어요.',
  [ERROR_CODE.COOPERATIVE_ROLE_PROGRESS_ACCESS_DENIED]: '내 역할이 아니에요.',
  [ERROR_CODE.INVALID_REQUEST]: '사진을 확인해주세요. (JPEG·PNG·WebP, 10MB 이하)',
  [ERROR_CODE.INVALID_INVITE_TOKEN]: '초대 링크가 만료되었거나 잘못된 링크예요.',
  [ERROR_CODE.COOPERATIVE_MISSION_FULL]: '정원이 초과되었어요.',
  [ERROR_CODE.COOPERATIVE_MISSION_JOIN_CLOSED]: '이미 시작한 미션이라 참여할 수 없어요.',
};

/** 서버가 에러 바디를 내려줄 때의 최소 형태 */
export interface ApiErrorBody {
  code?: string;
  message?: string;
}

/**
 * HTTP status → 공용 에러코드.
 * status가 없으면(요청 실패/타임아웃) NETWORK로 본다.
 */
export function errorCodeFromStatus(status?: number): ErrorCode {
  if (status === undefined) return ERROR_CODE.NETWORK;
  if (status === 400) return ERROR_CODE.BAD_REQUEST;
  if (status === 401) return ERROR_CODE.UNAUTHORIZED;
  if (status === 403) return ERROR_CODE.FORBIDDEN;
  if (status === 404) return ERROR_CODE.NOT_FOUND;
  if (status === 408) return ERROR_CODE.TIMEOUT;
  if (status === 422) return ERROR_CODE.VALIDATION;
  if (status >= 500) return ERROR_CODE.SERVER;
  if (status >= 400) return ERROR_CODE.BAD_REQUEST;
  return ERROR_CODE.UNKNOWN;
}

/** 서버 바디의 code가 우리가 아는 값이면 그걸, 아니면 status에서 유도한 값을 쓴다 */
export function resolveErrorCode(status?: number, body?: ApiErrorBody): ErrorCode {
  const fromBody = body?.code;
  if (fromBody && fromBody in ERROR_MESSAGE) return fromBody as ErrorCode;
  return errorCodeFromStatus(status);
}

export function errorMessageOf(code: ErrorCode): string {
  return ERROR_MESSAGE[code];
}
