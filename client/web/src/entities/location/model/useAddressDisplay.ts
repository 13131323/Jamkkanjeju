'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { isAppWebView } from '@shared/lib/bridge/utils';
import { resolveAddressDisplay, type AddressDisplay } from './addressDisplay';
import { useCurrentAddress } from './useCurrentAddress';
import { useCurrentCoords } from './useCurrentCoords';
import { useIsJudgeModeHydrated } from './judgeMode';
import { useLocationStore } from './store';
// 캐시가 별도 모듈인 이유: 심사위원용 모드 해제 시 judgeMode가 이 값을 비워야 하는데,
// 이 파일을 import하면 useCurrentCoords → forcedLocation → judgeMode로 순환 참조가 된다.
import { getLastKnownAddress, getLastKnownAddressServerSnapshot, subscribeLastKnownAddress, writeLastKnownAddress } from './lastKnownAddress';

/** 판정은 실행 중에 바뀌지 않는다 — 구독할 것이 없다(features/app-bridge의 useAppCompatibility와 같은 방식) */
function subscribeNever(): () => void {
  return () => {};
}

/**
 * 서버 스냅샷을 `true`로 두는 이유.
 *
 * 서버에는 window가 없어 판정할 수 없는데, 여기서 `false`를 주면 hydration 직후 한 프레임 동안
 * "위치를 확인할 수 없어요"가 떴다가 사라진다 — addressDisplay.ts가 없애려는 바로 그 장면이다.
 * 서비스는 앱 WebView 안에서 돌아가므로 모를 때는 그쪽으로 기울이고, 브라우저 단독 실행은
 * 클라이언트 스냅샷이 곧바로 바로잡는다.
 */
function isInAppWebViewServerSnapshot(): boolean {
  return true;
}

function useIsInAppWebView(): boolean {
  return useSyncExternalStore(subscribeNever, isAppWebView, isInAppWebViewServerSnapshot);
}

/**
 * 상단 주소 라벨이 쓰는 표시 상태. 좌표·권한·변환 결과를 한데 모아 세 갈래로 접는다.
 *
 * `useDisplayLocation()`의 coords는 "제주 지도에 뭘 그릴지" 기준이라 제주 밖이면 null이 되는데,
 * 주소는 제주 밖에서도 보여줘야 하므로 그 판정을 거치지 않는 `useCurrentCoords()`를 쓴다.
 *
 * 이 조회도 계정 스코프다(shared/api/query/accountScopedHash.ts가 모든 쿼리에 걸린다) — 게다가
 * `coords` 자체가 심사위원용 모드에 따라 실좌표/제주시청 고정좌표로 갈린다. 되살리기 전에 먼저
 * 나가면 일반 계정 주소가 잠깐 걸렸다가 심사위원 계정 주소(제주시청 인근)로 바뀌는 홈 조회와
 * 같은 깜빡임이 생긴다 — 같은 이유로 되살리기가 끝날 때까지 기다린다(judgeMode.ts의
 * useJudgeModeHydration 주석).
 */
export function useAddressDisplay(): AddressDisplay {
  const coords = useCurrentCoords();
  const permissionStatus = useLocationStore((s) => s.permissionStatus);
  const isJudgeModeHydrated = useIsJudgeModeHydrated();
  const { data: address, isError, sdkError } = useCurrentAddress(coords, isJudgeModeHydrated);
  const isInAppWebView = useIsInAppWebView();
  const lastKnownAddress = useSyncExternalStore(subscribeLastKnownAddress, getLastKnownAddress, getLastKnownAddressServerSnapshot);

  // 새 주소가 나오면 곧바로 저장한다. 다음 로드가 기다리는 동안 이 값이 자리를 받친다.
  useEffect(() => {
    if (address) writeLastKnownAddress(address);
  }, [address]);

  // 모드가 확정되기 전에는 **직전 주소로 받치지 않는다.** 저장 키는 계정으로 갈려 있지만
  // (lastKnownAddress.ts) 확정 전에는 어느 칸을 볼지 자체가 아직 정해지지 않았다 — 그 한 틱 동안
  // 받치면 틀린 계정의 주소를 확정값처럼 보여 주고(resolveAddressDisplay가 isStale을 붙이지만
  // 화면은 그것을 읽지 않는다) 곧바로 바뀐다. 받치지 않으면 자리표시가 한 틱 더 보일 뿐이다.
  const fallbackAddress = isJudgeModeHydrated ? lastKnownAddress : undefined;

  return resolveAddressDisplay({ address, lastKnownAddress: fallbackAddress, coords, permissionStatus, hasAddressError: isError || sdkError !== null, isInAppWebView });
}
