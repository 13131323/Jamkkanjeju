import { describe, expect, it } from 'vitest';
import { describeApiError, readApiErrorCode, readApiErrorStatus } from './apiError';

/** axios가 실패 시 던지는 모양. 네트워크 실패면 response 자체가 없다 */
const axiosError = (status?: number, data?: unknown, message?: string) => ({
  ...(message === undefined ? {} : { message }),
  ...(status === undefined && data === undefined ? {} : { response: { status, data } }),
});

describe('readApiErrorCode', () => {
  // 정상 추출과 형태 불일치는 constants/treasureMission.test.ts에서 이미 덮는다.
  // 여기서는 옮겨 온 뒤에도 같은 함수가 export되는지만 확인한다.
  it('협동 미션 에러 코드도 같은 자리에서 읽힌다', () => {
    expect(readApiErrorCode(axiosError(409, { code: 'COOPERATIVE_MISSION_FULL' }))).toBe('COOPERATIVE_MISSION_FULL');
  });
});

describe('readApiErrorStatus', () => {
  it('응답의 HTTP status를 꺼낸다', () => {
    expect(readApiErrorStatus(axiosError(404, { code: 'NOT_FOUND' }))).toBe(404);
  });

  it('응답이 없으면 undefined — 네트워크 실패에는 status가 없다', () => {
    expect(readApiErrorStatus(undefined)).toBeUndefined();
    expect(readApiErrorStatus(new Error('Network Error'))).toBeUndefined();
    expect(readApiErrorStatus({ response: null })).toBeUndefined();
  });

  it('숫자가 아니면 undefined — 문자열 status를 그대로 쓰면 비교가 조용히 어긋난다', () => {
    expect(readApiErrorStatus({ response: { status: '404' } })).toBeUndefined();
  });
});

describe('describeApiError', () => {
  it('status와 code가 둘 다 있으면 둘을 잇는다', () => {
    expect(describeApiError(axiosError(409, { code: 'COOPERATIVE_MISSION_FULL' }))).toBe('HTTP 409 · COOPERATIVE_MISSION_FULL');
  });

  it('status를 못 읽어도 code만으로 말한다', () => {
    expect(describeApiError({ response: { data: { code: 'COOPERATIVE_MISSION_FULL' } } })).toBe('COOPERATIVE_MISSION_FULL');
  });

  it('code가 없으면 응답 바디를 붙인다 — 이 함수가 있는 이유가 바로 이 경우다', () => {
    expect(describeApiError(axiosError(500, { detail: 'Internal Server Error' }))).toBe('HTTP 500 · {"detail":"Internal Server Error"}');
  });

  it('바디가 문자열이면 그대로 쓴다 — HTML 오류 페이지가 이렇게 온다', () => {
    expect(describeApiError(axiosError(502, 'Bad Gateway'))).toBe('HTTP 502 · Bad Gateway');
  });

  it('긴 바디는 200자에서 자르고 말줄임표를 붙인다 — 토스트 한 줄에 들어가야 한다', () => {
    const body = 'x'.repeat(300);

    expect(describeApiError(axiosError(500, body))).toBe(`HTTP 500 · ${'x'.repeat(200)}…`);
  });

  it('정확히 200자인 바디는 자르지 않는다', () => {
    const body = 'x'.repeat(200);

    expect(describeApiError(axiosError(500, body))).toBe(`HTTP 500 · ${body}`);
  });

  it('바디가 없으면 status만 말한다', () => {
    expect(describeApiError(axiosError(404, null))).toBe('HTTP 404');
    expect(describeApiError({ response: { status: 404 } })).toBe('HTTP 404');
  });

  it('응답이 없으면 axios가 남긴 message를 보여준다', () => {
    expect(describeApiError(axiosError(undefined, undefined, 'Network Error'))).toBe('요청 실패 · Network Error');
    expect(describeApiError(new Error('timeout of 5000ms exceeded'))).toBe('요청 실패 · timeout of 5000ms exceeded');
  });

  it('message조차 없으면 중립 문구', () => {
    expect(describeApiError({})).toBe('요청 실패 · 알 수 없는 오류');
    expect(describeApiError({ message: 500 })).toBe('요청 실패 · 알 수 없는 오류');
  });

  it('순환 참조 바디에도 throw하지 않는다 — JSON.stringify가 여기서 죽으면 화면이 함께 죽는다', () => {
    const data: Record<string, unknown> = { detail: 'boom' };
    data.self = data;

    expect(() => describeApiError(axiosError(500, data))).not.toThrow();
    expect(describeApiError(axiosError(500, data))).toBe('HTTP 500');
  });

  it('어떤 입력이 와도 문자열을 돌려준다 — 디버깅 문구가 새 에러의 원인이 되면 안 된다', () => {
    for (const input of [undefined, null, 42, '문자열', true, []]) {
      expect(typeof describeApiError(input)).toBe('string');
    }
  });
});
