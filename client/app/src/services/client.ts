import axios, { type AxiosRequestConfig } from 'axios';
import { clearSession } from '@/db/session';
import { isJudgeModeEnabled } from '@/store/judgeMode';
import { type AuthTaggedConfig, readSentAuthorizationHeader, resolveAuthorizationHeader, shouldDiscardSessionOnUnauthorized } from './authHeader';
import { authorizationHeaderOf, getCachedSession, setCachedSession } from './sessionCache';

/**
 * 기본 Content-Type을 박지 않는다.
 *
 * axios는 평범한 객체를 보낼 때 스스로 `application/json`을 붙이므로(defaults의 transformRequest)
 * 이 기본값은 없어도 JSON 요청에 아무 영향이 없다. 반대로 **있으면 파일 업로드를 깨뜨린다** —
 * axios 1.x의 transformRequest는 데이터가 FormData이고 Content-Type에 'application/json'이
 * 섞여 있으면 `JSON.stringify(formDataToJSON(data))`로 **본문을 JSON으로 바꿔 버린다**
 * (node_modules/axios/lib/defaults/index.js). 그러면 파일 파트가 통째로 사라진 JSON이 나가고,
 * 서버 입장에서는 사진이 오지 않은 요청이 된다 — 사진 업로드가 조용히 실패하던 원인이다.
 */
const axiosInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? '',
});

// 어떤 토큰을 붙일지는 authHeader.ts가 정한다(심사위원용 모드 > 앱 토큰 > 없음).
// 매 요청마다 다시 묻는다 — 모드는 실행 중에 web이 켜고 끄고(JUDGE_MODE_UPDATE),
// 앱 토큰도 재발급으로 바뀐다. 모듈 로드 시점에 한 번 읽으면 옛 값이 남는다.
axiosInstance.interceptors.request.use((config) => {
  const header = resolveAuthorizationHeader(isJudgeModeEnabled(), authorizationHeaderOf(getCachedSession()));
  if (header) {
    config.headers.Authorization = header;
  }
  // 401을 받았을 때 "무엇이 거절당했는지" 알아야 세션을 버릴지 정할 수 있다.
  // 응답 인터셉터가 같은 config를 받으므로 여기에 적어 둔다(authHeader.ts의 AuthTaggedConfig).
  (config as typeof config & AuthTaggedConfig).sentAuthHeader = header;
  return config;
});

// 401이면 저장된 세션을 버려 다음 실행에서 새 토큰을 받게 한다.
// 자동 재발급·재시도는 넣지 않는다 — 재귀 방지와 동시성 처리를 함께 요구해서
// 지금 필요한 것보다 복잡해진다.
//
// **단, 거절당한 것이 앱 토큰일 때만 버린다**(shouldDiscardSessionOnUnauthorized).
// 심사위원 토큰의 401이나 토큰 없이 나간 요청의 401로 앱의 신원을 지우면,
// 이 모드를 끄는 순간 사용자가 새 익명 사용자가 되어 진행도를 잃는다.
axiosInstance.interceptors.response.use(undefined, (error) => {
  if (error?.response?.status === 401 && shouldDiscardSessionOnUnauthorized(readSentAuthorizationHeader(error), authorizationHeaderOf(getCachedSession()))) {
    setCachedSession(null);
    void clearSession();
  }
  return Promise.reject(error);
});

/**
 * FormData를 보낼 때는 Content-Type을 **아무도 정하지 않게** 비운다.
 *
 * 두 가지를 한꺼번에 막는다.
 *
 * 1. orval 생성물이 박는 `'Content-Type': 'multipart/form-data'`에는 **boundary가 없다**.
 *    헤더가 이미 있으면 RN의 네트워킹 레이어(okhttp)도 axios도 boundary를 붙여 주지 않아서
 *    서버가 파트 구분을 못 한다.
 * 2. 인스턴스 기본값이든 호출부가 준 값이든 `application/json`이 섞이면 axios가 FormData를
 *    JSON으로 직렬화해 버린다(axios 인스턴스 생성부 주석 참고).
 *
 * 헤더를 비워 두면 FormData를 보는 플랫폼이 `multipart/form-data; boundary=...`를 직접 만든다.
 * 생성 파일을 고칠 수는 없으므로(다음 generate에서 덮어쓴다) 이 mutator에서 걷어낸다.
 */
function stripContentTypeForFormData(headers: AxiosRequestConfig['headers'], data: unknown): AxiosRequestConfig['headers'] {
  if (typeof FormData === 'undefined' || !(data instanceof FormData) || !headers) return headers;

  return Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'content-type'));
}

export const orvalClient = async <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> => {
  const merged = { ...config, ...options };
  const response = await axiosInstance.request<T>({
    ...merged,
    headers: stripContentTypeForFormData(merged.headers, merged.data),
  });
  return response.data;
};

export default axiosInstance;
