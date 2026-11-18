import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ exitApp: vi.fn(), dismissTo: vi.fn(), request: vi.fn(), platform: { OS: 'android' } }));
vi.mock('react-native', () => ({ BackHandler: { exitApp: native.exitApp }, Platform: native.platform }));
vi.mock('expo-router', () => ({ router: { dismissTo: native.dismissTo } }));
vi.mock('@/store/homeReset', () => ({ useHomeResetStore: { getState: () => ({ request: native.request }) } }));
import { clearMaintenance, getMaintenanceScreen, WebToAppMessageSchema, AppToWebMessageSchema } from '@packages/shared';
import { handleMaintenanceBridgeMessage } from './maintenance';

beforeEach(() => { vi.clearAllMocks(); clearMaintenance(); native.platform.OS = 'android'; });
describe('점검 브릿지', () => {
  it('홈으로 이동은 실제 앱 홈을 리셋한 뒤 돌아간다', () => {
    expect(handleMaintenanceBridgeMessage({ type: 'MAINTENANCE_HOME' })).toBe(true);
    expect(native.request).toHaveBeenCalledOnce();
    expect(native.dismissTo).toHaveBeenCalledWith('/home');
    expect(getMaintenanceScreen()).toBe('home');
    expect(native.request.mock.invocationCallOrder[0]).toBeLessThan(native.dismissTo.mock.invocationCallOrder[0]);
  });
  it('Android 종료 버튼은 BackHandler.exitApp을 호출한다', () => {
    expect(handleMaintenanceBridgeMessage({ type: 'EXIT_APP' })).toBe(true);
    expect(native.exitApp).toHaveBeenCalledOnce();
  });
  it('지원하지 않는 플랫폼에서는 강제 종료를 호출하지 않는다', () => {
    native.platform.OS = 'ios';
    handleMaintenanceBridgeMessage({ type: 'EXIT_APP' });
    expect(native.exitApp).not.toHaveBeenCalled();
  });
  it('기존 메시지는 기존 핸들러로 넘긴다', () => {
    expect(handleMaintenanceBridgeMessage({ type: 'PING' })).toBe(false);
    expect(native.dismissTo).not.toHaveBeenCalled();
  });
  it('양방향 새 메시지 계약을 검증한다', () => {
    const envelope = { type: 'MAINTENANCE_HOME', payload: {}, traceId: 'test-trace' };
    expect(WebToAppMessageSchema.safeParse(envelope).success).toBe(true);
    expect(AppToWebMessageSchema.safeParse(envelope).success).toBe(true);
    expect(WebToAppMessageSchema.safeParse({ ...envelope, type: 'EXIT_APP' }).success).toBe(true);
  });
});
