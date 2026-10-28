import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { MISSION_LOCATION_ALERT, resolveMissionLocationGate } from '@/hooks/missionLocationGate';

/**
 * 미션 공통 위치 권한 훅.
 *
 * 미션 종류와 무관하게 미션에 들어설 때 한 번 요청하고, 허용하지 않으면 시작할 수 없다.
 * (예전에는 보물찾기만 요구했는데, 문화 미션도 진행도 저장에 좌표가 필요해 전부로 넓혔다)
 *
 * 어디로 이동할지는 미션마다 달라 호출부가 정한다 — 이 훅은 허용 여부만 돌려준다.
 *
 * 인트로 화면에만 있다가 여기로 옮겼다. 홈·마이페이지의 "이어서 진행"은 인트로를 거치지 않고
 * 미션 진행 화면으로 곧장 들어오는데, 그 경로에도 같은 권한이 필요하기 때문이다 —
 * 협동 미션은 방 상태 조회가 좌표를 필수로 받아서 권한이 없으면 폴링이 통째로 막힌다.
 */
export function useMissionLocationPermission(enabled: boolean) {
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  // 진입 시 1회 요청. prompt §5 "허용되지 않은 경우 이 페이지 접근 시 허용 요청(허용해야만 사용 가능)"
  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (isMounted) setPermissionStatus(status);
    })();
    return () => {
      isMounted = false;
    };
  }, [enabled]);

  const ensureGranted = useCallback(async (): Promise<boolean> => {
    // 최초 요청을 거부했어도 재요청이 가능한 상태면 CTA에서 한 번 더 기회를 준다.
    const current = permissionStatus === Location.PermissionStatus.GRANTED ? { status: permissionStatus, canAskAgain: true } : await Location.requestForegroundPermissionsAsync();

    setPermissionStatus(current.status);

    const gate = resolveMissionLocationGate(current.status, current.canAskAgain);
    if (gate === 'granted') return true;

    Alert.alert(
      MISSION_LOCATION_ALERT.title,
      MISSION_LOCATION_ALERT.message,
      gate === 'ask-again'
        ? [{ text: '확인' }]
        : [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => void Linking.openSettings() },
          ],
    );
    return false;
  }, [permissionStatus]);

  return ensureGranted;
}
