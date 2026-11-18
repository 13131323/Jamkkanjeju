import { BackHandler, Platform } from 'react-native';
import { router } from 'expo-router';
import { clearMaintenance, enterMaintenanceHome } from '@packages/shared';
import { useHomeResetStore } from '@/store/homeReset';

/** 별도 장소·방명록 WebView에서도 같은 앱 홈으로 돌아가도록 공통 브릿지에서 처리한다. */
export function goToMaintenanceHome() {
  enterMaintenanceHome();
  useHomeResetStore.getState().request();
  router.dismissTo('/home');
}
export function handleMaintenanceBridgeMessage(message: { type: string }): boolean {
  if (message.type === 'EXIT_APP') {
    if (Platform.OS === 'android') {
      clearMaintenance();
      BackHandler.exitApp();
    }
    return true;
  }
  if (message.type === 'MAINTENANCE_HOME') {
    goToMaintenanceHome();
    return true;
  }
  return false;
}
