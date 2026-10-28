import { describe, expect, it } from 'vitest';
import { toKstTimestamp } from './kstTimestamp';

/**
 * 모든 케이스를 **epoch 기반**(`Date.UTC` / `...Z` 문자열)으로 만든다.
 * `new Date(2026, 7, 26, 14, 32, 10)` 처럼 로컬 시각으로 만들면 테스트가 CI/개발 머신의
 * 타임존에 따라 다른 순간을 가리켜 결과가 흔들린다 — 그러면 이 함수의 핵심 성질
 * "기기 타임존과 무관하다"를 검증하는 게 아니라 머신 설정을 검증하게 된다.
 */
describe('toKstTimestamp', () => {
  it('스펙 예시대로 UTC 05:32:10을 KST 14:32:10으로 쓴다', () => {
    // 서버 스펙/테스트가 쓰는 예시 값(2026-08-26T14:32:10)과 같은 순간
    expect(toKstTimestamp(new Date('2026-08-26T05:32:10Z'))).toBe('2026-08-26T14:32:10');
  });

  it('offset도 Z도 밀리초도 붙이지 않는다', () => {
    const formatted = toKstTimestamp(new Date('2026-08-26T05:32:10.987Z'));

    expect(formatted).toBe('2026-08-26T14:32:10');
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it('UTC 기준으로는 다음 날이 되는 시각을 KST 날짜로 넘긴다 (날짜 경계)', () => {
    // UTC 20:00 = KST 다음 날 05:00. UTC 날짜(26일)를 그대로 보내면 하루 틀린 값이 저장된다.
    expect(toKstTimestamp(new Date('2026-08-26T20:00:00Z'))).toBe('2026-08-27T05:00:00');
  });

  it('KST 자정 직전/직후를 정확히 가른다', () => {
    // UTC 14:59:59 → KST 23:59:59 (아직 같은 날)
    expect(toKstTimestamp(new Date('2026-08-26T14:59:59Z'))).toBe('2026-08-26T23:59:59');
    // UTC 15:00:00 → KST 다음 날 00:00:00
    expect(toKstTimestamp(new Date('2026-08-26T15:00:00Z'))).toBe('2026-08-27T00:00:00');
  });

  it('연말 경계에서 해도 함께 넘어간다', () => {
    expect(toKstTimestamp(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01T00:00:00');
  });

  it('기기가 KST가 아니어도 같은 순간이면 같은 문자열이 된다', () => {
    // 같은 순간을 세 가지 표기로 만든다 — 뉴욕(-04:00) / 로스앤젤레스(-07:00) / epoch 정수.
    // 세 Date는 모두 동일한 epoch를 가리키므로, 기기 타임존을 어떻게 바꿔도 결과가 같아야 한다.
    const utc = new Date('2026-08-26T05:32:10Z');
    const newYork = new Date('2026-08-26T01:32:10-04:00');
    const losAngeles = new Date('2026-08-25T22:32:10-07:00');
    const fromEpoch = new Date(utc.getTime());

    expect(newYork.getTime()).toBe(utc.getTime());
    expect(losAngeles.getTime()).toBe(utc.getTime());

    for (const date of [utc, newYork, losAngeles, fromEpoch]) {
      expect(toKstTimestamp(date)).toBe('2026-08-26T14:32:10');
    }
  });

  it('toISOString()과 다른 값을 만든다 (UTC 표기를 그대로 보내면 안 되는 이유)', () => {
    const date = new Date('2026-08-26T20:00:00Z');

    // 서버는 tzinfo가 붙은 값을 거절하고, 시각 자체도 KST가 아니다 — 두 가지가 동시에 틀린다.
    expect(date.toISOString()).toBe('2026-08-26T20:00:00.000Z');
    expect(toKstTimestamp(date)).toBe('2026-08-27T05:00:00');
  });

  it('한 자리 월·일·시각을 0으로 채운다', () => {
    // UTC 2026-01-04T00:05:06Z → KST 2026-01-04T09:05:06
    expect(toKstTimestamp(new Date('2026-01-04T00:05:06Z'))).toBe('2026-01-04T09:05:06');
    // 자릿수 보정 없이 만들면 "2026-1-4T9:5:6"이 되어 서버 파싱이 400으로 떨어진다
    expect(toKstTimestamp(new Date('2026-01-03T15:00:00Z'))).toBe('2026-01-04T00:00:00');
  });
});
