import { isValidHeading, normalizeAngleDelta } from '@/utils/geo';

/**
 * 위치 전송 최소 간격(ms). expo-location watchPositionAsync의 timeInterval과 별개로,
 * 실제 sendToWeb 호출 빈도를 한 번 더 제한하는 방어선이다.
 */
export const POSITION_SEND_THROTTLE_MS = 1000;

/**
 * heading 변화가 이 값(도) 이상일 때만 전송한다.
 * 매 heading 이벤트(초당 수십 회 가능)마다 postMessage + JSON + Zod 파싱하는 낭비를 막는다
 * (docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §4).
 */
export const HEADING_SEND_THRESHOLD_DEG = 3;

/**
 * heading이 무효값(-1 등)인지 판단한다. 위치 권한이 없거나 나침반이 아직 준비되지 않은 경우
 * expo-location의 trueHeading은 -1을 반환한다. step2 배치 계산(src/utils/geo.ts)과
 * 동일한 유효성 판정을 그대로 재사용해 "heading 단일 소스" 원칙을 지킨다.
 */
export function isHeadingInvalid(heading: number): boolean {
  return !isValidHeading(heading);
}

/** 두 각도(0~360) 사이의 최단 차이를 0~180 범위로 반환한다. */
export function angularDelta(a: number, b: number): number {
  return Math.abs(normalizeAngleDelta(a - b));
}

/**
 * 위치(lat/lng) 변경을 이유로 전송할지 여부.
 * 마지막 전송 이후 POSITION_SEND_THROTTLE_MS가 지나지 않았으면 보류한다.
 */
export function shouldSendForPosition(now: number, lastSentAt: number | null): boolean {
  if (lastSentAt === null) return true;
  return now - lastSentAt >= POSITION_SEND_THROTTLE_MS;
}

/**
 * heading 변경을 이유로 전송할지 여부.
 * - 이전에 보낸 적이 없으면 전송.
 * - 유효 ↔ 무효(-1) 전환은 항상 전송(웹이 삼각형을 지우거나 그리도록 즉시 알려야 함).
 * - 그 외에는 각도 차이가 임계값 이상일 때만 전송.
 */
export function shouldSendForHeading(next: number, lastSent: number | null): boolean {
  if (lastSent === null) return true;

  const nextInvalid = isHeadingInvalid(next);
  const lastInvalid = isHeadingInvalid(lastSent);
  if (nextInvalid !== lastInvalid) return true;
  if (nextInvalid && lastInvalid) return false;

  return angularDelta(next, lastSent) >= HEADING_SEND_THRESHOLD_DEG;
}
