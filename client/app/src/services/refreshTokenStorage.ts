import * as SecureStore from 'expo-secure-store';
/** 리프레시 토큰은 SQLite·WebView에 기록하지 않고 기기 보안 저장소에만 저장한다. */
const KEY = 'tamnalog.refresh-session';
const OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
export interface RefreshCredential {
  refreshToken: string;
  expiresAt: number;
  apiOrigin: string;
  userId: number;
}
export async function readRefreshCredential(): Promise<RefreshCredential | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as RefreshCredential;
    return typeof value.refreshToken === 'string' && value.refreshToken.length > 0 && Number.isFinite(value.expiresAt) && typeof value.apiOrigin === 'string' && Number.isSafeInteger(value.userId)
      ? value
      : null;
  } catch {
    return null;
  }
}
export async function saveRefreshCredential(value: RefreshCredential): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(value), OPTIONS);
}
export async function clearRefreshCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
