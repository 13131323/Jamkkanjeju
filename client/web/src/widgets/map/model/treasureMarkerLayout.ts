import { TREASURE_MARKER_BADGE_MAX } from '@packages/shared';
import type { Coordinates } from '@shared/config/geo';
import type { MapZoomTier } from './useMapZoomTier';
import type { TreasureMarkersState } from './useTreasureMarkersBridge';

/**
 * 보물 마커를 어떤 형태로 그릴지.
 *
 * - clustered: 장소 한 곳을 대표하는 마커 1개 + 개수 배지 (Penpot TreasureHunt_step1 "Group 113")
 * - individual: 보물마다 자기 좌표에 마커 1개 (지도 화면의 보물미션 아이콘 마커)
 */
export type TreasureMarkerMode = 'clustered' | 'individual';

/**
 * 줌 티어 → 마커 형태.
 *
 * 임계값을 새로 만들지 않는다 — useMapZoomTier의 levelToTier가 이미 쓰는 경계(level<=5 = detail)를
 * 그대로 재사용한다. 지도 화면(usePlaceMarkers)도 detail에서만 개별 장소 마커를 그리고
 * wideSplit/wide에서는 원마커로 묶으므로, 보물 마커도 같은 경계에서 갈린다.
 *
 * detail(1~5)      → 보물별 개별 마커
 * wideSplit(6~7)   → 장소 대표 마커 1개(개수 배지)
 * wide(8~9)        → 같음. 여기서 개별 마커로 흩뿌리면 보물 3개가 한 픽셀에 겹친다.
 */
export function resolveTreasureMarkerMode(tier: MapZoomTier): TreasureMarkerMode {
  return tier === 'detail' ? 'individual' : 'clustered';
}

export type TreasureCluster = {
  /** 대표 마커를 놓을 좌표 */
  coords: Coordinates;
  /** 이 마커가 대표하는 보물 수 */
  totalCount: number;
  /** 그중 아직 못 찾은 수 */
  remainingCount: number;
  /**
   * 원에 얹을 숫자. 남은 보물이 없으면 null이고, 호출부는 배지를 그리지 않는다.
   * prompt §9 "보물 아이콘을 감싸는 원에 있는 숫자는 3까지 보여짐" — 상한은 TREASURE_MARKER_BADGE_MAX.
   */
  badgeLabel: string | null;
  /** 전부 찾았는지. 열린 상자 에셋으로 바꾸는 조건 */
  allFound: boolean;
};

/** usePlaceGroups의 centroid와 같은 계산. 저 모듈은 'use client' 훅이라 순수 모듈에서 끌어오지 않고 여기 둔다 */
function centroid(points: Coordinates[]): Coordinates {
  const sum = points.reduce((acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * 축소 상태에서 그릴 대표 마커 1개를 계산한다. 보물이 없으면 null(그릴 게 없다).
 *
 * 좌표는 state.center를 우선한다 — 앱이 보내는 center가 곧 "미션 장소"의 좌표이고, 사용자가 보는
 * 장소 이름·반경 판정도 그 좌표 기준이다. 보물 좌표의 무게중심은 장소 안에서 살짝 치우칠 수 있어
 * 마커가 장소를 안 가리키는 것처럼 보인다. center가 없을 때만(앱이 안 보낸 경우) 무게중심으로 떨어진다.
 *
 * 배지 숫자는 "남은 보물 수"다. 보물이 항상 TREASURE_TARGET_COUNT(3)개씩 오므로 총 개수를 쓰면
 * 배지가 영원히 "3"으로 고정되어 진행 상황을 못 나타낸다. 남은 수로 두면 3→2→1로 줄고,
 * 디자인 목업의 배지가 "2"인 것(진행 중 화면)과도 맞는다.
 */
export function resolveTreasureCluster(state: TreasureMarkersState): TreasureCluster | null {
  const { treasures } = state;
  if (treasures.length === 0) return null;

  const remainingCount = treasures.filter((treasure) => !treasure.found).length;

  return {
    coords: state.center ?? centroid(treasures.map((treasure) => ({ lat: treasure.lat, lng: treasure.lng }))),
    totalCount: treasures.length,
    remainingCount,
    // 다 찾은 뒤에도 "0"을 띄우면 남은 게 있는 것처럼 읽힌다. 배지를 지우고 열린 상자로만 알린다
    // (디자인에도 배지 없는 변형이 있다 — Group 114).
    badgeLabel: remainingCount > 0 ? String(Math.min(remainingCount, TREASURE_MARKER_BADGE_MAX)) : null,
    // 일부만 찾은 상태는 "아직 남았다"이므로 닫힌 상자를 유지한다. 열린 상자는 전부 찾았을 때만.
    allFound: remainingCount === 0,
  };
}
