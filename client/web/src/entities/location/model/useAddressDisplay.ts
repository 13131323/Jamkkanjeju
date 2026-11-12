'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { isAppWebView } from '@shared/lib/bridge/utils';
import { resolveAddressDisplay, type AddressDisplay } from './addressDisplay';
import { useCurrentAddress } from './useCurrentAddress';
import { useCurrentCoords } from './useCurrentCoords';
import { useLocationStore } from './store';
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

export function useAddressDisplay(): AddressDisplay {
  const coords = useCurrentCoords();
  const permissionStatus = useLocationStore((s) => s.permissionStatus);
  const { data: address, isError, sdkError } = useCurrentAddress(coords, true);
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
  const fallbackAddress = lastKnownAddress;

  return resolveAddressDisplay({ address, lastKnownAddress: fallbackAddress, coords, permissionStatus, hasAddressError: isError || sdkError !== null, isInAppWebView });
}
