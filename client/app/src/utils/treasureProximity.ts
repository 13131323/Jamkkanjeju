import { TREASURE_ENTER_RADIUS_METERS, TREASURE_KEEP_RADIUS_METERS } from '@packages/shared';
import { haversineDistanceMeters, type Coords } from './geo';

/**
 * 현재 위치와 보물 좌표의 거리로 step0/step2의 상태를 판정하는 순수 함수 모음.
 * prompt §9의 반경 규칙을 한 곳에 모아 두고, geo.ts처럼 부수효과 없이 유지한다.
 */

/**
 * 반경 판정에 필요한 최소 형태.
 *
 * 좌표만 요구한다 — 보물 식별자(서버의 treasureIndex)나 라벨은 이 계산에 쓰이지 않고, 제약을 좁혀
 * 두면 호출부 타입이 바뀔 때마다 여기까지 따라 고쳐야 했다. 실제 보물 객체는 제네릭 T로 그대로 돌려준다.
 */
export interface TreasureLike {
  coords: Coords;
}

export interface NearestTreasure<T extends TreasureLike> {
  treasure: T;
  distanceMeters: number;
}

/** 가장 가까운 보물과 그 거리. 후보가 없으면 null */
export function resolveNearestTreasure<T extends TreasureLike>(current: Coords | null, treasures: readonly T[]): NearestTreasure<T> | null {
  if (!current || treasures.length === 0) return null;

  let nearest: NearestTreasure<T> | null = null;
  for (const treasure of treasures) {
    const distanceMeters = haversineDistanceMeters(current, treasure.coords);
    if (nearest === null || distanceMeters < nearest.distanceMeters) {
      nearest = { treasure, distanceMeters };
    }
  }
  return nearest;
}

/**
 * step1 시트를 띄울지. 진입은 500m, 유지는 1km로 다르게 잡는다.
 *
 * prompt §9 "반경 500m 안에 들어오면 step1의 모달 뜸 / 반경 1km까진 모달 open 유지".
 * 두 값이 같으면 경계에서 GPS가 흔들릴 때마다 시트가 깜빡인다 —
 * geo.ts의 가시성 히스테리시스와 같은 이유의 같은 처방이다.
 */
export function resolveSheetVisibility(distanceMeters: number | null, wasVisible: boolean): boolean {
  if (distanceMeters === null) return false;
  return wasVisible ? distanceMeters <= TREASURE_KEEP_RADIUS_METERS : distanceMeters <= TREASURE_ENTER_RADIUS_METERS;
}

/**
 * step2(카메라)에서 지도로 되돌려야 하는지.
 * prompt §9 "보물좌표 기준 1km를 벗어나면 step1 페이지로 이동"
 *
 * 거리를 아직 모르는 동안(null)은 되돌리지 않는다 — GPS fix를 기다리는 사이에
 * 카메라를 닫아버리면 실내에서 화면을 확인할 수 없다.
 */
export function shouldLeaveCamera(distanceMeters: number | null): boolean {
  if (distanceMeters === null) return false;
  return distanceMeters > TREASURE_KEEP_RADIUS_METERS;
}
