import axios, { type AxiosRequestConfig } from 'axios';
import { notifyApiError } from '@packages/shared';

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

// 웹과 동일하게 백엔드 개발용 자동 로그인을 사용하며 인증 헤더를 첨부하지 않는다.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    notifyApiError(error);
    return Promise.reject(error);
  },
);

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
