import { useEffect, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';
import { getMaintenanceScreen, getMaintenanceServerSnapshot, isMaintenanceAllowedRequest, subscribeMaintenance } from '@packages/shared';
import { goToMaintenanceHome, handleMaintenanceBridgeMessage } from '@/bridge/maintenance';
import { getCachedSession } from '@/services/sessionCache';

/** Native 미션 화면의 503도 웹 홈과 같은 안내로 연결한다. */
export function MaintenanceGate() {
  const screen = useSyncExternalStore(subscribeMaintenance, getMaintenanceScreen, getMaintenanceServerSnapshot);
  const queryClient = useQueryClient();
  const homeFallback = screen === 'home' && !getCachedSession();
  useEffect(() => {
    if (screen) void queryClient.cancelQueries({ predicate: (query) => !isMaintenanceAllowedRequest(String(query.queryKey[0])) });
  }, [screen, queryClient]);
  return <Modal visible={screen === 'notice' || homeFallback} transparent statusBarTranslucent animationType="fade" onRequestClose={() => undefined}>
    <View style={styles.scrim}>
      <View style={styles.card} accessibilityViewIsModal>
        <View style={styles.icon}><Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#558627" strokeWidth={1.6}><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></Svg></View>
        <Text style={styles.title}>서비스 점검 중입니다</Text>
        <Text style={styles.message}>현재 서비스 점검 중입니다.</Text>
        <Text style={styles.note}>점검이 끝난 후 다시 이용해 주세요.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={homeFallback ? () => handleMaintenanceBridgeMessage({ type: 'EXIT_APP' }) : goToMaintenanceHome}><Text style={styles.buttonText}>{homeFallback ? '종료하기' : '홈으로 이동'}</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center', gap: 20, backgroundColor: '#fff' },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf7e3' },
  title: { fontFamily: 'Pretendard-Bold', fontSize: 22, color: '#222', textAlign: 'center' },
  message: { fontFamily: 'Pretendard-Regular', fontSize: 16, color: '#555', textAlign: 'center' },
  note: { fontFamily: 'Pretendard-Regular', fontSize: 14, color: '#888', textAlign: 'center' },
  button: { width: '100%', borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: '#222' },
  buttonText: { fontFamily: 'Pretendard-Bold', fontSize: 16, color: '#fff' },
});
