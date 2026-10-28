import { StyleSheet } from 'react-native';

/**
 * Penpot "탐라로그 V2" TreasureHunt_step2_camera-verification(x=29823) 기준.
 *
 * 이전 버전은 뷰파인더(반원 인증 영역 + 코너 브라켓 + 크로스헤어)가 있는 옛 시안을 따랐는데,
 * 확정 시안은 **카메라가 화면 전체를 채우고** 그 위에 진행도 카드와 안내 토스트만 떠 있는 구조다.
 * 반원·크로스헤어·"반경 500m" 라벨은 확정 시안에 없어 전부 제거했다.
 *
 * 디자인의 상태바 44는 실기기 insets.top으로, 하단 홈 인디케이터 영역은 insets.bottom으로 대체한다.
 */

/** NavigationHeader 높이. 디자인 0,44 360x56 */
export const CAMERA_HEADER_HEIGHT = 56;

/** 헤더 아래 진행도 카드까지의 간격. 디자인 y=118 - (44 + 56) */
export const CAMERA_PROGRESS_TOP_GAP = 18;

export const treasureHuntCameraStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // LiveCameraFeed: 디자인은 -19,0 472x800으로 화면보다 넓게 깔려 있다(카메라 비율 때문).
  // 실제로는 프리뷰가 화면을 꽉 채우면 되므로 전면 절대배치로 둔다.
  cameraArea: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // #000000@0.35 — 흰 보물 에셋과 흰 카드가 밝은 배경에서도 읽히도록 깔리는 딤
  cameraDim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },

  // 헤더 영역. 디자인 y=44는 iOS 상태바라 고정값으로 두면 안드로이드에서 겹친다 —
  // top은 0으로 두고 호출부가 safe-area inset을 paddingTop으로 준다.
  headerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },

  // Frame 530(진행도 카드) 자리. 좌우 16, 높이는 카드가 스스로 44를 갖는다
  progressWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
  },

  // PinLabel: 보물 이미지 아래에 붙는 순번 라벨.
  // 디자인은 가까운 보물(123px)이 90x28 / 16·1.5, 먼 보물(61px)이 68x22 / 12·1.5로 크기가 다르다.
  // 아이콘 크기가 거리로 보간되므로 라벨도 두 프리셋으로 나눠 호출부가 고른다.
  pinLabel: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#111111',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pinLabelTextNear: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
  pinLabelTextFar: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#ffffff',
  },

  // BottomArea: 디자인 62,709 238x58 / #ffffff@0.72 / r=30 / pad 12·24·12·14 / row gap 10.
  //
  // 알약을 absolute로 두고 left/right를 잡으면 폭이 화면 전체로 늘어나 디자인(문구 길이만큼)과 달라진다.
  // 그래서 래퍼만 좌우로 펼치고 알약은 내용 크기로 두면서 가운데 정렬한다.
  guidePillWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  guidePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    // 토스트(components/Toast/styles.ts의 guideToast)와 같은 이유로 그림자를 걸지 않는다 —
    // 반투명 배경 뒤의 elevation이 비쳐 가장자리와 가운데 색이 갈린다
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  guidePillIcon: {
    width: 34,
    height: 34,
  },
  guidePillText: {
    flexShrink: 1,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#0e0d0b',
    textAlign: 'center',
  },

  // 카메라/위치 권한 거부 시 대체 화면. 디자인이 없어 앱 톤(warm-neutral)만 맞춘다.
  permissionFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  permissionFallbackTitle: {
    marginTop: 16,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#2a2621', // warm-neutral-900
    textAlign: 'center',
  },
  permissionFallbackDescription: {
    marginTop: 8,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#63584b', // warm-neutral-700
    textAlign: 'center',
  },
  permissionFallbackButton: {
    marginTop: 24,
    alignSelf: 'stretch',
  },
});
