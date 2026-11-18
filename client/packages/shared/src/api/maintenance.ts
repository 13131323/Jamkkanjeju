export type MaintenanceScreen = 'notice' | 'home' | null;

let screen: MaintenanceScreen = null;
const listeners = new Set<() => void>();
export const getMaintenanceScreen = () => screen;
export const getMaintenanceServerSnapshot = (): MaintenanceScreen => null;
export function subscribeMaintenance(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function setScreen(next: MaintenanceScreen) {
  if (screen === next) return;
  screen = next;
  listeners.forEach((listener) => listener());
}
/** 사용자 요청에 따라 에러 코드와 관계없이 모든 HTTP 503을 점검 안내로 취급한다. */
export function isServiceUnavailable(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null)?.response?.status === 503;
}
export function showMaintenanceNotice() {
  if (screen === null) setScreen('notice');
}
export function enterMaintenanceHome() { setScreen('home'); }
export function clearMaintenance() { setScreen(null); }
export const isMaintenanceActive = () => screen !== null;

/** 점검을 인지한 뒤에는 홈 조회와 인증 복원만 허용한다. */
export function isMaintenanceAllowedRequest(url?: string): boolean {
  const path = (url ?? '').split('?')[0].replace(/\/$/, '');
  return ['/api/v2/users/me/home', '/api/v2/auth/login', '/api/v2/auth/refresh'].includes(path);
}
export function shouldRetryApiRequest(failureCount: number, error: unknown): boolean {
  const canceled = (error as { code?: string } | null)?.code === 'ERR_CANCELED';
  return !isMaintenanceActive() && !isServiceUnavailable(error) && !canceled && failureCount < 3;
}
