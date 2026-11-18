import { AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@sentry/nextjs', () => ({ withScope: vi.fn() }));
vi.mock('@shared/config/env', () => ({ env: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080' } }));
vi.mock('../auth/session', () => ({ clearLoginSession: vi.fn(), readLoginSession: () => null, isLogoutInProgress: () => false }));
vi.mock('../auth/reissueToken', () => ({ requestAuthReissue: vi.fn() }));
import api from './instance';
import { clearMaintenance, getMaintenanceScreen } from '@packages/shared';
const handlers = api.interceptors as unknown as { request: { handlers: { fulfilled: (config: unknown) => unknown }[] }; response: { handlers: { rejected: (error: unknown) => Promise<unknown> }[] } };

beforeEach(() => { clearMaintenance(); vi.stubGlobal('window', {}); });
describe('웹 공통 503 처리', () => {
  it('메시지가 없는 503도 점검 모달로 전달한다', async () => {
    const failure = { response: { status: 503 } };
    await expect(handlers.response.handlers[0].rejected(failure)).rejects.toBe(failure);
    expect(getMaintenanceScreen()).toBe('notice');
  });
  it('점검 이후 지도 요청은 취소하지만 홈 조회는 허용한다', async () => {
    await handlers.response.handlers[0].rejected({ response: { status: 503 } }).catch(() => undefined);
    expect(() => handlers.request.handlers[0].fulfilled({ url: '/api/v2/map/contents', headers: new AxiosHeaders() })).toThrow('서비스 점검 중입니다.');
    expect(() => handlers.request.handlers[0].fulfilled({ url: '/api/v2/users/me/home', headers: new AxiosHeaders() })).not.toThrow();
  });
});
