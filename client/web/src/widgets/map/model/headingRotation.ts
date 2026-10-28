/**
 * 방향 삼각형의 회전각을 "끊기지 않게" 이어 붙인다.
 *
 * 앱은 heading을 0~360으로 정규화해 보낸다. 그 값을 그대로 CSS rotate에 넣으면 358° → 3°처럼
 * 경계를 넘을 때 각도가 355° 줄어드는 것으로 보인다 — transition이 없으면 튀고, 있으면 반대로
 * 한 바퀴를 돌아간다. 그래서 화면에 쓰는 각도는 정규화하지 않고 **계속 누적**한다.
 * 최단 방향(±180 이내)으로만 더하므로 실제 회전은 항상 짧은 쪽이다.
 */

/** 두 각도 사이의 최단 차이(-180 ~ 180) */
export function shortestAngleDelta(fromDegrees: number, toDegrees: number): number {
  const delta = ((toDegrees - fromDegrees) % 360 + 540) % 360 - 180;
  // -180과 180은 같은 회전량이다. 양수로 고정해 같은 입력이 항상 같은 결과를 주게 한다
  return delta === -180 ? 180 : delta;
}

/**
 * 이전에 화면에 쓴 누적 각도에 새 heading을 최단 방향으로 이어 붙인다.
 *
 * @param previousUnwrapped 직전에 rotate에 넣은 각도(정규화되지 않은 누적값). 없으면 null
 * @param nextHeading 앱이 보낸 0~360 heading
 */
export function unwrapHeading(previousUnwrapped: number | null, nextHeading: number): number {
  if (previousUnwrapped === null) return nextHeading;
  return previousUnwrapped + shortestAngleDelta(previousUnwrapped, nextHeading);
}
