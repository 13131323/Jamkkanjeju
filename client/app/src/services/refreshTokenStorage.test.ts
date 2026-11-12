import { beforeEach, describe, expect, it, vi } from 'vitest';
const secure = vi.hoisted(() => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn(), AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1 }));
vi.mock('expo-secure-store', () => secure);
import { readRefreshCredential, saveRefreshCredential, clearRefreshCredential } from './refreshTokenStorage';
beforeEach(() => vi.clearAllMocks());
describe('SecureStore 리프레시 토큰 보관', () => {
  it('보안 저장소에 계정·서버·만료 시각과 함께 저장한다', async () => {
    const value = { refreshToken: 'secret', expiresAt: 100, apiOrigin: 'https://api.test', userId: 4 };
    await saveRefreshCredential(value);
    expect(JSON.parse(secure.setItemAsync.mock.calls[0][1])).toEqual(value);
    expect(secure.setItemAsync.mock.calls[0][2]).toEqual({ keychainAccessible: 1 });
  });
  it('저장된 값을 복원한다', async () => {
    const value = { refreshToken: 'secret', expiresAt: 100, apiOrigin: 'https://api.test', userId: 4 };
    secure.getItemAsync.mockResolvedValue(JSON.stringify(value));
    expect(await readRefreshCredential()).toEqual(value);
  });
  it('손상된 저장값은 사용하지 않는다', async () => {
    secure.getItemAsync.mockResolvedValue('{');
    expect(await readRefreshCredential()).toBeNull();
  });
  it('로그아웃 시 보안 저장소에서 삭제한다', async () => {
    await clearRefreshCredential();
    expect(secure.deleteItemAsync).toHaveBeenCalledWith('tamnalog.refresh-session');
  });
});
