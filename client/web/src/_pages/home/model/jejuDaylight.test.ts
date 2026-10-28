import { describe, expect, it } from 'vitest';
import { isDaytimeInJeju } from './jejuDaylight';

/**
 * 이 함수가 존재하는 이유가 **서버(UTC)와 기기(KST)에서 같은 답을 내는 것**이다.
 * 예전에는 `getHours()`로 로컬 시각을 읽어 둘이 9시간 갈렸고, 그 값이 홈 배경을 가르는 바람에
 * hydration이 깨졌다. 그래서 테스트도 "같은 순간이면 어디서 계산하든 같다"를 본다.
 */
describe('isDaytimeInJeju', () => {
  it('제주 낮(정오)이면 낮이다', () => {
    // 2026-06-15 12:00 KST = 03:00 UTC
    expect(isDaytimeInJeju(new Date('2026-06-15T03:00:00Z'))).toBe(true);
  });

  it('제주 밤(자정)이면 밤이다', () => {
    // 2026-06-15 00:00 KST = 2026-06-14 15:00 UTC
    expect(isDaytimeInJeju(new Date('2026-06-14T15:00:00Z'))).toBe(false);
  });

  /**
   * UTC로 읽으면 낮, KST로 읽으면 밤이 되는 시각. 예전 구현이 서버에서 틀리던 바로 그 구간이다.
   * 2026-06-15 22:00 KST = 13:00 UTC — UTC 13시는 6월 일출~일몰(05:20~19:45) 안이라 "낮"이 됐다.
   */
  it('UTC로 읽으면 낮이 되는 시각도 KST 기준으로 밤이다 — 서버/기기가 갈리던 지점', () => {
    expect(isDaytimeInJeju(new Date('2026-06-15T13:00:00Z'))).toBe(false);
  });

  it('일출 직전은 밤, 일출 정각은 낮이다 — 6월 일출 05:20 KST', () => {
    // 05:19 KST = 20:19 UTC(전날) / 05:20 KST = 20:20 UTC(전날)
    expect(isDaytimeInJeju(new Date('2026-06-14T20:19:00Z'))).toBe(false);
    expect(isDaytimeInJeju(new Date('2026-06-14T20:20:00Z'))).toBe(true);
  });

  it('일몰 정각은 이미 밤이다 — 6월 일몰 19:45 KST', () => {
    // 19:44 KST = 10:44 UTC / 19:45 KST = 10:45 UTC
    expect(isDaytimeInJeju(new Date('2026-06-15T10:44:00Z'))).toBe(true);
    expect(isDaytimeInJeju(new Date('2026-06-15T10:45:00Z'))).toBe(false);
  });

  /**
   * UTC 기준으로는 아직 전달인데 KST로는 다음 달인 순간. 월별 일출·일몰 표를 고르는 데
   * 쓰이므로 월도 KST로 읽어야 한다.
   */
  it('월 경계도 KST로 읽는다 — UTC 12/31 늦은 밤은 KST로 1월이다', () => {
    // 2026-12-31 20:00 UTC = 2027-01-01 05:00 KST → 1월 일출 07:32 이전이라 밤
    expect(isDaytimeInJeju(new Date('2026-12-31T20:00:00Z'))).toBe(false);
    // 2026-12-31 23:00 UTC = 2027-01-01 08:00 KST → 1월 일출 이후라 낮
    expect(isDaytimeInJeju(new Date('2026-12-31T23:00:00Z'))).toBe(true);
  });
});
