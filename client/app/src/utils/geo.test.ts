import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  CAMERA_FOV_DEGREES,
  computeScreenX,
  haversineDistanceMeters,
  isValidHeading,
  isWithinFieldOfView,
  isWithinTreasureRadius,
  normalizeAngleDelta,
  normalizeHeadingDegrees,
  relativeAngle,
  resolveVisibilityWithHysteresis,
  smoothHeading,
  VISIBILITY_HYSTERESIS_MARGIN_DEGREES,
} from './geo';

describe('haversineDistanceMeters', () => {
  it('matches the known straight-line distance between 제주시청 and 서귀포시청', () => {
    const jejuCityHall = { latitude: 33.4996, longitude: 126.5312 };
    const seogwipoCityHall = { latitude: 33.2541, longitude: 126.5601 };

    // 실제 직선거리는 약 27.4km. 허용 오차 300m 이내.
    const distance = haversineDistanceMeters(jejuCityHall, seogwipoCityHall);
    expect(distance).toBeGreaterThan(27130);
    expect(distance).toBeLessThan(27730);
  });

  it('returns ~1112m for a 0.01 degree due-north latitude difference', () => {
    const origin = { latitude: 33.4, longitude: 126.5 };
    const dueNorth = { latitude: 33.41, longitude: 126.5 };

    const distance = haversineDistanceMeters(origin, dueNorth);
    expect(distance).toBeGreaterThan(1100);
    expect(distance).toBeLessThan(1120);
  });

  it('returns 0 for identical coordinates', () => {
    const point = { latitude: 33.4, longitude: 126.5 };
    expect(haversineDistanceMeters(point, point)).toBe(0);
  });
});

describe('bearingDegrees', () => {
  const origin = { latitude: 33.4, longitude: 126.5 };

  it('returns ~0 for due north', () => {
    const north = { latitude: 33.41, longitude: 126.5 };
    expect(bearingDegrees(origin, north)).toBeCloseTo(0, 0);
  });

  it('returns ~90 for due east', () => {
    const east = { latitude: 33.4, longitude: 126.51 };
    expect(bearingDegrees(origin, east)).toBeCloseTo(90, 0);
  });

  it('returns ~180 for due south', () => {
    const south = { latitude: 33.39, longitude: 126.5 };
    expect(bearingDegrees(origin, south)).toBeCloseTo(180, 0);
  });

  it('returns ~270 for due west', () => {
    const west = { latitude: 33.4, longitude: 126.49 };
    expect(bearingDegrees(origin, west)).toBeCloseTo(270, 0);
  });

  it('always returns a value within [0, 360)', () => {
    const bearing = bearingDegrees(origin, { latitude: 33.39, longitude: 126.49 });
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });
});

describe('normalizeAngleDelta', () => {
  it('wraps a delta crossing the 0/360 boundary to the short way around', () => {
    // 350° - 10° = 340°인데, 실제 각도 차이는 -20°(10°에서 350°는 20° 반대 방향)여야 한다.
    expect(normalizeAngleDelta(350 - 10)).toBeCloseTo(-20, 5);
    // 반대 방향도 대칭이어야 한다.
    expect(normalizeAngleDelta(10 - 350)).toBeCloseTo(20, 5);
  });

  it('leaves small deltas unchanged', () => {
    expect(normalizeAngleDelta(15)).toBeCloseTo(15, 5);
    expect(normalizeAngleDelta(-15)).toBeCloseTo(-15, 5);
  });

  it('clamps exactly +180/-180 boundary consistently', () => {
    expect(normalizeAngleDelta(180)).toBeCloseTo(180, 5);
    expect(normalizeAngleDelta(-180)).toBeCloseTo(-180, 5);
    expect(normalizeAngleDelta(181)).toBeCloseTo(-179, 5);
    expect(normalizeAngleDelta(-181)).toBeCloseTo(179, 5);
  });

  it('handles multi-wrap inputs (e.g. 720+ degrees)', () => {
    expect(normalizeAngleDelta(730)).toBeCloseTo(10, 5);
    expect(normalizeAngleDelta(-730)).toBeCloseTo(-10, 5);
  });
});

describe('normalizeHeadingDegrees', () => {
  it('wraps negative headings into [0, 360)', () => {
    expect(normalizeHeadingDegrees(-10)).toBeCloseTo(350, 5);
  });

  it('wraps headings past 360 back into range', () => {
    expect(normalizeHeadingDegrees(370)).toBeCloseTo(10, 5);
  });
});

describe('relativeAngle', () => {
  it('is positive when the treasure bearing is clockwise from device heading', () => {
    // heading 350, bearing 10 → 보물은 오른쪽으로 20도
    expect(relativeAngle(350, 10)).toBeCloseTo(20, 5);
  });

  it('is negative when the treasure bearing is counter-clockwise from device heading', () => {
    // heading 10, bearing 350 → 보물은 왼쪽으로 20도
    expect(relativeAngle(10, 350)).toBeCloseTo(-20, 5);
  });

  it('is 0 when the device points directly at the treasure', () => {
    expect(relativeAngle(45, 45)).toBeCloseTo(0, 5);
  });
});

describe('isWithinFieldOfView / computeScreenX (visibility)', () => {
  it('does not render a treasure directly behind the device (180°)', () => {
    expect(isWithinFieldOfView(180)).toBe(false);
  });

  it('renders a treasure straight ahead (0°)', () => {
    expect(isWithinFieldOfView(0)).toBe(true);
  });

  it('is visible exactly at the FOV/2 boundary and not visible just beyond it', () => {
    const halfFov = CAMERA_FOV_DEGREES / 2;
    expect(isWithinFieldOfView(halfFov)).toBe(true);
    expect(isWithinFieldOfView(halfFov + 0.01)).toBe(false);
  });

  it('places a centered treasure (relative=0) at the screen midpoint', () => {
    expect(computeScreenX(0, 1000)).toBe(500);
  });

  it('shifts the treasure right/left of center proportionally to relative angle', () => {
    const screenWidth = 1000;
    const fov = 60;
    const rightX = computeScreenX(15, screenWidth, fov);
    const leftX = computeScreenX(-15, screenWidth, fov);
    expect(rightX).toBeGreaterThan(500);
    expect(leftX).toBeLessThan(500);
    // 대칭이어야 한다.
    expect(rightX - 500).toBeCloseTo(500 - leftX, 5);
  });
});

describe('resolveVisibilityWithHysteresis', () => {
  it('does not oscillate when relative angle hovers around the FOV/2 boundary', () => {
    const halfFov = CAMERA_FOV_DEGREES / 2;
    const margin = VISIBILITY_HYSTERESIS_MARGIN_DEGREES;

    // 시작: 화면 중앙 근처, 보임 상태
    let visible = resolveVisibilityWithHysteresis(0, false);
    expect(visible).toBe(true);

    // 정확히 FOV/2 경계 살짝 안쪽/바깥쪽을 오가도(±1도), 이미 보이는 상태는 유지되어야 한다
    // (사라짐 임계값은 halfFov + margin 이므로 이 범위에서는 계속 true)
    visible = resolveVisibilityWithHysteresis(halfFov - 1, visible);
    expect(visible).toBe(true);
    visible = resolveVisibilityWithHysteresis(halfFov + 1, visible);
    expect(visible).toBe(true);
    visible = resolveVisibilityWithHysteresis(halfFov - 1, visible);
    expect(visible).toBe(true);

    // margin을 넘어 확실히 벗어나면 사라진다
    visible = resolveVisibilityWithHysteresis(halfFov + margin + 1, visible);
    expect(visible).toBe(false);

    // 다시 halfFov 근처(진입 임계값 밖)로 돌아와도, 나타남 조건(halfFov - margin) 전에는 안 보인다
    visible = resolveVisibilityWithHysteresis(halfFov, visible);
    expect(visible).toBe(false);

    // 나타남 임계값 안쪽으로 들어와야 다시 보인다
    visible = resolveVisibilityWithHysteresis(halfFov - margin - 1, visible);
    expect(visible).toBe(true);
  });

  it('never oscillates across a jittering sequence around the boundary', () => {
    const halfFov = CAMERA_FOV_DEGREES / 2;
    // 경계값 ±0.5도 사이를 반복하는 노이즈 시퀀스
    const jitter = [
      halfFov - 0.5,
      halfFov + 0.5,
      halfFov - 0.3,
      halfFov + 0.4,
      halfFov - 0.2,
      halfFov + 0.5,
    ];

    let visible = true;
    const transitions: boolean[] = [];
    for (const relative of jitter) {
      const next = resolveVisibilityWithHysteresis(relative, visible);
      transitions.push(next);
      visible = next;
    }

    // 마진(5도)보다 훨씬 작은 지터이므로 한 번도 상태가 바뀌면 안 된다(계속 true).
    expect(transitions.every((value) => value === true)).toBe(true);
  });
});

describe('isValidHeading', () => {
  it('treats -1 (no location permission, per expo-location) as invalid', () => {
    expect(isValidHeading(-1)).toBe(false);
  });

  it('treats normal 0~360 headings as valid', () => {
    expect(isValidHeading(0)).toBe(true);
    expect(isValidHeading(359.9)).toBe(true);
  });

  it('treats 360 and above, NaN as invalid', () => {
    expect(isValidHeading(360)).toBe(false);
    expect(isValidHeading(Number.NaN)).toBe(false);
  });
});

describe('smoothHeading', () => {
  it('moves partway from previous toward raw heading using the smoothing factor', () => {
    const smoothed = smoothHeading(10, 20, 0.5);
    expect(smoothed).toBeCloseTo(15, 5);
  });

  it('handles the 0/360 wraparound without jumping the long way around', () => {
    // 350에서 10으로 향하는 원시값이 들어오면, 359 근처가 아니라 0을 지나 10 쪽으로 가야 한다.
    const smoothed = smoothHeading(350, 10, 0.5);
    // 350 -> 360(=0) -> 10 방향으로 절반, 즉 0도(360도)여야 한다.
    expect(normalizeHeadingDegrees(smoothed)).toBeCloseTo(0, 0);
  });

  it('passes through an invalid raw heading (-1) unchanged from the previous value', () => {
    expect(smoothHeading(123, -1)).toBe(123);
  });

  it('adopts the raw heading when the previous value is invalid', () => {
    expect(smoothHeading(-1, 45)).toBeCloseTo(45, 5);
  });
});

describe('isWithinTreasureRadius', () => {
  it('is clickable-eligible at or under 500m', () => {
    expect(isWithinTreasureRadius(500)).toBe(true);
    expect(isWithinTreasureRadius(499)).toBe(true);
  });

  it('is not clickable-eligible beyond 500m', () => {
    expect(isWithinTreasureRadius(501)).toBe(false);
  });
});
