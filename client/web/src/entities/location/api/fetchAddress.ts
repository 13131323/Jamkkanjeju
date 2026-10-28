import type { Coordinates } from '@shared/config/geo';

/**
 * 카카오맵 Geocoder로 좌표→주소 변환. **지번주소 우선, 없으면 도로명주소로 폴백.**
 *
 * 도로명을 우선하던 때는 화면에 쓰는 행정 단위가 한 단계 굵어졌다. 표시 직전에 toAddressUnit이
 * 읍/면/동까지만 남기는데(addressUnit.ts), 도로명 주소에는 동이 아예 없어서
 * "제주특별자치도 제주시 문연로 6"이 "제주특별자치도 제주시"로 잘렸다 — 지번을 쓰면
 * "제주특별자치도 제주시 이도이동"이 되어 의도한 단위로 떨어진다.
 *
 * 지번이 비는 좌표(신규 개발지 등)가 있어 도로명을 폴백으로 남긴다. 그때는 예전처럼 시·군·구까지만 남는다.
 */
export function fetchAddress(coords: Coordinates): Promise<string> {
  return new Promise((resolve, reject) => {
    const geocoder = new window.kakao.maps.services.Geocoder();

    geocoder.coord2Address(coords.lng, coords.lat, (result, status) => {
      if (status !== 'OK' || !result[0]) {
        reject(new Error('주소를 찾을 수 없습니다'));
        return;
      }

      const [item] = result;
      const address = item.address?.address_name ?? item.road_address?.address_name;

      if (!address) {
        reject(new Error('주소를 찾을 수 없습니다'));
        return;
      }

      resolve(address);
    });
  });
}
