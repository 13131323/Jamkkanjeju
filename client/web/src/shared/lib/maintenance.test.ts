import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMaintenance, enterMaintenanceHome, getMaintenanceScreen, isMaintenanceAllowedRequest, shouldRetryApiRequest, subscribeMaintenance } from '@packages/shared';
import { notifyApiError, subscribeApiErrors, wasApiErrorNotified } from '@packages/shared';

beforeEach(clearMaintenance);
describe('공통 503 점검 안내', () => {
  it('에러 코드·메시지가 없어도 503이면 토스트 대신 모달 상태를 만든다', () => {
    const toast = vi.fn();
    const unsubscribe = subscribeApiErrors(toast);
    const error = { response: { status: 503, data: 'Service unavailable' } };
    notifyApiError(error);
    expect(getMaintenanceScreen()).toBe('notice');
    expect(wasApiErrorNotified(error)).toBe(true);
    expect(toast).not.toHaveBeenCalled();
    unsubscribe();
  });
  it('동시 503은 안내 한 번으로 합치고 홈 이동 후 다시 안내 단계로 돌아가지 않는다', () => {
    const changed = vi.fn();
    const unsubscribe = subscribeMaintenance(changed);
    for (let i = 0; i < 10; i++) notifyApiError({ response: { status: 503 } });
    expect(changed).toHaveBeenCalledTimes(1);
    enterMaintenanceHome();
    notifyApiError({ response: { status: 503 } });
    expect(getMaintenanceScreen()).toBe('home');
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
  it('500 같은 다른 오류는 기존 토스트 처리로 유지한다', () => {
    const toast = vi.fn();
    const unsubscribe = subscribeApiErrors(toast);
    notifyApiError({ response: { status: 500, data: { message: '서버 오류' } } });
    expect(getMaintenanceScreen()).toBeNull();
    expect(toast).toHaveBeenCalledWith('서버 오류');
    unsubscribe();
  });
  it('점검 후 홈·로그인·재발급만 허용한다', () => {
    expect(isMaintenanceAllowedRequest('/api/v2/users/me/home?latitude=33')).toBe(true);
    expect(isMaintenanceAllowedRequest('/api/v2/auth/login')).toBe(true);
    expect(isMaintenanceAllowedRequest('/api/v2/auth/refresh')).toBe(true);
    expect(isMaintenanceAllowedRequest('/api/v2/map/contents')).toBe(false);
    expect(isMaintenanceAllowedRequest('/api/v2/users/me/home/other')).toBe(false);
  });
  it('503·점검 중·취소된 요청은 재시도하지 않는다', () => {
    expect(shouldRetryApiRequest(0, { response: { status: 503 } })).toBe(false);
    expect(shouldRetryApiRequest(0, { code: 'ERR_CANCELED' })).toBe(false);
    expect(shouldRetryApiRequest(0, new Error('network'))).toBe(true);
    enterMaintenanceHome();
    expect(shouldRetryApiRequest(0, new Error('network'))).toBe(false);
  });
});
