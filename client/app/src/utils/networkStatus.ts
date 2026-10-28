/**
 * "지금 화면을 오프라인으로 갈아 끼워야 하는가"를 정하는 규칙. **부수효과가 없다.**
 *
 * 훅(hooks/useNetworkStatus.ts)에서 떼어 낸 이유는 이 판정에 실제 결함이 있었고 테스트로
 * 고정해야 하기 때문이다(services/authHeader.ts를 client.ts에서 뗀 것과 같은 이유).
 *
 * ## 왜 원시 판정을 그대로 쓰면 안 되는가
 *
 * expo-network의 Android 구현은 `ConnectivityManager.registerDefaultNetworkCallback`으로
 * `onAvailable` / `onLost` / `onCapabilitiesChanged`를 받아 그때마다 상태를 새로 읽어 보낸다
 * (node_modules/expo-network/android/.../NetworkModule.kt). 그리고 그 `isInternetReachable`은
 * **`NET_CAPABILITY_VALIDATED`와 `NET_CAPABILITY_NOT_SUSPENDED`가 둘 다 붙어 있을 때만** true다
 * (NetworkUtils.kt의 `isInternetReachable`).
 *
 * 그런데 이 두 capability는 **연결이 멀쩡해도 잠깐씩 떨어진다.**
 *
 * - 화면을 껐다 켜면 Wi-Fi가 재접속하고, 안드로이드는 그 네트워크의 인터넷 도달성을 다시
 *   검사한다. 검사가 끝나기 전까지 VALIDATED가 없다 → `isConnected: true`인데
 *   `isInternetReachable: false`인 이벤트가 먼저 온다.
 * - 셀룰러는 통화·핸드오버 중 SUSPENDED가 되어 NOT_SUSPENDED가 빠진다.
 * - Wi-Fi만 쓰는 기기가 절전으로 Wi-Fi를 내리면 `onLost`가 대체 네트워크 없이 발생해
 *   `isConnected: false`가 그대로 날아온다. 복귀 뒤 재접속하면 1~2초 뒤 다시 true가 된다.
 *
 * 즉 **앱을 백그라운드로 보냈다 다시 여는 구간이 이 오판이 가장 잘 나는 구간이다.** 이 순간의
 * 값을 그대로 믿고 화면을 바꾸면, 연결은 멀쩡한데 네트워크 오류 화면이 뜬다.
 *
 * ## 그래서 어떻게 하는가
 *
 * **온라인은 즉시 반영하고, 오프라인은 유예를 두고 반영한다.** 늦게 바꾸는 쪽으로만 기울이므로
 * 진짜 오프라인도 유예 뒤에는 반드시 알려진다 — 조용히 삼키지 않는다.
 */

/** 화면이 보는 상태. 'checking'은 아직 판단을 내리지 않은 구간(스플래시)이다 */
export type NetworkStatus = 'checking' | 'online' | 'offline';

/**
 * 원시 이벤트 하나를 읽은 결과.
 *
 * 'unknown'이 따로 있는 것이 요점이다 — "연결은 있는데 도달성이 아직 확인되지 않았다"를
 * 'offline'과 한 덩어리로 묶는 것이 위 주석의 오판 그 자체였다.
 */
export type NetworkReading = 'online' | 'offline' | 'unknown';

/** expo-network의 `NetworkState` 중 이 판정이 쓰는 부분만. 테스트가 expo를 부르지 않도록 좁혔다 */
export interface NetworkStateSnapshot {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}

/**
 * 오프라인 후보를 실제 오프라인으로 확정하기까지 기다리는 시간(ms).
 *
 * 근거: expo-network 자신도 `onAvailable`·`onCapabilitiesChanged` 뒤 상태를 다시 읽기까지
 * 250ms를 기다린다(NetworkModule.kt의 `DELAY_MS`) — 즉 "방금 온 값은 아직 안정되지 않았다"는
 * 것이 모듈 수준에서 이미 전제다. 여기서 기다려야 하는 것은 그보다 긴 안드로이드의 재검증
 * (VALIDATED 재부여)과 Wi-Fi 재접속이고, 이는 보통 1~2초 안에 끝난다. 3초는 그 위에 여유를
 * 얹은 값이다.
 *
 * 더 길게 잡지 않는 이유: 진짜로 끊긴 사용자에게는 이 시간이 그대로 "아무 반응 없는 화면"이다.
 * 더 짧게 잡지 않는 이유: 재검증이 끝나기 전에 화면을 갈아 끼우면 고치려는 증상이 그대로 남는다.
 */
export const OFFLINE_GRACE_MS = 3000;

/**
 * 이벤트 하나를 셋 중 하나로 읽는다.
 *
 * `isConnected === false`만 "확실한 끊김"으로 본다. 연결이 있는데 도달성만 false인 경우는
 * 판단을 미룬다('unknown') — 다만 미루기만 할 뿐 유예가 지나면 오프라인으로 확정되므로,
 * 공유기의 WAN이 죽어 있는 것 같은 **진짜** 도달 불가도 결국 사용자에게 알려진다.
 */
export function readNetworkState(state: NetworkStateSnapshot): NetworkReading {
  if (state.isConnected === false) return 'offline';
  // null/undefined는 기기가 아직 답을 못 준 것이다. 끊김으로 접지 않는다.
  if (state.isConnected !== true) return 'unknown';

  return state.isInternetReachable === false ? 'unknown' : 'online';
}

export interface NetworkGate {
  status: NetworkStatus;
  /**
   * 마지막으로 읽은 원시 판정.
   *
   * 유예 타이머가 끝났을 때 "그때 그 판정이 아직도 유효한가"를 다시 적용하려고 들고 있다.
   * 이 값을 들고 있지 않으면 타이머가 무엇을 확정해야 하는지 알 수 없다.
   */
  reading: NetworkReading;
  /** 오프라인 후보가 **처음** 관측된 시각(ms). 후보가 아니면 null */
  offlineSince: number | null;
}

export const INITIAL_NETWORK_GATE: NetworkGate = { status: 'checking', reading: 'unknown', offlineSince: null };

/**
 * 원시 판정 하나를 게이트에 적용한다.
 *
 * - 온라인은 **즉시** 반영한다. 늦출 이유가 없고, 회복이 빨라야 사용자가 원래 화면으로 돌아온다.
 * - 오프라인 후보(offline·unknown)는 `OFFLINE_GRACE_MS`가 지나야 확정한다.
 *
 * 유예 시작 시각을 새 이벤트마다 갱신하지 않는 것이 중요하다. 재개 직후에는 이벤트가 여러 번
 * 흔들리며 오는데, 올 때마다 시각을 미루면 유예가 무한정 연장되어 **진짜 오프라인을 영영 알리지
 * 못한다.** 그래서 `offlineSince`는 후보 구간이 시작될 때 한 번만 찍고, 온라인이 오면 지운다.
 */
export function applyNetworkReading(gate: NetworkGate, reading: NetworkReading, now: number): NetworkGate {
  if (reading === 'online') {
    return { status: 'online', reading, offlineSince: null };
  }

  const offlineSince = gate.offlineSince ?? now;

  // 이미 오프라인을 알린 뒤라면 유예는 끝난 이야기다. 회복(online)만이 여기서 빠져나간다.
  if (gate.status === 'offline') {
    return { status: 'offline', reading, offlineSince };
  }

  /**
   * 앱 시작 직후의 **확실한** 끊김은 기다리지 않는다.
   *
   * 유예는 "이미 쓰고 있던 화면을 지키기 위한" 장치인데 이 구간에는 지킬 화면이 아직 없다
   * (스플래시만 떠 있다). 여기서 기다리면 비행기 모드로 앱을 켠 사용자에게 스플래시만
   * 3초 더 보여 주는 셈이다. 반대로 'unknown'은 이 구간에서도 기다린다 — 부팅 직후는
   * Wi-Fi 검증이 아직 안 끝났을 때가 많아서, 곧 온라인이 될 값으로 오류 화면을 띄우게 된다.
   */
  const certainAtBoot = gate.status === 'checking' && reading === 'offline';

  if (certainAtBoot || now - offlineSince >= OFFLINE_GRACE_MS) {
    return { status: 'offline', reading, offlineSince };
  }

  return { status: gate.status, reading, offlineSince };
}

/**
 * 유예가 끝나기까지 남은 시간(ms). 기다릴 것이 없으면 null.
 *
 * 훅은 이 값으로 타이머를 잡고, 타이머가 끝나면 마지막 판정(`gate.reading`)을 다시 적용한다.
 * "남은 시간"을 돌려주는 형태인 이유는 후보 구간 중에 이벤트가 여러 번 오더라도 확정 시각이
 * `offlineSince + OFFLINE_GRACE_MS` 한 점으로 고정되기 때문이다.
 */
export function offlineGraceRemaining(gate: NetworkGate, now: number): number | null {
  if (gate.status === 'offline' || gate.offlineSince === null) return null;

  return Math.max(0, gate.offlineSince + OFFLINE_GRACE_MS - now);
}
