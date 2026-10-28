export type Coordinates = { lat: number; lng: number };

// kakao.maps.LatLngBounds에 종속되지 않는 순수 도메인 타입 (widgets에서 변환해서 넘긴다)
export type Bounds = { sw: Coordinates; ne: Coordinates };

// 한라산 좌표 — 지도 초기 center의 공통 폴백 기준점 (06실시간마커최종.md §6 참고)
export const JEJU_CENTER: Coordinates = { lat: 33.361424638771474, lng: 126.52941927591584 };

/**
 * 제주 본섬을 감싸는 사각형.
 *
 * 두 곳이 같은 값을 봐야 해서 여기 둔다 — resolveDisplayLocation의 "제주 밖 판정"과,
 * bounds가 필수인 `/map/contents`로 **화면과 무관하게** 장소를 찾아야 하는 쪽
 * (쿠폰 사용처 좌표 조회, useCouponLocationCoords)이다.
 */
export const JEJU_ISLAND_BOUNDS: Bounds = {
  sw: { lat: 33.1, lng: 126.1 },
  ne: { lat: 33.6, lng: 127 },
};

// 좌표가 사각형 bounds 안(경계 포함)에 있는지. 이 앱의 카카오맵은 회전을 안 써서 위경도 범위 비교로 충분하다.
export function boundsContains(bounds: Bounds, coords: Coordinates): boolean {
  return coords.lat >= bounds.sw.lat && coords.lat <= bounds.ne.lat && coords.lng >= bounds.sw.lng && coords.lng <= bounds.ne.lng;
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const EARTH_RADIUS_METERS = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// 장소 목록(isClustered=false) 조회를 뷰포트 단위가 아니라 고정 타일 단위로 캐싱하기 위한 격자.
// JEJU_ISLAND_BOUNDS가 이 크기로 정확히 나눠지도록 맞춰져 있다(0.5÷0.05=10행, 0.9÷0.05=18열).
// entities/place(장소 마커)와 entities/guestbook(길바닥 방명록 마커) 둘 다 이 좌표계를 써서 같은
// 파라미터(=queryKey)를 만들게 하는 게 목적이다 — 그래야 TanStack Query가 같은 지역을 가리키는
// 두 훅의 요청을 하나의 캐시로 묶어 실제 네트워크 요청이 중복되지 않는다.
const TILE_LAT_SPAN = 0.05;
const TILE_LNG_SPAN = 0.05;

// 부동소수점 나눗셈 오차로 경계값이 한 칸 옆으로 밀리는 것을 막는 여유값.
const TILE_EPSILON = 1e-9;

export type TileId = { row: number; col: number };

function tileRowOf(lat: number): number {
  return Math.floor((lat - JEJU_ISLAND_BOUNDS.sw.lat) / TILE_LAT_SPAN + TILE_EPSILON);
}

function tileColOf(lng: number): number {
  return Math.floor((lng - JEJU_ISLAND_BOUNDS.sw.lng) / TILE_LNG_SPAN + TILE_EPSILON);
}

// 타일 (row, col)의 사각형 범위. 그리드 밖(음수 행/열 등)이어도 계산 자체는 유효한 사각형이 나오고,
// 그 자리엔 장소가 없을 뿐이라 별도 예외 처리는 하지 않는다.
export function tileBoundsOf({ row, col }: TileId): Bounds {
  return {
    sw: { lat: JEJU_ISLAND_BOUNDS.sw.lat + row * TILE_LAT_SPAN, lng: JEJU_ISLAND_BOUNDS.sw.lng + col * TILE_LNG_SPAN },
    ne: { lat: JEJU_ISLAND_BOUNDS.sw.lat + (row + 1) * TILE_LAT_SPAN, lng: JEJU_ISLAND_BOUNDS.sw.lng + (col + 1) * TILE_LNG_SPAN },
  };
}

// 이 타일로 나가는 요청의 center(userLatitude/userLongitude)로 쓸 고정 좌표 — 타일 중심.
export function tileCenterOf(tile: TileId): Coordinates {
  const bounds = tileBoundsOf(tile);
  return { lat: (bounds.sw.lat + bounds.ne.lat) / 2, lng: (bounds.sw.lng + bounds.ne.lng) / 2 };
}

// 좌표가 속한 타일과 그 8이웃(3x3) 목록. 뷰포트(최대 레벨5 기준 lat 0.02~0.03)가 타일(0.05)보다
// 작아서, 뷰포트 중심 좌표가 속한 타일을 3x3의 중앙으로 잡으면 뷰포트 전체가 항상 이 범위 안에 든다.
export function surroundingTileIds(center: Coordinates): TileId[] {
  const centerRow = tileRowOf(center.lat);
  const centerCol = tileColOf(center.lng);

  const tiles: TileId[] = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      tiles.push({ row: centerRow + rowOffset, col: centerCol + colOffset });
    }
  }
  return tiles;
}

export function centerOf(bounds: Bounds): Coordinates {
  return { lat: (bounds.sw.lat + bounds.ne.lat) / 2, lng: (bounds.sw.lng + bounds.ne.lng) / 2 };
}
