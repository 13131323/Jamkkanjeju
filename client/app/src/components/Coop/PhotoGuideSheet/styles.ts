import { StyleSheet } from 'react-native';

/**
 * Penpot `photo-example-bottomsheet` (360x800) 기준.
 *
 * Dark_Overlay #000 55% / 시트 y=41~800, radius 32, 좌우 20, 위 12, 아래 34,
 * 내용 간격 24(잡이 → 제목 → 본문 → CTA), 섹션 안 간격 10, 예시 사진 104x104 radius 8 간격 4.
 * 상태바 41은 실제 inset이 대체한다.
 */
export const photoGuideSheetStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlayPress: { flex: 1 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    // 디자인은 네 모서리 32지만 아래 두 모서리는 화면 밖이라 위쪽만 살린다
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    // 위 여백 12는 dragArea가 자기 padding으로 갖는다 — 잡을 수 있는 띠를 시트 맨 위까지 늘리려고.
    // 보이는 간격은 같고 터치 영역만 12 늘어난다.
    paddingHorizontal: 20,
    gap: 24,
  },

  /**
   * 끌어내려 닫을 수 있는 영역(잡이 + 제목). 높이 70 = 위 여백 12 + 잡이 4 + 24 + 제목 30.
   * 시트의 gap 24는 이 묶음 바깥에만 걸리므로 안쪽 간격(잡이 → 제목)을 여기서 다시 준다.
   */
  dragArea: { paddingTop: 12, gap: 24 },

  // Handle_Bar 40x4 #e2deda
  handleRow: { alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: '#e2deda' },

  title: {
    color: '#2a2621',
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    lineHeight: 30,
  },

  body: { flexShrink: 1 },
  // Frame 666: 나쁜 예 / 좋은 예 / TIP 사이 간격 24
  bodyContent: { gap: 24, paddingBottom: 4 },

  // Frame 661·664: 라벨 → 사진 → 설명 카드 간격 10
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionLabel: { fontFamily: 'Pretendard-Medium', fontSize: 16, lineHeight: 24 },
  sectionEmoji: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 20 },

  samples: { flexDirection: 'row', gap: 4 },
  // 104x104 고정 대신 flex로 나눠 폭이 다른 기기에서도 세 장이 한 줄에 들어간다
  sample: { flex: 1, aspectRatio: 1, borderRadius: 8 },

  card: { borderRadius: 8, borderWidth: 1, padding: 12 },
  cardText: { fontFamily: 'Pretendard-Regular', fontSize: 12, lineHeight: 18 },
  // Dont_Card / Do_Card
  badCard: { backgroundColor: '#fff5f5', borderColor: '#fee2e2' },
  badCardText: { color: '#9b2c2c' },
  goodCard: { backgroundColor: '#fef9e1', borderColor: '#fbe884' },
  goodCardText: { color: '#4a390f' },

  // Tips_Section 320x134 #efefef radius 14 padding 16, 제목 → 목록 12
  tips: { backgroundColor: '#efefef', borderRadius: 14, padding: 16, gap: 12 },
  tipsTitle: {
    color: '#463f36',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  tipList: { gap: 8 },
  tipRow: { flexDirection: 'row', gap: 8 },
  tipBullet: {
    color: '#7c6e5e',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  tipText: {
    flex: 1,
    color: '#463f36',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
});
