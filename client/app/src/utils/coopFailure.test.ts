import { describe, expect, it } from 'vitest';
import { COOP_FAILURE_MESSAGE, resolveCoopFailure, shouldRetryCoopStatus } from './coopFailure';

/** axios 에러의 최소 형태. 실제 axios를 끌어오지 않고 읽는 겹만 흉내낸다 */
const apiError = (code: string) => ({ response: { data: { code } } });

describe('resolveCoopFailure', () => {
  it('진행도가 없으면 gone — 마지막 ACCEPTED 참가자가 나가면 진행도 자체가 삭제된다', () => {
    expect(resolveCoopFailure(apiError('COOPERATIVE_MISSION_PROGRESS_NOT_FOUND'))).toBe('gone');
  });

  it('내 참여자 행이 없어도 gone — 거절당하면 참여자가 지워진다', () => {
    expect(resolveCoopFailure(apiError('COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND'))).toBe('gone');
  });

  it('정원 초과는 full', () => {
    expect(resolveCoopFailure(apiError('COOPERATIVE_MISSION_FULL'))).toBe('full');
  });

  it('참여를 받지 않는 단계는 join-closed', () => {
    expect(resolveCoopFailure(apiError('COOPERATIVE_MISSION_JOIN_CLOSED'))).toBe('join-closed');
  });

  it('잘못된 초대 토큰은 invalid-invite', () => {
    expect(resolveCoopFailure(apiError('INVALID_INVITE_TOKEN'))).toBe('invalid-invite');
  });

  it('이미 끝난 미션은 already-completed', () => {
    expect(resolveCoopFailure(apiError('COOPERATIVE_MISSION_ALREADY_COMPLETED'))).toBe('already-completed');
  });

  it('단계가 맞지 않으면 step-not-allowed — 사진 인증은 3단계에서만 받는다', () => {
    expect(resolveCoopFailure(apiError('COOPERATIVE_MISSION_STEP_NOT_ALLOWED'))).toBe('step-not-allowed');
  });

  it('사진 형식·크기 문제는 invalid-photo', () => {
    expect(resolveCoopFailure(apiError('INVALID_REQUEST'))).toBe('invalid-photo');
  });

  it('이미 인증한 역할은 role-already-verified', () => {
    expect(resolveCoopFailure(apiError('COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED'))).toBe('role-already-verified');
  });

  it('모르는 코드와 네트워크 실패는 retryable', () => {
    // 서버가 코드를 새로 추가해도 화면이 멈추지 않아야 한다
    expect(resolveCoopFailure(apiError('SOMETHING_NEW'))).toBe('retryable');
    expect(resolveCoopFailure(new Error('network'))).toBe('retryable');
    expect(resolveCoopFailure(undefined)).toBe('retryable');
  });
});

describe('shouldRetryCoopStatus', () => {
  it('방이 사라졌으면 재시도하지 않는다 — 같은 답이 계속 온다', () => {
    expect(shouldRetryCoopStatus(0, apiError('COOPERATIVE_MISSION_PROGRESS_NOT_FOUND'))).toBe(false);
  });

  it('끝난 미션도 재시도하지 않는다', () => {
    expect(shouldRetryCoopStatus(0, apiError('COOPERATIVE_MISSION_ALREADY_COMPLETED'))).toBe(false);
  });

  it('일시적 실패는 두 번까지 재시도한다 — 2초 폴링이 실패마다 요청을 쌓으면 안 된다', () => {
    const error = new Error('network');
    expect(shouldRetryCoopStatus(0, error)).toBe(true);
    expect(shouldRetryCoopStatus(1, error)).toBe(true);
    expect(shouldRetryCoopStatus(2, error)).toBe(false);
  });
});

describe('COOP_FAILURE_MESSAGE', () => {
  it('정원 초과 문구는 사용자 지시대로다', () => {
    expect(COOP_FAILURE_MESSAGE.full).toBe('정원이 초과되었어요.');
  });

  it('모든 실패에 문구가 있다 — 문구 없는 실패는 화면에서 침묵이 된다', () => {
    const failures = ['gone', 'already-completed', 'full', 'join-closed', 'invalid-invite', 'step-not-allowed', 'invalid-photo', 'role-already-verified', 'retryable'] as const;
    failures.forEach((failure) => {
      expect(COOP_FAILURE_MESSAGE[failure].length).toBeGreaterThan(0);
    });
  });
});

/** 게이트웨이가 돌려주는 429. 바디에 우리 에러 코드가 없는 경우가 많다 */
const rateLimitError = (code?: string) => ({ response: { status: 429, data: code === undefined ? {} : { code } } });

describe('429(요청 과다)', () => {
  it('status 429는 rate-limited — 바디에 코드가 없어도 알아본다', () => {
    expect(resolveCoopFailure(rateLimitError())).toBe('rate-limited');
  });

  it('코드보다 status를 먼저 본다 — 429에 엉뚱한 코드가 실려 와도 재시도로 떨어지지 않는다', () => {
    expect(resolveCoopFailure(rateLimitError('INVALID_REQUEST'))).toBe('rate-limited');
  });

  it('재시도하지 않는다 — 기본 재시도 지연(1초·2초)이면 3초 안에 두 번을 더 두드린다', () => {
    expect(shouldRetryCoopStatus(0, rateLimitError())).toBe(false);
  });

  it('안내 문구가 있다', () => {
    expect(COOP_FAILURE_MESSAGE['rate-limited']).toBeTruthy();
  });

  it('다른 status는 그대로 코드로 판정한다', () => {
    expect(resolveCoopFailure({ response: { status: 409, data: { code: 'COOPERATIVE_MISSION_FULL' } } })).toBe('full');
  });
});
