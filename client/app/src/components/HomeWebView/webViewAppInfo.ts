import Constants from 'expo-constants';
import { apiOriginOf } from '@/services/auth';
import type { WebViewAppInfo } from './authTokenScript';

/**
 * 지금 이 앱이 web에 알려 줄 신원.
 *
 * `authTokenScript`를 순수 함수로 두기 위해 분리했다 — 그쪽은 문자열 조립만 하고,
 * expo-constants·env를 읽는 일은 여기서 한다.
 */
export function currentWebViewAppInfo(): WebViewAppInfo {
  return {
    // Sentry release와 같은 출처(app/app/_layout.tsx)를 쓴다. 값이 없는 경우는 실기기
    // 빌드에서 나오지 않지만, 없다고 안내 문구를 못 띄우면 안 되므로 빈 문자열로 둔다.
    version: Constants.expoConfig?.version ?? '',
    // 저장된 세션의 apiOrigin과 같은 정규화를 쓴다(끝 슬래시·경로 차이로 어긋나 보이면 안 된다)
    apiOrigin: apiOriginOf(process.env.EXPO_PUBLIC_API_URL),
  };
}
