'use client';

import { useEffect, useState } from 'react';
import { geocodeAddress } from '@entities/location';
import { useMapLocations } from '@entities/place';
import { JEJU_CENTER, JEJU_ISLAND_BOUNDS, type Coordinates } from '@shared/config/geo';

/**
 * 쿠폰 사용처의 좌표를 찾는다. 못 찾으면 null(마커를 그리지 않는다).
 *
 * completion API의 receivedCoupons는 locationId·주소·이미지만 주고 **좌표를 주지 않는다**.
 * 좌표를 얻는 길이 둘 있는데, 정확도 순으로 겹쳐 쓴다.
 *
 * 1) 서버 좌표 — `/map/contents`를 제주 본섬 전체 사각형(JEJU_ISLAND_BOUNDS)으로 한 번 조회해
 *    locationId가 같은 장소를 찾는다. 이 엔드포인트는 bounds가 필수라 "화면 밖 장소"를 찾으려면
 *    사각형을 섬 전체로 벌리는 수밖에 없다(`/map/locations/{id}`·`/map/search` 응답에는 위경도가
 *    아예 없다). isClustered=true는 좌표+id만 오는 가벼운 응답이고, 지도가 레벨 9에서 늘 하는
 *    조회와 같은 모양이다.
 * 2) 주소 지오코딩 — 서버 목록에 그 id가 없을 때(미션이 없는 장소라 지도 응답에 안 실리는 경우 등)
 *    남은 단서는 주소뿐이다. 카카오 Geocoder로 변환한다.
 *
 * 예전에는 2)만 썼는데, 주소가 비었거나 Geocoder가 못 읽는 주소면 마커가 아예 생기지 않았다.
 * 사용자가 보는 화면은 "가야 할 가게를 지도에서 찍어 주는 것"이라 마커가 없으면 화면의 의미가 없다.
 */
export function useCouponLocationCoords(locationId: number | null, address: string | null): Coordinates | null {
  const canQuery = locationId !== null;

  const { locations, isLoading } = useMapLocations({
    bounds: canQuery ? JEJU_ISLAND_BOUNDS : null,
    // 거리 계산 기준점일 뿐 결과 목록에는 영향이 없어 고정값을 쓴다 — 사용자 좌표를 넣으면
    // 좌표가 흔들릴 때마다 쿼리키가 바뀌어 같은 목록을 다시 받는다.
    center: JEJU_CENTER,
    isClustered: true,
    enabled: canQuery,
  });

  const serverCoords = canQuery ? (locations.find((location) => location.id === locationId)?.coords ?? null) : null;

  const [geocodedCoords, setGeocodedCoords] = useState<Coordinates | null>(null);
  // 서버 조회가 끝났는데도 그 id가 없을 때만 주소로 넘어간다. 조회 중에 먼저 지오코딩을 걸면
  // 덜 정확한 좌표로 지도를 옮겼다가 곧바로 다시 옮기게 된다.
  const needsGeocode = canQuery && !isLoading && serverCoords === null && address !== null;

  useEffect(() => {
    if (!needsGeocode || address === null) return;

    let cancelled = false;
    void geocodeAddress(address)
      .then((coords) => {
        if (!cancelled) setGeocodedCoords(coords);
      })
      .catch(() => {
        // 주소를 좌표로 못 바꾸면 마커 없이 시트만 남는다. 시트에 사용처 이름과 주소가 그대로 있어
        // 화면 전체를 오류로 덮을 만한 실패는 아니다.
      });

    return () => {
      cancelled = true;
    };
  }, [needsGeocode, address]);

  return serverCoords ?? geocodedCoords;
}
