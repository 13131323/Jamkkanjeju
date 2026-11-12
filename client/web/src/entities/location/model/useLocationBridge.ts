'use client';
import { useEffect } from 'react';
import { offsetAdminCoords } from '@packages/shared';
import { sendToApp, listenFromApp, isAppWebView } from '@shared/lib/bridge/utils';
import { readLoginSession } from '@shared/api/auth/session';
import { useLocationStore } from './store';
import { shouldDiscardCoordsForPermission } from './permissionCoords';
/** 센서 좌표를 공통 저장소에 반영한다. 앱 좌표에는 변환을 중복 적용하지 않는다. */
export function useLocationBridge() {
  useEffect(() => {
    const store = useLocationStore.getState();
    if (!isAppWebView()) {
      if (!navigator.geolocation) {
        store.setPermissionStatus('blocked');
        return;
      }
      const watch = navigator.geolocation.watchPosition(
        (position) => {
          store.setPermissionStatus('granted-precise');
          store.setCoords(
            offsetAdminCoords({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp }, readLoginSession()?.loginUser.role),
          );
        },
        () => {
          store.setPermissionStatus('blocked');
          store.setCoords(null);
        },
        { enableHighAccuracy: true },
      );
      return () => navigator.geolocation.clearWatch(watch);
    }
    sendToApp({ type: 'LOCATION_PERMISSION_REQUEST', payload: {} });
    return listenFromApp((message) => {
      if (message.type === 'LOCATION_PERMISSION_RESULT') {
        store.setPermissionStatus(message.payload.status);
        if (shouldDiscardCoordsForPermission(message.payload.status)) store.setCoords(null);
      } else if (message.type === 'LOCATION_UPDATE') store.setCoords(message.payload);
      else if (message.type === 'LOCATION_ERROR') store.setCoords(null);
    });
  }, []);
}
