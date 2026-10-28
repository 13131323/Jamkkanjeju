import * as Location from 'expo-location';
import type { LocationPermissionStatus } from '@/bridge';

// expo-location의 LocationPermissionResponse → 브릿지 계약의 5가지 status로 매핑.
// 순수 함수로 분리해 RN 의존성 없이 vitest로 검증한다.
export function mapPermissionResponseToStatus(response: Location.LocationPermissionResponse): LocationPermissionStatus {
  if (response.granted) {
    // Android는 coarse 프로바이더일 때만 근사 위치, iOS는 reduced accuracy일 때만 근사 위치.
    // 둘 다 상세 정보가 없는 플랫폼(웹 등)에서는 precise로 취급한다.
    if (response.android?.accuracy === 'coarse') return 'granted-approximate';
    if (response.ios?.accuracy === 'reduced') return 'granted-approximate';
    return 'granted-precise';
  }

  if (response.status === 'undetermined') return 'undetermined';

  // 거부됐지만 재요청 가능하면 denied, OS가 재요청 자체를 막으면(설정 앱 이동 필요) blocked.
  return response.canAskAgain ? 'denied' : 'blocked';
}
