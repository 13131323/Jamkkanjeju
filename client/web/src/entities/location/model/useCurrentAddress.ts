'use client';

import { useQuery } from '@tanstack/react-query';
import type { Coordinates } from '@shared/config/geo';
import { useKakaoMapsSdk } from '@shared/lib/kakaoMaps/loadKakaoMapsSdk';
import { fetchAddress } from '../api/fetchAddress';

const ADDRESS_STALE_TIME_MS = 5 * 60 * 1000;

// 좌표를 소수점 4자리(약 11m 단위)로 반올림해 쿼리키를 안정화 — GPS가 미세하게 흔들려도 같은 주소 캐시를 재사용
function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// enabled가 true일 때만(예: 사용자 위치 마커를 탭했을 때) 좌표→주소 변환을 호출한다.
// fetchAddress는 카카오맵 SDK(Geocoder)에 의존하는데, 지도 화면과 달리 이 훅을 쓰는 화면(홈 등)은
// 지도를 그리지 않아 SDK를 따로 로드하지 않는다 — 그래서 여기서 직접 로드를 보장한다.
// (스크립트 태그 삽입은 useKakaoMapsSdk 내부에서 모듈 단위로 한 번만 일어나므로 다른 화면과 중복 로드되지 않는다.)
export function useCurrentAddress(coords: Coordinates | null, enabled: boolean) {
  const { loaded: isSdkLoaded } = useKakaoMapsSdk();
  const roundedKey = coords ? ([roundCoord(coords.lat), roundCoord(coords.lng)] as const) : null;

  return useQuery({
    queryKey: ['user-address', roundedKey],
    queryFn: () => fetchAddress(coords as Coordinates),
    enabled: enabled && coords !== null && isSdkLoaded,
    staleTime: ADDRESS_STALE_TIME_MS,
  });
}
