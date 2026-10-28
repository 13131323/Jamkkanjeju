import * as Network from 'expo-network';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { applyNetworkReading, INITIAL_NETWORK_GATE, type NetworkGate, type NetworkReading, type NetworkStatus, offlineGraceRemaining, readNetworkState } from '@/utils/networkStatus';

export type { NetworkStatus };

/**
 * 기기의 네트워크 상태. **판정 규칙은 전부 utils/networkStatus.ts에 있다.**
 *
 * 여기는 원시 이벤트를 모으고(`addNetworkStateListener`), 유예 타이머를 잡고, 포그라운드 복귀
 * 시점에 한 번 다시 읽는 일만 한다. "이 값으로 화면을 바꿔도 되는가"는 그쪽 순수 함수가 정한다 —
 * 왜 원시 값을 그대로 믿으면 안 되는지도 그 파일 주석에 있다.
 */
export function useNetworkStatus() {
  const [gate, setGate] = useState<NetworkGate>(INITIAL_NETWORK_GATE);

  const observe = useCallback((reading: NetworkReading) => {
    setGate((previous) => applyNetworkReading(previous, reading, Date.now()));
  }, []);

  const refresh = useCallback(async () => {
    try {
      observe(readNetworkState(await Network.getNetworkStateAsync()));
    } catch {
      // 상태를 읽지 못한 것은 그 자체로 끊김의 신호다. 다만 다른 경로와 똑같이 유예를 거친다.
      observe('offline');
    }
  }, [observe]);

  useEffect(() => {
    // refresh updates state only after the native network-state Promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    const subscription = Network.addNetworkStateListener((state) => observe(readNetworkState(state)));

    return () => subscription.remove();
  }, [refresh, observe]);

  /**
   * 포그라운드로 돌아올 때 한 번 다시 읽는다.
   *
   * 리스너는 **상태가 바뀔 때만** 불린다. 앱이 내려가 있는 동안 안드로이드가 프로세스를 얼려
   * 두면 그 사이의 변화가 뭉개져 도착하고, 복귀 시점의 마지막 값이 실제와 어긋난 채로 남을 수
   * 있다. 그러면 아무 이벤트도 오지 않아 오류 화면이 계속 떠 있게 된다.
   * 복귀는 그 어긋남이 가장 잘 생기는 순간이라 여기서 현재 값을 직접 확인한다.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => subscription.remove();
  }, [refresh]);

  /**
   * 오프라인 후보가 유예 안에 회복되지 않으면 그 시점에 확정한다.
   *
   * 의존성을 gate 객체가 아니라 필드로 푼 이유: `applyNetworkReading`은 값이 같아도 새 객체를
   * 돌려주므로, 객체를 그대로 걸면 이벤트가 올 때마다 타이머를 버리고 다시 잡는다. 확정 시각은
   * `offlineSince`에 고정돼 있어 다시 잡아도 결과는 같지만, 잡는 일 자체가 불필요하다.
   */
  const { status, reading, offlineSince } = gate;
  useEffect(() => {
    const remaining = offlineGraceRemaining({ status, reading, offlineSince }, Date.now());
    if (remaining === null) return;

    const timer = setTimeout(() => {
      // 마지막 판정을 그대로 다시 적용한다 — 그 사이 온라인이 왔다면 offlineSince가 이미
      // 지워져 있어 이 setState는 상태를 바꾸지 않는다.
      setGate((previous) => applyNetworkReading(previous, previous.reading, Date.now()));
    }, remaining);

    return () => clearTimeout(timer);
  }, [status, reading, offlineSince]);

  return { status, refresh };
}
