'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { enterMaintenanceHome, getMaintenanceScreen, getMaintenanceServerSnapshot, isMaintenanceAllowedRequest, subscribeMaintenance } from '@packages/shared';
import { getQueryClient } from '@shared/api/query/queryClient';
import { isAppWebView, listenFromApp, sendToApp } from '@shared/lib/bridge/utils';
import { MaintenanceDialog } from './MaintenanceDialog';

/** 페이지 위치와 무관하게 첫 503에서 한 안내만 띄운다. */
export function GlobalMaintenanceGate() {
  const screen = useSyncExternalStore(subscribeMaintenance, getMaintenanceScreen, getMaintenanceServerSnapshot);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (screen === 'home' && pathname !== '/') router.replace('/');
  }, [screen, pathname, router]);
  useEffect(() => listenFromApp((message) => {
    if (message.type === 'MAINTENANCE_HOME') {
      enterMaintenanceHome();
      router.replace('/');
      void getQueryClient().invalidateQueries({ queryKey: ['/api/v2/users/me/home'] });
    }
  }), [router]);
  useEffect(() => {
    if (!screen) return;
    void getQueryClient().cancelQueries({ predicate: (query) => !isMaintenanceAllowedRequest(String(query.queryKey[0])) });
  }, [screen]);
  if (screen === 'home' && pathname !== '/') return <MaintenanceDialog actionLabel="종료하기" onAction={() => sendToApp({ type: 'EXIT_APP', payload: {} })} />;
  if (screen !== 'notice') return null;
  return <MaintenanceDialog actionLabel="홈으로 이동" onAction={() => {
    enterMaintenanceHome();
    if (isAppWebView()) sendToApp({ type: 'MAINTENANCE_HOME', payload: {} });
    router.replace('/');
    void getQueryClient().invalidateQueries({ queryKey: ['/api/v2/users/me/home'] });
  }} />;
}
