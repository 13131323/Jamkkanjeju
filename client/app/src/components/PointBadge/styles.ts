import { TextStyle, ViewStyle } from 'react-native';

export type PointBadgeSize = 'chip' | 'sm' | 'md';

/**
 * 각 프리셋은 실제 디자인 하나씩에 대응한다. 임의로 값을 통일하지 말 것 —
 * 세 화면의 높이/패딩/폰트가 디자인상 실제로 다르다.
 *
 * - md: Penpot CultureMission_detail_1 > PointBadge
 * - sm: Penpot TreasureHunt_step1/2/3 > NavigationHeader > PointBadge
 *       (docs/superpowers/specs/2026-08-15-treasure-hunt-design-values.md "공통 — NavigationHeader")
 * - chip: Penpot IntResultScreen > 캐릭터 칩. 고정 높이 없이 패딩으로 높이가 정해진다
 */
export const POINT_BADGE_SIZE_STYLES: Record<
  PointBadgeSize,
  { container: ViewStyle; text: TextStyle }
> = {
  md: {
    container: { height: 28, borderRadius: 100, paddingLeft: 10, paddingRight: 12 },
    text: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 20 },
  },
  sm: {
    container: { height: 24, borderRadius: 100, paddingHorizontal: 10 },
    text: { fontFamily: 'Pretendard-Medium', fontSize: 12 },
  },
  chip: {
    container: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 9 },
    text: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, lineHeight: 17 },
  },
};
