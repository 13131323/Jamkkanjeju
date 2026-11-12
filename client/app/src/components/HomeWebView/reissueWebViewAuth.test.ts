import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ reissueSession: vi.fn() }));
vi.mock('@/services/auth', () => auth);
vi.mock('./webViewAppInfo', () => ({ currentWebViewAppInfo: () => ({ version: '1', apiOrigin: 'https://api.test' }) }));
import { reissueWebViewAuth } from './reissueWebViewAuth';
import type WebView from 'react-native-webview';
beforeEach(() => vi.clearAllMocks());
describe('WebView 재발급 응답', () => {
  it('웹에는 리프레시 토큰을 전달하지 않는다', async () => {
    auth.reissueSession.mockResolvedValue({ accessToken: 'new-access', tokenType: 'Bearer', refreshToken: 'private-refresh', expiresAt: 100, loginUser: { id: 4, role: 'ADMIN' } });
    const inject = vi.fn();
    await reissueWebViewAuth({ current: { injectJavaScript: inject } as unknown as WebView }, 'old');
    const script = inject.mock.calls[0][0];
    expect(script).toContain('new-access');
    expect(script).toContain('tamnalog:auth-refresh-result');
    expect(script).not.toContain('private-refresh');
    expect(auth.reissueSession).toHaveBeenCalledWith('old');
  });
  it('일시 오류는 기존 웹 토큰을 지우지 않고 결과만 알린다', async () => {
    auth.reissueSession.mockRejectedValue({ response: { status: 503, data: { message: '일시 오류' } } });
    const inject = vi.fn();
    await reissueWebViewAuth({ current: { injectJavaScript: inject } as unknown as WebView });
    expect(inject.mock.calls[0][0]).toContain('503');
    expect(inject.mock.calls[0][0]).not.toContain('__TAMNALOG_AUTH__ = null');
  });
});
