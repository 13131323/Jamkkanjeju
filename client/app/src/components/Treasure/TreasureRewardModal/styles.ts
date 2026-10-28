import { StyleSheet } from 'react-native';

/**
 * Penpot "탐라로그 V2" > TreasureHunt_modal 기준.
 * 좌표는 spec 문서(docs/superpowers/specs/2026-08-15-treasure-hunt-design-values.md)의 360x800 화면 기준
 * 절대값을 그대로 사용한다 — 같은 spec의 step2 VerificationRadiusCircle 등도 동일한 방식(절대 배치)으로
 * 재현하도록 안내되어 있어 이 모달도 같은 규칙을 따른다.
 */
export const styles = StyleSheet.create({
  // 스크림(딤 배경): 디자인(모달 보드 자체)에는 없다. 실제로는 step2 카메라 화면 위에 모달로 뜨므로
  // 뒷 배경과 구분되도록 추가함 — spec에도 "[디자인에 없음, 추가 필요]"로 명시된 항목
  scrim: {
    flex: 1,
    // Rectangle 67 — #000000@0.7
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  // Container: x=32, y=235, 296x331 (Penpot에서 재확인한 값 — 이전 273은 오차였다).
  // 가로는 (360-296)/2=32로 정확히 대칭이라 alignSelf:'center'로 화면 폭에 관계없이 중앙 정렬되게 하고,
  // 세로는 화면 중앙이 아닌 디자인의 고정 오프셋(235)을 그대로 절대 배치한다
  container: {
    position: 'absolute',
    top: 235,
    alignSelf: 'center',
    width: 296,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 32,
  },
  // 우상단 X 닫기 아이콘: 디자인에 없고 prompt가 추가를 지시함.
  // top16/right16 24x24 영역은 보상 이미지 원(컨테이너 기준 x104~192, y32~120)과 겹치지 않는다
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 보상 이미지 자리: 디자인의 88x88 원(x=104, y=32)이 차지하던 칸을 그대로 쓴다.
  // 원 자체는 그리지 않는다 — 디자인에 남아 있는 #77be36 → #a0d45e 그라디언트 fill은
  // fillOpacity가 0이라 화면에 안 보이는 레이어다. 이미지는 배경 없이 그대로 놓인다.
  rewardImageWrapper: {
    width: 88,
    height: 88,
    // 이미지가 이 칸보다 크다(104x105). 잘리면 안 되므로 넘치게 둔다
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 디자인상 이미지는 원 기준 (-8,-8) 104x105 — 칸보다 사방 8씩 넓다
  rewardImage: {
    width: 104,
    height: 105,
  },
  // 제목: 컨테이너 y=120, h=47 (이미지 바로 아래, 간격 없음 — 32(padTop)+88(이미지)=120)
  titleWrapper: {
    height: 47,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 21,
    // Penpot lineHeight 1.43 → 21 * 1.43 ≈ 30
    lineHeight: 30,
    textAlign: 'center',
    color: '#2a2621',
  },
  // 설명: 컨테이너 y=167, h=84 (제목 바로 아래, 간격 없음 — 120+47=167), 디자인 원문 기준 2줄
  descriptionWrapper: {
    height: 84,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  description: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    // Penpot lineHeight 1.6 → 16 * 1.6 ≈ 26
    lineHeight: 26,
    textAlign: 'center',
    color: '#463f36',
  },
  // CTA: x=24,y=251, 248x48. 컨테이너 폭296 - 좌우 24*2 = 248.
  // alignSelf:'stretch'로 컨테이너의 기본 alignItems:'center'를 이 요소만 무시하고 폭을 채운다
  // (QuizResultModal의 버튼 래핑과 동일한 패턴)
  ctaWrapper: {
    alignSelf: 'stretch',
    paddingHorizontal: 24,
  },
});
