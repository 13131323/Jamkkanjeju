import { describe, expect, it } from 'vitest';
import { toStepCountRequest } from './stepCountRequest';

/**
 * 필드명이 로컬 레코드와 요청 바디에서 서로 다르고(date/steps ↔ recordedAt/stepsCount)
 * 타입이 둘 다 string/number라 바꿔 써도 컴파일이 통과한다 — 서버 400으로만 드러나므로 못박아 둔다.
 *
 * `recordedAt`은 orval 업그레이드(커밋 b58c9d6)에서 `recordedDate`(날짜)에서 바뀐 것이다.
 * 날짜를 그대로 넣으면 형식이 맞지 않고, 지금 시각을 넣으면 어제 걸음 수가 오늘로 저장된다 —
 * 둘 다 타입이 string이라 컴파일로는 안 잡힌다.
 *
 * `isGoalAchieved`는 지금 자리표시자(false)라 값 자체를 고정하지 않는다. 목표와 비교하는 판정이
 * 붙는 것은 별도 작업이므로, 여기서 false를 못박아 두면 그 작업이 이 테스트부터 고쳐야 한다.
 */
describe('toStepCountRequest', () => {
  it('date는 그 날의 마지막 순간(KST)으로, steps는 stepsCount로 옮긴다', () => {
    expect(toStepCountRequest({ date: '2026-09-02', steps: 8241 })).toMatchObject({
      recordedAt: '2026-09-02T23:59:59',
      stepsCount: 8241,
    });
  });

  it('걸음 수 0도 그대로 보낸다 — 안 걸은 날도 그 날의 최종값이다', () => {
    expect(toStepCountRequest({ date: '2026-09-01', steps: 0 })).toMatchObject({ recordedAt: '2026-09-01T23:59:59', stepsCount: 0 });
  });

  // 날짜를 그대로 두지 않고 시각으로 옮기므로, 날짜 자체가 밀리지 않는지가 핵심이다.
  // KST 자정 기준으로 계산하는데 UTC로 읽으면 하루가 밀린다(2026-12-31 → 2026-12-30).
  it('연말·월말에도 날짜가 밀리지 않는다', () => {
    expect(toStepCountRequest({ date: '2026-12-31', steps: 1 }).recordedAt).toBe('2026-12-31T23:59:59');
    expect(toStepCountRequest({ date: '2026-03-01', steps: 1 }).recordedAt).toBe('2026-03-01T23:59:59');
  });

  it('필수 필드를 빠짐없이 채운다 — 생략하면 서버가 400으로 거절한다', () => {
    expect(Object.keys(toStepCountRequest({ date: '2026-09-02', steps: 100 })).sort()).toEqual(['isGoalAchieved', 'recordedAt', 'stepsCount']);
  });
});
