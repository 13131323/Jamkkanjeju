import { StyleSheet } from 'react-native';

/**
 * Penpot TreasureHunt_step1의 하단 시트.
 *
 * - Rectangle 65: 0,468 / 360x332 / radius 20 / drop-shadow 0 4 64 rgba(0,0,0,0.25)
 *   디자인 fill은 #ffffff 0.6→1 세로 그라디언트지만, 시트 위쪽이 반투명이라 지도가 비쳐
 *   제목이 읽히지 않는다는 지적이 있어 **불투명 흰색**으로 둔다(요청사항).
 * - Vector 101: 161,490 폭 38 — 시트 상단 손잡이
 * - Frame 586: 16,520 / 328x169 / column gap 13 / align center
 *   - Frame 321: gap 8 — 제목 18·1.44·w700 #0e0d0b / 설명 14·1.57·w400 #6a6a6a
 *   - image 57: 99x99 정사각 (흰 stroke 12는 strokeOpacity 0이라 보이지 않아 그리지 않는다)
 * - CTA Wrapper: 0,699 / pad 16·16·12·16 / Button 328x52
 */

/** 시트 높이(px). 디자인 332 = 800 - 468 */
export const TREASURE_SHEET_HEIGHT = 332;

export const treasureEnterSheetStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    // Android는 shadow* 대신 elevation만 본다
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dddddd',
    // 시트 상단(468)에서 손잡이(490)까지 22
    marginTop: 22,
  },
  body: {
    alignItems: 'center',
    // 손잡이(490+4) 아래 Frame 586 시작(520)까지 남는 간격
    marginTop: 26,
    paddingHorizontal: 16,
    gap: 13,
  },
  textGroup: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#0e0d0b',
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  description: {
    color: '#6a6a6a',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  // image 57: 99x99 정사각. radius도 없고, 흰 stroke 12는 stroke opacity가 0이라 보이지 않는다
  // — 링을 그리면 디자인과 달라진다.
  image: {
    width: 99,
    height: 99,
  },
  ctaWrapper: {
    // minHeight로 남는 공간이 생기면 CTA를 시트 아래쪽에 붙인다(디자인의 y=699 위치)
    marginTop: 'auto',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
});
