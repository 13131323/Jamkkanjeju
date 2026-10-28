import { Redirect } from 'expo-router';
import { getCachedSession } from '@/services/sessionCache';

/**
 * 앱 진입점.
 *
 * 루트 _layout이 스플래시 구간에서 부트스트랩을 끝낸 뒤에야 이 화면이 렌더되므로
 * 세션 캐시를 동기로 읽어도 안전하다.
 *
 * user가 있다 = PATCH /api/v1/users/me 응답을 받아 저장해 둔 기기다.
 * 호출은 했지만 응답을 못 받았다면 저장되지 않으므로 온보딩이 다시 뜬다.
 */
export default function IndexScreen() {
  const hasOnboardingResult = getCachedSession()?.user != null;

  return <Redirect href={hasOnboardingResult ? '/home' : '/onboarding/step1'} />;
}
