import { Redirect } from 'expo-router';
import { getCachedSession } from '@/services/sessionCache';
export default function IndexScreen() {
  const session = getCachedSession();
  if (!session) return <Redirect href="/login" />;
  const onboarded = session.loginUser?.onboardingCompleted === true || session.user != null;
  return <Redirect href={onboarded ? '/home' : '/onboarding/step1'} />;
}
