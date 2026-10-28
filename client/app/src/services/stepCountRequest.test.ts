import { describe, expect, it } from 'vitest';
import { toStepCountRequest } from './stepCountRequest';

/**
 * 필드명이 로컬 레코드와 요청 바디에서 서로 다르고(date/steps ↔ recordedDate/stepsCount)
 * 타입이 둘 다 string/number라 바꿔 써도 컴파일이 통과한다 — 서버 400으로만 드러나므로 못박아 둔다.
 */
describe('toStepCountRequest', () => {
  it('date는 recordedDate로, steps는 stepsCount로 옮긴다', () => {
    expect(toStepCountRequest({ date: '2026-09-02', steps: 8241 })).toEqual({ recordedDate: '2026-09-02', stepsCount: 8241 });
  });

  it('걸음 수 0도 그대로 보낸다 — 안 걸은 날도 그 날의 최종값이다', () => {
    expect(toStepCountRequest({ date: '2026-09-01', steps: 0 })).toEqual({ recordedDate: '2026-09-01', stepsCount: 0 });
  });

  it('날짜 형식을 가공하지 않는다 — 저장된 KST YYYY-MM-DD를 그대로 쓴다', () => {
    expect(toStepCountRequest({ date: '2026-12-31', steps: 1 }).recordedDate).toBe('2026-12-31');
  });
});
