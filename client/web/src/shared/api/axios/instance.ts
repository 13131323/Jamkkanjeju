import * as Sentry from '@sentry/nextjs';
import { notifyApiError } from '@packages/shared';
import axios, { type AxiosRequestConfig } from 'axios';
import { env } from '@shared/config/env';
import { ApiServerError, ApiTimeoutError } from '@shared/lib/errors';

const axiosInstance = axios.create({
  // 프록시 경로가 설정돼 있으면 절대주소 대신 같은 origin 경로로 부른다.
  // 배포 API를 로컬에서 볼 때 CORS를 피하는 유일한 방법이다(env.ts의 NEXT_PUBLIC_API_PROXY_PATH 주석).
  // 설정하지 않으면 예전처럼 절대주소로 직접 호출한다.
  baseURL: env.NEXT_PUBLIC_API_PROXY_PATH ?? env.NEXT_PUBLIC_API_BASE_URL,
});

// 현재는 백엔드 개발용 자동 로그인을 사용하므로 일반·심사위원 모드 모두 인증 헤더를 붙이지 않는다.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') notifyApiError(error);
    if (axios.isAxiosError(error)) {
      const { method, url, params, data } = error.config ?? {};
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
