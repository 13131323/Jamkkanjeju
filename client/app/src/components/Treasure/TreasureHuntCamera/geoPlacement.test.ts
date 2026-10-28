import { describe, expect, it } from 'vitest';
import { computeTreasurePlacement, TREASURE_ICON_SIZE_FAR_PX, TREASURE_ICON_SIZE_NEAR_PX } from './geoPlacement';

// 적도 위 임의의 기준점. 위도 1도 ≈ 111320m — 북쪽으로만 이동시켜 bearing이 항상 0(정북)이
// 되도록 해서 heading만 바꿔가며 relativeAngle을 원하는 값으로 손쉽게 통제한다.
const ORIGIN = { latitude: 0, longitude: 0 };
const METERS_PER_DEGREE_LATITUDE = 111320;

function northOf(meters: number) {
  return { latitude: meters / METERS_PER_DEGREE_LATITUDE, longitude: 0 };
}

const RADIUS_METERS = 500;
const SCREEN_WIDTH_PX = 360;
const SCREEN_HEIGHT_PX = 800;

describe('computeTreasurePlacement — 거리 조건과 방위 조건의 독립성 (문서 §3 표)', () => {
  it('500m 밖이면 정면을 보고 있어도(relative=0) 보이지 않는다', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: northOf(600),
      deviceHeading: 0, // 보물 쪽을 정확히 바라봄
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    expect(placement.withinRadius).toBe(false);
    expect(placement.visible).toBe(false);
    expect(placement.clickable).toBe(false);
  });

  it('500m 안이어도 등 뒤(relative=180)면 보이지 않는다', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: northOf(100),
      deviceHeading: 180, // 보물과 정반대 방향을 바라봄
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    expect(placement.withinRadius).toBe(true);
    expect(placement.visible).toBe(false);
    expect(placement.clickable).toBe(false);
  });

  it('500m 안이고 정면을 보고 있으면 보이고 탭도 가능하다', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: northOf(100),
      deviceHeading: 0,
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    expect(placement.withinRadius).toBe(true);
    expect(placement.visible).toBe(true);
    expect(placement.clickable).toBe(true);
    expect(placement.screenX).toBeCloseTo(SCREEN_WIDTH_PX / 2, 5);
  });
});

describe('computeTreasurePlacement — 히스테리시스 여유 구간에서는 보이지만 탭은 막힌다', () => {
  // CAMERA_FOV_DEGREES 기본값 65 → half=32.5, 기본 margin 5 → 사라짐 임계값 37.5.
  // relative=35는 "정확한 FOV 절반(32.5)"은 넘었지만 "사라짐 임계값(37.5)"은 아직 안 넘은 구간.
  it('사라짐 여유 구간(FOV/2 < |relative| <= FOV/2+margin)에서 wasVisible=true면 visible=true, clickable=false', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: northOf(100),
      deviceHeading: 325, // relativeAngle(325, bearing=0) === 35
      wasVisible: true,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    expect(placement.visible).toBe(true);
    expect(placement.clickable).toBe(false);
  });

  it('같은 각도라도 wasVisible=false(처음 진입)면 진입 임계값(FOV/2-margin=27.5)을 넘어 보이지 않는다', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: northOf(100),
      deviceHeading: 325, // relative === 35
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    expect(placement.visible).toBe(false);
    expect(placement.nextWasVisible).toBe(false);
  });
});

describe('computeTreasurePlacement — 아이콘 크기/위치 보간 (spec [추정] 항목)', () => {
  it('거리 0에서는 near 크기(123px)를 그대로 쓴다', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: ORIGIN,
      deviceHeading: 0,
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    expect(placement.iconSize).toBeCloseTo(TREASURE_ICON_SIZE_NEAR_PX, 5);
  });

  it('반경 경계(500m)에서는 far 크기(61px)가 된다', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: northOf(RADIUS_METERS),
      deviceHeading: 0,
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    // northOf()가 위도 1도=111320m로 근사한 값이라 haversine 실제 거리와 소수점 오차가 있다 — 정밀도를 낮춘다.
    expect(placement.iconSize).toBeCloseTo(TREASURE_ICON_SIZE_FAR_PX, 0);
  });

  it('반경을 넘어서도(보이지는 않더라도) 비율은 1로 클램프되어 far 값 밑으로 내려가지 않는다', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: northOf(RADIUS_METERS * 2),
      deviceHeading: 0,
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    expect(placement.iconSize).toBeCloseTo(TREASURE_ICON_SIZE_FAR_PX, 5);
  });

  it('중간 거리(250m)에서는 두 값의 중간값이 된다', () => {
    const placement = computeTreasurePlacement({
      currentCoords: ORIGIN,
      treasureCoords: northOf(RADIUS_METERS / 2),
      deviceHeading: 0,
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      screenHeightPx: SCREEN_HEIGHT_PX,
      radiusMeters: RADIUS_METERS,
    });

    expect(placement.iconSize).toBeCloseTo((TREASURE_ICON_SIZE_NEAR_PX + TREASURE_ICON_SIZE_FAR_PX) / 2, 0);
  });
});

describe('computeTreasurePlacement — 아이콘은 화면 세로 중앙에 선다', () => {
  it('거리와 무관하게 아이콘 중심이 화면 중앙에 온다', () => {
    for (const meters of [0, 100, 250, RADIUS_METERS]) {
      const placement = computeTreasurePlacement({
        currentCoords: ORIGIN,
        treasureCoords: northOf(meters),
        deviceHeading: 0,
        wasVisible: false,
        screenWidthPx: SCREEN_WIDTH_PX,
        screenHeightPx: SCREEN_HEIGHT_PX,
        radiusMeters: RADIUS_METERS,
      });

      expect(placement.iconTop + placement.iconSize / 2).toBeCloseTo(SCREEN_HEIGHT_PX / 2, 5);
    }
  });

  it('화면 높이가 달라지면 중앙도 따라간다 — 800 시안 좌표를 고정값으로 쓰지 않는다', () => {
    const params = {
      currentCoords: ORIGIN,
      treasureCoords: northOf(100),
      deviceHeading: 0,
      wasVisible: false,
      screenWidthPx: SCREEN_WIDTH_PX,
      radiusMeters: RADIUS_METERS,
    };

    const short = computeTreasurePlacement({ ...params, screenHeightPx: 640 });
    const tall = computeTreasurePlacement({ ...params, screenHeightPx: 960 });

    expect(short.iconTop + short.iconSize / 2).toBeCloseTo(320, 5);
    expect(tall.iconTop + tall.iconSize / 2).toBeCloseTo(480, 5);
  });
});

/**
 * 아이콘이 전부 정확히 같은 중심에 서면, 크기만 다른 것들의 가장자리가 사선을 이뤄
 * "대각선"으로 읽힌다. 그래서 보물마다 세로로 조금씩 어긋나게 둔다(verticalJitter.ts).
 */
describe('computeTreasurePlacement — 세로 지터', () => {
  const baseParams = {
    currentCoords: ORIGIN,
    treasureCoords: northOf(100),
    deviceHeading: 0,
    wasVisible: false,
    screenWidthPx: SCREEN_WIDTH_PX,
    screenHeightPx: SCREEN_HEIGHT_PX,
    radiusMeters: RADIUS_METERS,
  };

  it('씨앗이 없으면 정확히 중앙 — 지터는 얹는 장식이지 배치의 전제가 아니다', () => {
    const placement = computeTreasurePlacement(baseParams);

    expect(placement.verticalJitterPx).toBe(0);
    expect(placement.iconTop + placement.iconSize / 2).toBeCloseTo(SCREEN_HEIGHT_PX / 2, 5);
  });

  it('같은 씨앗은 몇 번을 계산해도 같은 자리 — 방위각 갱신마다 떨리면 안 된다', () => {
    const first = computeTreasurePlacement({ ...baseParams, jitterSeed: 2 });
    const second = computeTreasurePlacement({ ...baseParams, jitterSeed: 2 });

    expect(first.iconTop).toBe(second.iconTop);
    expect(first.verticalJitterPx).toBe(second.verticalJitterPx);
  });

  it('heading이 바뀌어도 세로 위치는 그대로다 — 가로만 움직여야 한다', () => {
    const straight = computeTreasurePlacement({ ...baseParams, jitterSeed: 2, deviceHeading: 0 });
    const turned = computeTreasurePlacement({ ...baseParams, jitterSeed: 2, deviceHeading: 10 });

    expect(turned.iconTop).toBe(straight.iconTop);
    expect(turned.screenX).not.toBe(straight.screenX);
  });

  it('보물마다 다른 높이에 선다 — 한 줄로 정렬되지 않는 것이 목적이다', () => {
    const tops = [1, 2, 3].map((seed) => computeTreasurePlacement({ ...baseParams, jitterSeed: seed }).iconTop);

    expect(new Set(tops).size).toBe(3);
  });

  it('iconTop은 언제나 "중앙 기준선 + verticalJitterPx"다 (separatePlacements가 이 관계에 기댄다)', () => {
    for (const seed of [1, 2, 3, 'a']) {
      const placement = computeTreasurePlacement({ ...baseParams, jitterSeed: seed });
      const centered = SCREEN_HEIGHT_PX / 2 - placement.iconSize / 2;

      expect(placement.iconTop - placement.verticalJitterPx).toBeCloseTo(centered, 5);
    }
  });

  it('거리감은 그대로다 — 세로 위치가 아니라 크기가 거리를 나타낸다', () => {
    const near = computeTreasurePlacement({ ...baseParams, treasureCoords: northOf(10), jitterSeed: 1 });
    const far = computeTreasurePlacement({ ...baseParams, treasureCoords: northOf(480), jitterSeed: 1 });

    expect(near.iconSize).toBeGreaterThan(far.iconSize);
    expect(near.iconSize).toBeLessThanOrEqual(TREASURE_ICON_SIZE_NEAR_PX);
    expect(far.iconSize).toBeGreaterThanOrEqual(TREASURE_ICON_SIZE_FAR_PX);
    // 같은 씨앗이면 지터도 같다 — 거리가 달라졌다고 세로 자리가 바뀌면 안 된다
    expect(near.verticalJitterPx).toBe(far.verticalJitterPx);
  });
});
