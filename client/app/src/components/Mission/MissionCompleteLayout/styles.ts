import { StyleSheet } from 'react-native';

// ResultCard / placeCard 공통 그림자. 검정이 아니라 미션 테마색 틴트 그림자다.
// 두 화면의 색이 실제로 다르다(Penpot 확인: CultureMission_Complete #c5edfa / Mission_Complete #e2f2d2)
// — 이전에는 spec에 명시가 없어 두 화면 모두 #c5edfa로 두고 있었다. 이제 미션별로 받는다.
export function cardShadow(color: string): string {
  return `0px 4px 14px ${color}`;
}

/**
 * "다음 여행지" 카드의 썸네일 자리.
 *
 * 사진과 (사진이 없을 때의) 스켈레톤이 **같은 크기·라운딩**을 써야 카드 레이아웃이 흔들리지 않아
 * 두 곳이 함께 참조한다. skeletonColor는 흰 카드 위에서 보이는 회색이다 —
 * SkeletonBlock의 기본값(흰색)은 색이 깔린 배경 위를 전제한 값이라 여기서는 보이지 않는다.
 */
export const PLACE_THUMB = { size: 73, radius: 14, skeletonColor: '#f6f5f4' } as const;

/**
 * Penpot "탐라로그 V2" > CultureMission_Complete / 보물찾기 Mission_Complete 공통 기준.
 * 당시 커밋된 검증 화면(culture-mission-complete)에서 순수 추출 — 색/문구만 prop화하고
 * 그 외 수치(margin/padding/size 등)는 정리하지 않고 원본 그대로 옮겼다.
 */
export const styles = StyleSheet.create({
  header: { height: 56, justifyContent: 'center', paddingHorizontal: 16 },
  scroll: { flex: 1 },
  // 내용이 짧을 땐 기존처럼 위에서부터 채우고, 넘칠 땐 그때만 스크롤된다
  scrollContent: { flexGrow: 1 },

  // 디자인상 축하 이미지(y 58)가 헤더(y 44~100) 위로 올라와 겹친다.
  // 뒤로가기 버튼과는 가로로 겹치지 않아 터치에는 영향이 없다
  //
  // 크기는 세 완료 화면이 **하나의 값을 공유한다**. Penpot에서 재보면 문화 164@58,
  // 보물찾기 178@52, 협동 162@51로 서로 다르지만, MessageSection이 세 화면 모두 y=230에
  // 고정돼 있어 이 차이는 보드를 복제하며 생긴 노이즈다(레이아웃 의도가 아니다).
  // 164 + message marginTop 8 = 230으로 세 화면 모두 재현되므로 미션별로 나누지 않는다.
  // 이미지 크기·radius는 기기 높이에 따라 달라져서 여기 두지 않고 CelebrationImage가 계산한다
  // (기준 크기와 상하한은 celebrationScale.ts). marginTop -42는 헤더와 겹치는 양이고
  // 이미지 크기와 무관하므로 고정이다.
  celebrationRow: { alignItems: 'center', marginTop: -42 },

  message: { marginTop: 8, alignItems: 'center', paddingHorizontal: 24 },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },

  // ResultCard: 312x172, 패딩 8/16, 52 높이 3행
  resultCard: {
    // 디자인 y=322, MessageSection 끝 295 → 27 (Penpot CultureMission_Complete 실측)
    marginTop: 27,
    marginHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resultRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultRowDivider: { borderTopWidth: 1, borderTopColor: '#f6f5f4' },
  // 라벨 텍스트/색은 두 화면이 동일(spec 표 기준)이라 prop화하지 않고 고정
  rowLabel: { fontFamily: 'Pretendard-Medium', fontSize: 14, lineHeight: 17, color: '#222222' },
  rowBadge: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rowBadgeText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 20 },

  // 안내 문구도 spec상 두 화면 "동일"이라 고정.
  // marginTop은 여기 두지 않는다 — 남는 높이를 흡수하는 값이라 호출부가 주입한다
  // (디자인 실측은 28: 문화·보물찾기 522 = ResultCard 끝 494 + 28. 협동만 526이지만
  //  나머지 좌표가 전부 같아 4px 차이는 복제 노이즈로 본다. 근거는 completeLayout.ts)
  suggestion: {
    marginHorizontal: 24,
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#0e0d0b',
  },

  // 디자인 312x114. 좌 16 / 상 14 / 하 17이고 우측은 26(본문 폭이 171로 고정된다)
  placeCard: {
    marginTop: 8,
    marginHorizontal: 24,
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingTop: 14,
    paddingBottom: 17,
    paddingLeft: 16,
    paddingRight: 26,
  },
  // alignSelf: 'flex-start' — placeCard가 row라 기본값(stretch)이면 이 래퍼가 카드 높이만큼
  // 늘어난다. 안의 사진은 크기가 고정이라 문구가 길어지는 순간 사진 아래에 빈 띠가 생기고
  // (thumbOverlay도 함께 늘어나 어둡게 깔린다), 사진 높이로 잡아 두면 문구 길이와 무관하게 맞는다.
  // 디자인도 사진을 카드 위쪽(paddingTop 14)에 붙여 둔다.
  thumbWrapper: { alignSelf: 'flex-start', borderRadius: 14, overflow: 'hidden' },
  // 디자인은 83이다(카드 높이 114 = paddingTop 14 + 83 + paddingBottom 17).
  // 73은 일부러 줄여 둔 값 — 짧은 기기에서 콘텐츠가 넘쳐 스크롤이 생기는 것을 막으려고 축하 이미지와
  // 함께 줄였다. 83으로 되돌리면 콘텐츠가 10 늘어 다시 스크롤이 생긴다(completeLayout.ts의
  // PLACE_CARD_HEIGHT도 이 73을 더한 값이라 함께 고쳐야 한다).
  //
  // 예전에는 "번들 폴백 사진(place-handam.png)도 83x83"이 근거의 한 축이었는데, 그 폴백을 걷어내고
  // 사진이 없는 자리를 스켈레톤으로 그리게 되면서 에셋 쪽 근거는 사라졌다. 남은 근거는 스크롤뿐이다.
  //
  // 사진 아래 여백은 크기가 아니라 위 thumbWrapper의 stretch가 원인이었다.
  thumb: { width: PLACE_THUMB.size, height: PLACE_THUMB.size },
  thumbOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  placeContent: { marginLeft: 16, flex: 1, paddingTop: 7 },
  distanceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  distanceText: { fontFamily: 'Pretendard-Regular', fontSize: 12, lineHeight: 18 },
  // placeCard 문구도 spec상 "동일"이라 색 고정
  placeDescription: {
    marginTop: 8,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#63584b',
  },

  // 디자인 하단 영역 705~800: 위 12 + 버튼 52 + 아래 31
  ctaWrapper: { paddingTop: 12, paddingHorizontal: 16 },
  // CTA 2개(보물찾기 완료)일 때만 가로 배치. 1개(문화 미션 완료)일 때는 기존처럼 column 유지 →
  // 부모 기본 alignItems:'stretch' 덕에 버튼이 전체 폭으로 늘어나 원본 Button 사용 시와 동일하게 보인다
  ctaWrapperRow: { flexDirection: 'row', gap: 8 },
  // Button 컴포넌트 md 사이즈(height52/paddingHorizontal24/radius999)를 그대로 복제해
  // 문화 미션 완료의 렌더 결과가 기존 <Button color="primary" .../> 사용 시와 동일하게 유지되도록 한다.
  // 보물찾기 완료는 ctaButtonHalf가 덧붙어 화면을 반씩 나눠 갖는다(spec: 160x52 = 360dp 기준의 반)
  ctaButton: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 두 버튼이 화면을 반씩 나눠 갖는다(고정 160은 360dp가 아닌 기기에서 넘치거나 남는다).
  // 좌우를 24→16으로 줄인 건 라벨 자리가 112뿐이라 "홈으로 이동하기"가 말줄임되던 걸 막기 위해서다.
  ctaButtonHalf: { flex: 1, paddingHorizontal: 16 },
  // Button.BUTTON_TEXT_STYLE과 동일. alignSelf:'stretch'는 커스텀 폰트(Pretendard) 폭이 잘못 측정돼
  // 줄바꿈되는 것을 막기 위한 것으로, Button/styles.ts의 동일 주석과 같은 이유다
  ctaButtonText: {
    alignSelf: 'stretch',
    textAlign: 'center',
    // 디자인은 700(Bold)이다. 문화·보물찾기·협동 완료 화면의 CTA 라벨이 모두 700으로 확인됐다.
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    lineHeight: 24,
  },
});
