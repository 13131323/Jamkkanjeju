import * as Sentry from '@sentry/nextjs';
import axios, { type AxiosRequestConfig } from 'axios';
import { env } from '@shared/config/env';
import { readWebViewAuth, webViewAuthHeader } from '@shared/api/auth/webViewToken';
import { judgeAuthHeader } from '@shared/api/auth/judgeToken';
import { requestAuthReissue } from '@shared/api/auth/reissueToken';
import { ApiServerError, ApiTimeoutError } from '@shared/lib/errors';

const axiosInstance = axios.create({
  // 프록시 경로가 설정돼 있으면 절대주소 대신 같은 origin 경로로 부른다.
  // 배포 API를 로컬에서 볼 때 CORS를 피하는 유일한 방법이다(env.ts의 NEXT_PUBLIC_API_PROXY_PATH 주석).
  // 설정하지 않으면 예전처럼 절대주소로 직접 호출한다.
  baseURL: env.NEXT_PUBLIC_API_PROXY_PATH ?? env.NEXT_PUBLIC_API_BASE_URL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    // 토큰이 없던 시절에는 X-Trace-Id로 요청을 사용자와 묶었다.
    // 이제 익명 토큰이 그 역할을 하므로 헤더를 보내지 않는다.
    // (같은 이름의 traceId는 브릿지 메시지 봉투에서 계속 쓰인다 — shared/lib/bridge/utils.ts)
    //
    // 앱 WebView가 심어준 토큰을 매 요청마다 다시 읽는다.
    // 모듈 로드 시점에 한 번 읽어두면 토큰이 늦게(또는 재발급으로 다시) 심겼을 때 옛 값이 남는다.
    //
    // 심사위원용 모드가 켜져 있으면 그 토큰이 **앱 토큰보다 우선**이다. 앱이 발급한 익명 사용자로는
    // 심사 화면에 볼 것이 없고(미션 이력·도감이 빈다), 모드의 목적이 정확히 그것을 채우는 것이다.
    // 모드가 꺼져 있으면 null이라 아래 앱 토큰 경로가 그대로 동작한다.
    const authHeader = judgeAuthHeader() ?? webViewAuthHeader(readWebViewAuth());
    if (authHeader) {
      config.headers.Authorization = authHeader;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * 이 요청이 이미 토큰 재발급을 거쳤는지 표시하는 자리.
 *
 * 없으면 새 토큰으로도 401이 날 때(서버가 그 사용자를 계속 거절하는 경우) 재발급→재시도가
 * 무한히 돈다. 한 요청당 딱 한 번만 시도한다.
 */
type RetriableConfig = AxiosRequestConfig & { _authRetried?: boolean };

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    /**
     * 401 — 앱이 심어준 토큰이 거절당했다. 다시 심어 달라고 부탁하고 한 번만 재시도한다.
     *
     * web은 토큰을 발급할 수 없어(shared/api/auth/reissueToken.ts) 이 부탁이 유일한 복구 경로다.
     * 실패하거나 WebView 밖이면 아래로 흘러가 401이 그대로 호출부에 전달된다.
     * Sentry에는 남기지 않는다 — 복구되면 아무 일도 없었고, 안 되면 그 화면의 쿼리가 이미 드러낸다.
     */
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const config = error.config as RetriableConfig | undefined;

      // 심사위원용 모드에서는 재발급을 부탁하지 않는다. 헤더는 심사위원 토큰이 이기므로
      // 앱이 새 익명 토큰을 심어도 다음 요청에 붙지 않는다 — 5초를 기다릴 이유가 없다.
      // 이때의 401은 서버에 그 목업 사용자가 없다는 뜻이고, 클라이언트가 할 수 있는 일이 없다.
      if (config && !config._authRetried && judgeAuthHeader() === null) {
        config._authRetried = true;
        const didReissue = await requestAuthReissue();
        // 요청 인터셉터가 매 요청마다 전역을 다시 읽으므로, 재시도하면 새 토큰이 자동으로 붙는다
        if (didReissue) return axiosInstance.request(config);
      }
    }

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
