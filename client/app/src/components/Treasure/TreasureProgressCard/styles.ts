import { StyleSheet } from 'react-native';

/**
 * Penpot TreasureHunt_step0 > "Frame 530" (16,155 / 328x44).
 * 어두운 카드 안에 진행 바(205x6)와 "보물상자 아이콘 + n/3"이 gap 30으로 놓인다.
 *
 * step0은 fill #111111, step2는 #000000@0.7이다. 카메라 위에서는 반투명이어야 프리뷰가
 * 비쳐 보이므로 유형을 나누지 않고 배경색만 prop으로 받는다.
 */
export const treasureProgressCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 30,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    // 디자인의 #e5e7eb 테두리는 stroke opacity가 0이라 실제로는 보이지 않는다 — 그리지 않는다.
    // 대신 카드에는 drop-shadow 0/4/10 #000000@0.06이 걸려 있다.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  // 진행 바는 남은 폭을 모두 차지한다(디자인 205 + gap 30 + 카운트 61 = 296 = 328 - 좌우 16)
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 10,
    backgroundColor: '#888888',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 10,
    backgroundColor: '#77be36', // tertiary-600
  },
  countGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countIcon: {
    width: 28,
    height: 28,
  },
  countText: {
    color: '#ffffff',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
});
