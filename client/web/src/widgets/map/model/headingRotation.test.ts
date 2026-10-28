import { describe, expect, it } from 'vitest';
import { shortestAngleDelta, unwrapHeading } from './headingRotation';

describe('shortestAngleDelta', () => {
  it('같은 방향이면 0이다', () => {
    expect(shortestAngleDelta(90, 90)).toBe(0);
  });

  it('시계 방향은 양수, 반시계는 음수다', () => {
    expect(shortestAngleDelta(90, 100)).toBe(10);
    expect(shortestAngleDelta(100, 90)).toBe(-10);
  });

  it('0/360 경계를 최단 방향으로 넘는다 — 이게 안 되면 삼각형이 한 바퀴 돌아간다', () => {
    expect(shortestAngleDelta(358, 3)).toBe(5);
    expect(shortestAngleDelta(3, 358)).toBe(-5);
  });

  it('정반대는 180으로 고정한다 — 같은 입력이 항상 같은 방향으로 돌아야 한다', () => {
    expect(shortestAngleDelta(0, 180)).toBe(180);
    expect(shortestAngleDelta(180, 0)).toBe(180);
  });
});

/**
 * 누적하지 않으면 경계에서 CSS transition이 긴 쪽으로 돈다. 화면에 넣는 각도는 정규화 없이
 * 계속 누적되므로 360을 넘거나 음수가 될 수 있고, 그게 정상이다.
 */
describe('unwrapHeading', () => {
  it('첫 값은 그대로 쓴다', () => {
    expect(unwrapHeading(null, 42)).toBe(42);
  });

  it('경계를 넘어도 각도가 이어진다', () => {
    expect(unwrapHeading(358, 3)).toBe(363);
  });

  it('반대로 넘으면 음수가 된다 — 정규화하면 다시 튄다', () => {
    expect(unwrapHeading(3, 358)).toBe(-2);
  });

  it('여러 번 넘어도 계속 누적된다', () => {
    let angle = unwrapHeading(null, 350);
    angle = unwrapHeading(angle, 10);
    angle = unwrapHeading(angle, 30);
    angle = unwrapHeading(angle, 350);
    expect(angle).toBe(350 + 20 + 20 - 40);
  });

  it('앱의 전송 임계값(3도) 단위 변화도 그대로 따라간다', () => {
    let angle = unwrapHeading(null, 0);
    for (const heading of [3, 6, 9, 12]) angle = unwrapHeading(angle, heading);
    expect(angle).toBe(12);
  });
});
