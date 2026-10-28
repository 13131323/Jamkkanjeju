import { useMemo } from 'react';
import type { LocationPermissionStatus } from '@shared/lib/bridge';
import { JEJU_ISLAND_BOUNDS, type Coordinates } from '@shared/config/geo';
import { useForcedJejuCoords } from './forcedLocation';
import { useIsJudgeModeHydrated } from './judgeMode';
import { useLocationStore } from './store';

// 제주 본섬을 감싸는 사각형 영역 밖이면 제주 밖으로 간주.
// 값은 shared/config/geo의 JEJU_ISLAND_BOUNDS 하나만 쓴다 — `/map/contents`로 섬 전체를 훑는 쪽과
// 같은 사각형이어야 "제주 안"의 의미가 갈리지 않는다.
const JEJU_BOUNDS = {
  minLat: JEJU_ISLAND_BOUNDS.sw.lat,
  maxLat: JEJU_ISLAND_BOUNDS.ne.lat,
  minLng: JEJU_ISLAND_BOUNDS.sw.lng,
  maxLng: JEJU_ISLAND_BOUNDS.ne.lng,
};

export type DisplayLocation = {
  // 지도에 표시할 사용자 위치 좌표. null이면 마커를 표시하지 않는다.
  coords: Coordinates | null;
  // 지도 최초 렌더링 시 사용할 줌 레벨(그 이후 사용자가 자유롭게 조작 가능)
  initialLevel: number;
};

// 권한 상태·좌표·수동 지정 좌표를 종합해 "지도에 무엇을 보여줄지" 하나로 결정한다 (15지도phase2필요.md).
// 1) granted-precise/approximate + 제주 안(JEJU_BOUNDS 사각형 내부) → 실시간 좌표 표시, level 5
// 2) 그 외 + 수동 지정 좌표 있음 → 수동 좌표 표시, level 5
// 3) 그 외 + 수동 지정 좌표도 없음 → 마커 없음, JEJU_CENTER 중심, level 9
export function isOutsideJeju(coords: Coordinates): boolean {
  return coords.lat < JEJU_BOUNDS.minLat || coords.lat > JEJU_BOUNDS.maxLat || coords.lng < JEJU_BOUNDS.minLng || coords.lng > JEJU_BOUNDS.maxLng;
}

export function resolveDisplayLocation(
  permissionStatus: LocationPermissionStatus,
  liveCoords: Coordinates | null,
  manualCoords: Coordinates | null,
  /**
   * 제주 고정 좌표. 모드가 켜져 있을 때만 값이 들어오고, 들어오면 실제 좌표보다 우선한다.
   * 인자로 받는 이유: 이 함수는 순수 함수로 두고 env 판단은 호출부(훅)가 한다.
   */
  forcedCoords: Coordinates | null = null,
): DisplayLocation {
  // 제주 고정 모드가 켜져 있으면 실제 좌표보다 먼저 쓴다 — "제주에 있는 것으로 본다"가 이 모드의 정의다.
  // 뒤에 두면 제주 안에 있을 때 실제 좌표가 이겨 모드가 켜져도 화면이 달라지지 않는다.
  if (forcedCoords) {
    return { coords: forcedCoords, initialLevel: 5 };
  }

  const isLivePermissionGranted = permissionStatus === 'granted-precise' || permissionStatus === 'granted-approximate';
  const usableLiveCoords = isLivePermissionGranted && liveCoords !== null && !isOutsideJeju(liveCoords) ? liveCoords : null;

  if (usableLiveCoords) {
    return { coords: usableLiveCoords, initialLevel: 5 };
  }
  if (manualCoords) {
    return { coords: manualCoords, initialLevel: 5 };
  }
  return { coords: null, initialLevel: 9 };
}

export function useDisplayLocation(): DisplayLocation {
  const permissionStatus = useLocationStore((s) => s.permissionStatus);
  const coords = useLocationStore((s) => s.coords);
  const manualCoords = useLocationStore((s) => s.manualCoords);
  // 심사위원용 모드는 실행 중에 켜고 꺼지므로 훅으로 구독한다 — 함수로 한 번 읽으면 토글해도 화면이 그대로다
  const forcedCoords = useForcedJejuCoords();
  const isJudgeModeHydrated = useIsJudgeModeHydrated();

  /**
   * **모드 되살리기가 끝나기 전에는 위치를 정하지 않는다.**
   *
   * 스토어 초기값은 항상 꺼짐이고(judgeMode.ts — SSR에는 localStorage가 없다) 저장값은 마운트 뒤
   * effect에서 복원된다. 그 한 틱 동안 `forcedCoords`가 null이라 **실좌표로 마커를 찍었다가**,
   * 복원 직후 제주시청으로 옮겨 간다 — 앱을 켤 때마다 마커가 한 번 튀어 보이던 것이 이것이다
   * (기기에서 확인). 계정에 묶인 조회를 같은 이유로 기다리게 한 것과 같은 규칙이다
   * (useHomeData·useAddressDisplay).
   *
   * 기다리는 동안은 `coords: null`이라 마커를 아예 그리지 않는다 — 틀린 자리에 찍었다 옮기는 것보다
   * 한 틱 늦게 맞는 자리에 한 번 찍는 편이 낫다. 모드가 꺼진 사용자에게도 결과는 같다(한 틱 뒤 동일).
   */
  return useMemo(
    () => (isJudgeModeHydrated ? resolveDisplayLocation(permissionStatus, coords, manualCoords, forcedCoords) : { coords: null, initialLevel: 9 }),
    [isJudgeModeHydrated, permissionStatus, coords, manualCoords, forcedCoords],
  );
}
