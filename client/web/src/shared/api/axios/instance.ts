import * as Sentry from '@sentry/nextjs';
import { notifyApiError, isServiceUnavailable, isMaintenanceActive, isMaintenanceAllowedRequest } from '@packages/shared';
import axios, { type AxiosRequestConfig } from 'axios';
import { env } from '@shared/config/env';
import { ApiServerError, ApiTimeoutError } from '@shared/lib/errors';
import { clearLoginSession, readLoginSession, isLogoutInProgress } from '../auth/session';
import { requestAuthReissue } from '../auth/reissueToken';

const axiosInstance = axios.create({
  // 프록시 경로가 설정돼 있으면 절대주소 대신 같은 origin 경로로 부른다.
  // 배포 API를 로컬에서 볼 때 CORS를 피하는 유일한 방법이다(env.ts의 NEXT_PUBLIC_API_PROXY_PATH 주석).
  // 설정하지 않으면 예전처럼 절대주소로 직접 호출한다.
  baseURL: env.NEXT_PUBLIC_API_PROXY_PATH ?? env.NEXT_PUBLIC_API_BASE_URL,
});

axiosInstance.interceptors.request.use((config) => {
  if (isMaintenanceActive() && !isMaintenanceAllowedRequest(config.url)) throw new axios.CanceledError('서비스 점검 중입니다.');
  if (isLogoutInProgress()) throw new axios.CanceledError('로그아웃 중입니다.');
  const session = readLoginSession();
  (config as typeof config & { authUserId?: number }).authUserId = session?.loginUser.id;
  if (session && config.url !== '/api/v2/auth/login') config.headers.set('Authorization', `${session.tokenType} ${session.accessToken}`);
  return config;
});
axiosInstance.interceptors.response.use(
  (response) => {
    if (isLogoutInProgress()) throw new axios.CanceledError('로그아웃 중입니다.');
    return response;
  },
  async (error) => {
    if (isServiceUnavailable(error)) {
      if (typeof window !== 'undefined') notifyApiError(error);
      return Promise.reject(error);
    }
    const config = error.config as (AxiosRequestConfig & { authRetried?: boolean; authUserId?: number }) | undefined;
    const current = readLoginSession();
    if (typeof window !== 'undefined' && error.response?.status === 401 && config && config.url !== '/api/v2/auth/login' && current?.loginUser.id === config.authUserId) {
      if (error.response?.data?.code === 'EXPIRED_TOKEN' && !config.authRetried && current) {
        config.authRetried = true;
        try {
          const sent = String((config.headers as Record<string, unknown>)?.Authorization ?? '');
          if ((await requestAuthReissue(sent.replace(/^Bearer /, ''))) && readLoginSession()?.loginUser.id === config.authUserId) return axiosInstance.request(config);
        } catch (refreshError) {
          notifyApiError(refreshError);
          return Promise.reject(refreshError);
        }
      } else {
        if (!current || config.headers?.Authorization === `${current.tokenType} ${current.accessToken}`) clearLoginSession();
      }
    }
    if (typeof window !== 'undefined') notifyApiError(error);
    if (axios.isAxiosError(error)) {
      const { method, url, params } = error.config ?? {};
      const data = error.config?.url?.includes('/auth/') ? '[인증 정보 제외]' : error.config?.data;
      const isTimeout = error.code === 'ECONNABORTED';
      const status = error.response?.status;

      if (isTimeout) {
        Sentry.withScope((scope) => {
          scope.setContext('API Request Detail', { method, url, params, data });
          scope.setTag('api.status', 'timeout');
          scope.setLevel('warning');
          scope.setFingerprint([method ?? '', 'timeout', url ?? '']);
          Sentry.captureException(new ApiTimeoutError(`timeout ${method} ${url}`));
        });
      } else if (status && status >= 500) {
        Sentry.withScope((scope) => {
          scope.setContext('API Request Detail', { method, url, params, data });
          scope.setContext('API Response Detail', { status, data: error.response?.data });
          scope.setTag('api.status', String(status));
          scope.setLevel('error');
          scope.setFingerprint([method ?? '', String(status), url ?? '']);
          Sentry.captureException(new ApiServerError(`${status} ${method} ${url}`));
        });
      }
    }

    return Promise.reject(error);
  },
);

export const orvalClient = async <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> => {
  const response = await axiosInstance.request<T>({ ...config, ...options });
  return response.data;
};

export default axiosInstance;
