import { StyleSheet } from 'react-native';

/**
 * 보물찾기 전용 크롬의 스타일만 남는다.
 *
 * 촬영 화면의 뼈대(풀블리드 카메라·캐릭터 오버레이·셔터 패널·미리보기)는
 * `components/CharacterPhotoCapture/styles.ts`로 옮겼다 — 마이페이지에서도 쓰는 화면이라
 * 보물찾기 폴더 아래 두면 안 된다. 여기 남은 건 이 미션에만 있는 진행도 카드(n/3)뿐이다.
 */

// TreasureProgressCard의 top 오프셋: 디자인 y=118 = 상태바(44, insets.top으로 대체) + 헤더(56) + 여백(18).
export const PROGRESS_CARD_TOP_OFFSET = 56 + 18;

export const treasureHuntPhotoStyles = StyleSheet.create({
  // TreasureProgressCard 위치: left/right는 고정, top은 insets.top에 따라 달라져 컴포넌트에서 합성한다
  // (PROGRESS_CARD_TOP_OFFSET 주석 참고).
  progressCard: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
});
