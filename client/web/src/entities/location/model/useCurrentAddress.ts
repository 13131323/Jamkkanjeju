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
//
// `sdkError`를 함께 돌려주는 이유: SDK가 끝내 로드되지 않으면 `enabled`가 영영 false라 쿼리가
// 시작조차 하지 않는다. 그러면 `isError`는 계속 false이고 호출부는 "아직 변환 중"과 "영영 변환할 수
// 없음"을 구별할 수 없다 — 그 구별이 상단 주소의 로딩/실패 갈래를 가른다(model/addressDisplay.ts).
export function useCurrentAddress(coords: Coordinates | null, enabled: boolean) {
  const { loaded: isSdkLoaded, error: sdkError } = useKakaoMapsSdk();
  const roundedKey = coords ? ([roundCoord(coords.lat), roundCoord(coords.lng)] as const) : null;

  const query = useQuery({
    queryKey: ['user-address', roundedKey],
    queryFn: () => fetchAddress(coords as Coordinates),
    enabled: enabled && coords !== null && isSdkLoaded,
    staleTime: ADDRESS_STALE_TIME_MS,
    // queryClient의 전역 기본값이 throwOnError: true라, 주소를 못 찾으면 그 오류가
    // Sentry.ErrorBoundary까지 올라가 **화면 전체**가 "오류가 발생했습니다."로 바뀐다.
    // 주소는 상단 라벨 하나라 못 찾으면 그 자리만 안내하면 되는 값이고, 그래야 호출부가
    // isError를 읽어 "찾을 수 없음"을 그릴 수 있다(useHomeData가 같은 이유로 끄고 있다).
    throwOnError: false,
  });

  return { ...query, sdkError };
}
