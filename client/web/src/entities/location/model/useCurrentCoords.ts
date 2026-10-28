import { useMemo } from 'react';
import type { LocationPermissionStatus } from '@shared/lib/bridge';
import type { Coordinates } from '@shared/config/geo';
import { useForcedJejuCoords } from './forcedLocation';
import { useLocationStore } from './store';

// resolveDisplayLocation과 달리 "지도(제주 전용)에 뭘 그릴지"가 아니라 "사용자의 실제 현재 위치가 어디인지"를
// 묻는 곳(주소 표시 등)에서 쓴다. 제주 밖이어도 좌표를 null로 버리지 않는다 — 주소는 제주 밖에서도 보여줘야 한다.
export function resolveCurrentCoords(
  permissionStatus: LocationPermissionStatus,
  liveCoords: Coordinates | null,
  manualCoords: Coordinates | null,
  /** 제주 고정 좌표. 들어오면 실제 좌표보다 우선한다 — 상단 주소도 제주로 보여야 한다 */
  forcedCoords: Coordinates | null = null,
): Coordinates | null {
  // 여기서는 제주 안/밖을 따지지 않아 실제 좌표가 항상 이긴다. 그래서 고정 좌표를 뒤에 두면
  // 모드를 켜도 주소가 실제 위치로 남는다 — 반드시 먼저 확인해야 한다.
  if (forcedCoords) return forcedCoords;

  const isLivePermissionGranted = permissionStatus === 'granted-precise' || permissionStatus === 'granted-approximate';
  if (isLivePermissionGranted && liveCoords !== null) return liveCoords;
  return manualCoords;
}

export function useCurrentCoords(): Coordinates | null {
  const permissionStatus = useLocationStore((s) => s.permissionStatus);
  const coords = useLocationStore((s) => s.coords);
  const manualCoords = useLocationStore((s) => s.manualCoords);
  // useDisplayLocation과 같은 이유로 훅으로 구독한다(심사위원용 모드는 실행 중에 바뀐다)
  const forcedCoords = useForcedJejuCoords();

  return useMemo(() => resolveCurrentCoords(permissionStatus, coords, manualCoords, forcedCoords), [permissionStatus, coords, manualCoords, forcedCoords]);
}
