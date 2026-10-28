'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { PostMessageError } from '@shared/lib/errors';
import { sendToApp, listenFromApp } from '@shared/lib/bridge/utils';
import { useLocationStore } from './store';

// Home 진입 시 앱에 위치 권한을 요청하고, 앱이 돌려주는 권한 결과·실시간 좌표를 스토어에 반영한다
// (06실시간마커최종.md §9 실제 브릿지 연결). sendToApp/listenFromApp 모두 WebView 밖(일반 브라우저)에서는
// 안전한 no-op이라, WebView 밖에서는 스토어가 초기값('undetermined'/null)에 머문 채 페이지가 정상 동작한다.
export function useLocationBridge() {
  const setPermissionStatus = useLocationStore((s) => s.setPermissionStatus);
  const setCoords = useLocationStore((s) => s.setCoords);

  useEffect(() => {
    sendToApp({ type: 'LOCATION_PERMISSION_REQUEST', payload: {} });

    return listenFromApp((message) => {
      switch (message.type) {
        case 'LOCATION_PERMISSION_RESULT':
          setPermissionStatus(message.payload.status);
          break;
        case 'LOCATION_UPDATE':
          // 심사위원용 모드에서도 **그대로 담는다.** 화면에 뭘 그릴지는 resolveDisplayLocation /
          // resolveCurrentCoords가 고정 좌표를 우선해 정하므로 담아 두는 것만으로는 아무것도
          // 달라지지 않는다.
          //
          // 예전에는 모드가 켜져 있으면 흘려보냈다. 그러면 모드를 끄는 순간 스토어가 비어 있어
          // 홈 상단 주소가 "위치를 확인할 수 없어요"로 떨어졌다 — 앱의 위치 구독은 5m를 움직여야
          // 다음 좌표를 주므로, 앉아서 토글하면 채워질 기회가 오지 않는다(사용자 확인).
          setCoords(message.payload);
          break;
        case 'LOCATION_ERROR':
          // 오래된/잘못된 좌표로 마커가 남지 않도록 비우고, 원인은 Sentry로 남긴다
          setCoords(null);
          Sentry.captureException(new PostMessageError(`LOCATION_ERROR: ${message.payload.message}`));
          break;
        default:
          break;
      }
    });
  }, [setPermissionStatus, setCoords]);
}
