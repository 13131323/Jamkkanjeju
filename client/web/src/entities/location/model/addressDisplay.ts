import type { LocationPermissionStatus } from '@shared/lib/bridge';
import type { Coordinates } from '@shared/config/geo';
import { toAddressUnit } from './addressUnit';

/**
 * 상단 주소 표시의 **세 가지** 상태.
 *
 * 예전에는 둘로 접혀 있었다 — 주소 문자열이 있으면 주소, 아니면 "위치를 확인할 수 없어요".
 * 그런데 문자열이 없는 구간에는 **아직 모르는 것**(앱의 권한 응답 전, 첫 측위 전, 카카오맵 SDK
 * 로드 전, 변환 요청 중)과 **확정적으로 못 찾은 것**(권한 거부, 변환 실패)이 함께 들어 있었다.
 * 그래서 홈이 뜰 때마다 정상 경로에서도 실패 문구가 먼저 떴다가 주소로 바뀌었다 —
 * 사실이 아닌 데다, 문구 길이가 달라 옆 요소가 밀리는 원인이기도 했다(사용자 지적).
 *
 * 실패 문구는 **진짜 실패가 확정됐을 때만** 쓴다. 모르는 동안에는 중립적인 자리표시를 둔다.
 *
 * 이 파일은 **순수 함수만** 둔다. 훅(useAddressDisplay.ts)을 여기 함께 두면 카카오맵 SDK 로더를
 * 거쳐 `@shared/config/env`까지 끌고 오는데, env는 모듈 평가 시점에 검증에 실패하면 던진다
 * (web/src/app/providers.tsx의 배럴 회피 주석과 같은 이유).
 */
export type AddressDisplay = { state: 'loading' } | { state: 'unavailable' } | { state: 'resolved'; label: string; isStale: boolean };

export interface AddressDisplayInput {
  /** 좌표→주소 변환 결과. 아직 없으면 undefined */
  address: string | undefined;
  /**
   * 직전에 보여준 적 있는 주소(localStorage). 기다리는 동안 이것으로 받친다.
   *
   * 홈 WebView는 미션을 끝낼 때마다 새로 로드되는데, 그때마다 자리표시가 한 번 반짝이고 주소가
   * 들어오는 것이 거슬린다는 지적이 있었다. 직전 값은 **적어도 한 번은 사실이었던 값**이고
   * 주소는 몇 초 사이에 바뀌는 종류가 아니라(같은 동 안에 있다) 잠깐 받치기에 안전하다 —
   * features/app-bridge의 useStepCount가 걸음 수에 쓰는 것과 같은 방식이다.
   *
   * **확정 실패에는 쓰지 않는다.** 권한을 거부했거나 변환이 실패했으면 지금 그 자리에 있다는
   * 근거가 없다 — 옛 주소를 사실처럼 보여주면 "잘못된 정보"가 된다.
   */
  lastKnownAddress: string | undefined;
  /** 지금 쓰는 현재 좌표(심사위원용 모드의 고정 좌표 포함). 아직 모르면 null */
  coords: Coordinates | null;
  permissionStatus: LocationPermissionStatus;
  /** 좌표→주소 변환이 **확정적으로** 실패했는가(변환 오류 또는 카카오맵 SDK 로드 실패) */
  hasAddressError: boolean;
  /**
   * 앱 WebView 안인가.
   *
   * 밖(일반 브라우저)에서는 좌표를 밀어줄 상대가 없어 권한 상태가 영영 'undetermined'에 머문다.
   * 그 구간을 "아직 모름"으로 두면 자리표시가 영원히 반짝이므로, 그것도 확정된 실패로 본다.
   */
  isInAppWebView: boolean;
}

/**
 * 순서가 규칙의 전부다.
 *
 * 1. 주소가 나왔으면 그것이 답이다.
 * 2. 변환이 실패했으면 확정 실패다 — 좌표가 있어도 주소를 만들 수 없다.
 * 3. 좌표가 있으면 아직 변환을 기다리는 중이다(SDK 로드 포함).
 * 4. 좌표가 없는데 권한이 거부/차단이면 좌표가 올 길이 없다 — 확정 실패다.
 *    심사위원용 모드는 권한과 무관하게 고정 좌표를 넣으므로 3에서 이미 걸러진다.
 * 5. 앱 밖이면 밀어줄 상대가 없다 — 확정 실패다.
 * 6. 남은 것은 앱의 응답을 기다리는 정상 구간이다.
 *
 * 기다리는 구간(3·6)에서만 직전 주소로 받친다. 확정 실패(2·4·5)는 받치지 않는다 —
 * 그 자리에 있다는 근거가 없는데 옛 주소를 사실처럼 보여주는 것이기 때문이다.
 */
export function resolveAddressDisplay({ address, lastKnownAddress, coords, permissionStatus, hasAddressError, isInAppWebView }: AddressDisplayInput): AddressDisplay {
  const waiting: AddressDisplay = lastKnownAddress ? { state: 'resolved', label: toAddressUnit(lastKnownAddress), isStale: true } : { state: 'loading' };

  if (address) return { state: 'resolved', label: toAddressUnit(address), isStale: false };
  if (hasAddressError) return { state: 'unavailable' };
  if (coords !== null) return waiting;
  if (permissionStatus === 'denied' || permissionStatus === 'blocked') return { state: 'unavailable' };
  if (!isInAppWebView) return { state: 'unavailable' };
  return waiting;
}
