import type { Coordinates } from '@shared/config/geo';

// 카카오맵 Geocoder로 좌표→주소 변환. 도로명주소 우선, 없으면 지번주소로 폴백.
export function fetchAddress(coords: Coordinates): Promise<string> {
  return new Promise((resolve, reject) => {
    const geocoder = new window.kakao.maps.services.Geocoder();

    geocoder.coord2Address(coords.lng, coords.lat, (result, status) => {
      if (status !== 'OK' || !result[0]) {
        reject(new Error('주소를 찾을 수 없습니다'));
        return;
      }

      const [item] = result;
      const address = item.road_address?.address_name ?? item.address?.address_name;

      if (!address) {
        reject(new Error('주소를 찾을 수 없습니다'));
        return;
      }

      resolve(address);
    });
  });
}
