import { Stack } from 'expo-router';

// 미션 플로우(intro → 진행 화면 → complete)는 화면마다 디자인된 헤더를 직접 그린다.
// animation: 'none'의 이유는 app/_layout.tsx의 Stack 주석 참고 — 루트와 값이 갈리면
// 미션 플로우만 밀려 들어와서 같이 맞춘다.
export default function MissionLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
