import { describe, expect, it } from 'vitest';
import { resolveNearestTreasure, resolveSheetVisibility, shouldLeaveCamera } from './treasureProximity';

const origin = { latitude: 33.4996, longitude: 126.5312 };

/** 제주 위도에서 위도 1도 ≈ 111km. 북쪽으로 meters만큼 옮긴 좌표 */
function north(meters: number) {
  return { latitude: origin.latitude + meters / 111_320, longitude: origin.longitude };
}

const treasures = [
  { treasureId: 'far', order: 2, coords: north(800) },
  { treasureId: 'near', order: 1, coords: north(120) },
];

describe('resolveNearestTreasure', () => {
  it('가장 가까운 보물을 고른다', () => {
    const nearest = resolveNearestTreasure(origin, treasures);
    expect(nearest?.treasure.treasureId).toBe('near');
    expect(nearest?.distanceMeters).toBeCloseTo(120, -1);
  });

  it('현재 위치를 모르면 null', () => {
    expect(resolveNearestTreasure(null, treasures)).toBeNull();
  });

  it('후보가 없으면 null — 보물을 다 찾은 뒤에도 안전하다', () => {
    expect(resolveNearestTreasure(origin, [])).toBeNull();
  });
});

describe('resolveSheetVisibility', () => {
  it('닫힌 상태에서는 500m 안에 들어와야 열린다', () => {
    expect(resolveSheetVisibility(600, false)).toBe(false);
    expect(resolveSheetVisibility(500, false)).toBe(true);
  });

  it('열린 상태는 1km까지 유지된다 — 경계에서 깜빡이지 않는다', () => {
    expect(resolveSheetVisibility(600, true)).toBe(true);
    expect(resolveSheetVisibility(1000, true)).toBe(true);
    expect(resolveSheetVisibility(1001, true)).toBe(false);
  });

  it('거리를 모르면 열지 않는다', () => {
    expect(resolveSheetVisibility(null, true)).toBe(false);
  });
});

describe('shouldLeaveCamera', () => {
  it('1km를 벗어나면 지도로 돌아간다', () => {
    expect(shouldLeaveCamera(1001)).toBe(true);
    expect(shouldLeaveCamera(1000)).toBe(false);
  });

  it('거리를 모르는 동안에는 카메라를 닫지 않는다', () => {
    expect(shouldLeaveCamera(null)).toBe(false);
  });
});
