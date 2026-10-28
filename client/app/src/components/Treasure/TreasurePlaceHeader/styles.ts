import { StyleSheet } from 'react-native';

/**
 * Penpot TreasureHunt_step0 > "Frame 538" (16,100 / 328x30).
 * 장소명(좌) ↔ "장소 상세보기" 배지(우)를 space-between으로 둔 한 행.
 */
export const treasurePlaceHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    // 장소명이 길면 배지를 밀어내지 않고 자기 줄에서 줄임표로 끝나야 한다
    flexShrink: 1,
    color: '#2a2621', // warm-neutral-900
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    lineHeight: 30,
  },
  // PointBadge 컴포넌트는 텍스트만 받는 알약이라 여기서 직접 그린다.
  // 치수는 디자인의 PointBadge(90x28 / r100 / bg #ecf9fd / pad 6·12) 그대로다.
  //
  // 테두리는 배경과 같은 색으로 둔다 — 보이는 선 없이 알약만 남는 모양이다. borderWidth를 0으로
  // 지우지 않는 이유는 그러면 배지 폭이 2px 줄어 디자인 치수와 어긋나기 때문이다.
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    borderRadius: 100,
    paddingHorizontal: 12,
    backgroundColor: '#ecf9fd', // primary-50
    borderWidth: 1,
    borderColor: '#ecf9fd', // 배경과 동일 — 선을 보이지 않게 한다
  },
  detailBadgeText: {
    color: '#076c8d', // primary-800
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
});
