import type { LocationPermissionStatus } from '@shared/lib/bridge';

/**
 * 이 권한 상태에서 들고 있던 좌표를 버려야 하는가.
 *
 * 권한을 허용했다가 설정에서 회수하면 앱이 denied/blocked를 다시 보낸다. 그때 스토어에 옛 좌표가
 * 남아 있으면 resolveAddressDisplay가 `coords !== null`을 먼저 보고(3번 규칙) 옛 주소를 "현재 위치"처럼
 * 계속 그린다 — 지금 그 자리에 있다는 근거가 없는데 사실처럼 보이는 값이다.
 *
 * 순서를 바꿔 denied/blocked를 앞으로 당기는 방법도 있지만, 그러면 **심사위원용 모드가 깨진다** —
 * 그쪽은 권한과 무관하게 고정 좌표를 넣고 3번 규칙에 얹혀 있다. 원인은 순서가 아니라 남아 있는 좌표다.
 */
export function shouldDiscardCoordsForPermission(status: LocationPermissionStatus): boolean {
  return status === 'denied' || status === 'blocked';
}
