import type { Coordinates } from '@shared/config/geo';

/**
 * 카카오맵 Geocoder로 주소→좌표 변환. fetchAddress(좌표→주소)의 반대 방향이다.
 *
 * 쿠폰 사용처처럼 **좌표를 주지 않는 API**(completion의 receivedCoupons는 locationId·주소·이미지만
 * 준다)에서 지도를 그 장소로 옮겨야 할 때 쓴다. 주소 문자열이 유일한 위치 단서라 SDK에 맡긴다.
 *
 * 실패(주소를 못 찾음 ZERO_RESULT 포함)는 reject다 — 호출부는 지도를 옮기지 않고 그대로 둔다.
 */
export function geocodeAddress(address: string): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    const geocoder = new window.kakao.maps.services.Geocoder();

    geocoder.addressSearch(address, (result, status) => {
      if (status !== 'OK' || !result[0]) {
        reject(new Error('주소로 좌표를 찾지 못했습니다'));
        return;
      }

      // SDK는 x(경도)·y(위도)를 문자열로 준다. 좌표가 아닌 값이 오면 NaN이 지도를 엉뚱한 곳으로
      // 보내므로(kakao LatLng는 NaN을 그대로 받는다) 여기서 막는다.
      const lng = Number(result[0].x);
      const lat = Number(result[0].y);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        reject(new Error('주소로 좌표를 찾지 못했습니다'));
        return;
      }

      resolve({ lat, lng });
    });
  });
}
