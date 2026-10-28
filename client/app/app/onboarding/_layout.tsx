import { Stack } from 'expo-router';

// animation: 'none'의 이유는 app/_layout.tsx의 Stack 주석 참고 — step1~3은 CTA가 같은 자리에 있어
// 밀려 들어오는 동안 두 번째 탭이 다음 step의 "다음"에 꽂히던 지점이다.
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
