import { describe, expect, it } from 'vitest';
import { TREASURE_INVALID_HEADING } from '@/bridge';
import {
  HEADING_SEND_THRESHOLD_DEG,
  POSITION_SEND_THROTTLE_MS,
  angularDelta,
  isHeadingInvalid,
  shouldSendForHeading,
  shouldSendForPosition,
} from './throttle';

describe('isHeadingInvalid', () => {
  it('treats -1 as invalid', () => {
    expect(isHeadingInvalid(TREASURE_INVALID_HEADING)).toBe(true);
  });

  it('treats a normal heading as valid', () => {
    expect(isHeadingInvalid(0)).toBe(false);
    expect(isHeadingInvalid(359)).toBe(false);
  });
});

describe('angularDelta', () => {
  it('returns 0 for identical angles', () => {
    expect(angularDelta(10, 10)).toBe(0);
  });

  it('returns the short way around the 0/360 wrap boundary', () => {
    expect(angularDelta(359, 1)).toBe(2);
    expect(angularDelta(1, 359)).toBe(2);
  });

  it('returns the plain difference when well within range', () => {
    expect(angularDelta(100, 130)).toBe(30);
  });

  it('caps at 180 for opposite angles', () => {
    expect(angularDelta(0, 180)).toBe(180);
  });
});

describe('shouldSendForPosition', () => {
  it('sends on the first update (no prior send)', () => {
    expect(shouldSendForPosition(1000, null)).toBe(true);
  });

  it('withholds updates inside the throttle window', () => {
    expect(shouldSendForPosition(1000 + POSITION_SEND_THROTTLE_MS - 1, 1000)).toBe(false);
  });

  it('sends once the throttle window has elapsed', () => {
    expect(shouldSendForPosition(1000 + POSITION_SEND_THROTTLE_MS, 1000)).toBe(true);
  });
});

describe('shouldSendForHeading', () => {
  it('sends on the first update (no prior send)', () => {
    expect(shouldSendForHeading(45, null)).toBe(true);
  });

  it('withholds updates below the angular threshold', () => {
    expect(shouldSendForHeading(45 + HEADING_SEND_THRESHOLD_DEG - 1, 45)).toBe(false);
  });

  it('sends once the angular threshold is reached', () => {
    expect(shouldSendForHeading(45 + HEADING_SEND_THRESHOLD_DEG, 45)).toBe(true);
  });

  it('always sends when transitioning from valid to invalid heading', () => {
    expect(shouldSendForHeading(TREASURE_INVALID_HEADING, 45)).toBe(true);
  });

  it('always sends when transitioning from invalid to valid heading', () => {
    expect(shouldSendForHeading(45, TREASURE_INVALID_HEADING)).toBe(true);
  });

  it('withholds repeated invalid-heading updates', () => {
    expect(shouldSendForHeading(TREASURE_INVALID_HEADING, TREASURE_INVALID_HEADING)).toBe(false);
  });
});
