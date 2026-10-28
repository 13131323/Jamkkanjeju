/**
 * baseUrl과 path를 이어 붙인다.
 * - baseUrl 끝의 슬래시, path 시작의 슬래시가 중복되지 않도록 정규화한다.
 * - path에 쿼리스트링(`?mode=treasure` 등)이 포함돼 있어도 그대로 보존한다.
 */
function joinWebViewPath(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * WebView가 로드할 web URL을 계산한다.
 * - explicitUrl(EXPO_PUBLIC_WEB_URL)이 있으면 그대로(+path) 사용.
 * - 없고 dev 환경이면 devFallbackUrl(EXPO_PUBLIC_DEV_WEB_URL)로 폴백.
 * - 둘 다 없으면 에러.
 *
 * URL을 코드에 두지 않는다. 예전에는 Android 에뮬레이터 호스트(10.0.2.2)를 상수로 박아뒀는데,
 * 그 값이 실기기에서는 틀린 주소라 .env 설정을 빼먹어도 조용히 흰 화면만 나왔다.
 * 이제는 두 값 모두 .env에서 오고, 없으면 어떤 변수를 채워야 하는지 에러로 알려준다.
 *
 * path는 선택 인자다. 생략하면 기존 HomeWebView 호출부와 동일하게 baseUrl 그대로 반환한다.
 */
export function resolveWebViewUrl(
  explicitUrl: string | undefined,
  isDev: boolean,
  path?: string,
  devFallbackUrl?: string,
): string {
  const baseUrl = explicitUrl ?? (isDev ? devFallbackUrl : undefined);

  if (!baseUrl) {
    throw new Error(
      isDev
        ? 'EXPO_PUBLIC_WEB_URL 또는 EXPO_PUBLIC_DEV_WEB_URL을 .env에 설정해야 합니다.'
        : 'EXPO_PUBLIC_WEB_URL is required outside development.',
    );
  }

  return path ? joinWebViewPath(baseUrl, path) : baseUrl;
}
