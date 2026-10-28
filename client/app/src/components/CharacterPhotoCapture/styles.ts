import { StyleSheet } from 'react-native';
import type { ImageStyle } from 'react-native';
import type { ButtonColor } from '@/components/Button/styles';

/**
 * 촬영 화면의 강조색. **어느 미션에서 찍는지**에 따라 셔터와 "완료"가 같은 색을 쓴다(사용자 지시).
 *
 * 색을 화면마다 흩어 두지 않고 여기 한 곳에 짝으로 둔다 — 셔터만 바꾸고 "완료"를 잊으면
 * 한 화면 안에서 두 버튼이 다른 색이 된다.
 *
 * 채움/테두리 조합은 보물찾기 값(tertiary-50 + tertiary-600)의 관계를 그대로 따른다:
 * **아주 옅은 배경 + 진한 4px 테두리**.
 * - treasure: tertiary-50 `#f1f9e8` + tertiary-600 `#77be36` (Penpot TreasureHunt_step2 원본)
 * - coop: 협동 오렌지 `#ff8f18`. 이 색은 팔레트에 단계가 없어서 배경만 같은 밝기로 맞춰 얹었다
 * - character: primary-50 `#ecf9fd` + primary-400 `#4dc9f2` (마이페이지 도감 "함께 사진 찍기")
 */
export type PhotoCaptureAccent = 'treasure' | 'coop' | 'character';

export const CAPTURE_ACCENTS: Record<PhotoCaptureAccent, { shutterFill: string; shutterRing: string; confirmButton: ButtonColor }> = {
  treasure: { shutterFill: '#f1f9e8', shutterRing: '#77be36', confirmButton: 'tertiary-strong' },
  coop: { shutterFill: '#fff4e8', shutterRing: '#ff8f18', confirmButton: 'coop' },
  character: { shutterFill: '#ecf9fd', shutterRing: '#4dc9f2', confirmButton: 'primary' },
};

/**
 * 캐릭터 합성 촬영 화면의 공용 스타일.
 *
 * 값의 출처는 Penpot "TreasureHunt_step2_camera-verification"(x=30613, 360x800)이다 —
 * 보물찾기 step3에서 처음 나왔지만 화면 구조(풀블리드 카메라 + 캐릭터 오버레이 + 하단 셔터 패널)
 * 자체는 미션에 매인 것이 아니라서 여기로 옮겨 왔다. 미션 전용 크롬(헤더·진행도 카드)은
 * 호출부가 slot으로 넣으므로 이 파일에 없다.
 *
 * 디자인의 44px 상태바는 insets.top으로, 하단 홈 인디케이터 영역은 insets.bottom으로 대체한다.
 */

/**
 * 캡처 대상 크기는 상수가 아니라 **실제 화면 크기를 실측해서** 쓴다.
 *
 * 예전에는 디자인 값(360x800)을 그대로 박아 뒀는데, 실기기 화면 비율은 기기마다 달라서
 * (예: 360x780) 찍는 화면 / 미리보기 / 갤러리에 저장된 사진의 비율이 서로 어긋났다.
 * 지금은 루트 뷰의 onLayout으로 잰 dp에 캡처 배율을 곱해 오프스크린 합성 뷰 크기로 쓰고,
 * 미리보기도 같은 영역을 꽉 채워 보여준다 — 세 화면이 같은 프레임을 보게 하는 것이 목적이다.
 *
 * 그 배율은 고정값이 아니다. 뷰의 dp에 **기기 화면 배율까지 곱해진 픽셀 크기**가
 * 곧 비트맵 크기라, 고정 3배는 화면 픽셀 면적의 9배(흔한 기기에서 23MP / 약 89MiB)짜리
 * 비트맵을 만든다. `compositeCaptureScale.ts`가 픽셀 한도에서 역산한 배율을 준다.
 */

/** 캐릭터 오버레이 위치·크기(dp). 디자인 image 64 = -59,324 325x324.
 *  화면 오버레이와 합성 캡처가 같은 값을 써야 "본 그대로" 저장된다. */
export const CHARACTER_LEFT = -59;
export const CHARACTER_TOP = 324;
export const CHARACTER_WIDTH = 325;
export const CHARACTER_HEIGHT = 324;

/**
 * 오프스크린 합성 뷰 안의 캐릭터 위치·크기.
 *
 * 화면 오버레이와 같은 dp 좌표에 캡처 배율을 곱한다 — 어긋나면 "본 것과 다른 사진"이 저장된다.
 * 배율이 기기마다 달라져 StyleSheet 상수로 둘 수 없으므로 함수로 만든다.
 */
export function compositeCharacterStyle(scale: number): ImageStyle {
  return {
    position: 'absolute',
    left: CHARACTER_LEFT * scale,
    top: CHARACTER_TOP * scale,
    width: CHARACTER_WIDTH * scale,
    height: CHARACTER_HEIGHT * scale,
  };
}

export const characterPhotoCaptureStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },

  // 권한 대기/거부 상태 공용 레이아웃
  centerMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  centerMessageText: {
    textAlign: 'center',
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#463f36',
  },
  centerMessageButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#77be36', // tertiary-600
  },
  centerMessageButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#ffffff',
  },

  // LiveCameraFeed: -19,0 472x800 → 화면 전체를 꽉 채우는 풀블리드 카메라.
  // 이 RN 버전의 StyleSheet 타입에는 absoluteFillObject가 없어(absoluteFill만 존재) 직접 풀어 썼다.
  cameraFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  /**
   * 캐릭터를 얹지 않는 화면(협동 "재료 찾기")의 카메라 배경.
   *
   * 위 `cameraFill`의 검정은 캐릭터 합성 화면의 어두운 톤에 맞춘 값이고, **프리뷰가 비어 있는
   * 순간에만 보인다**(카메라 준비 중, 촬영 중 프리뷰 스톨). 재료를 찍는 화면에서는 그 순간이
   * 그대로 "찍고 나면 화면이 어두워진다"로 보이므로 배경색을 두지 않고 화면 흰 배경이 비치게 한다.
   * 딤(dimOverlay)도 같은 이유로 이 화면에서는 그리지 않는다.
   */
  cameraFillPlain: {
    backgroundColor: 'transparent',
  },
  // 카메라 위에 얹는 35% 검정 딤(fill=#000000@0.35)
  dimOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#000000',
    opacity: 0.35,
  },
  // 캐릭터 이미지: 디자인 값 그대로 left=-59, top=324(스크린 절대좌표) — 카메라가 풀블리드가 되며
  // 스크린 자체가 곧 디자인 좌표계와 같아졌다. 좌측으로 넘치는 배치는 스펙 그대로.
  characterOverlay: {
    position: 'absolute',
    left: CHARACTER_LEFT,
    top: CHARACTER_TOP,
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
  },
  characterOverlayImage: {
    width: '100%',
    height: '100%',
  },

  // 화면 하단 스택(안내 토스트 + 하단 패널)을 통째로 화면 바닥에 고정한다.
  // 두 요소 사이 30px 간격은 디자인의 토스트(y=518~576)와 패널(y=606) 사이 간격 그대로다.
  bottomStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 30,
  },
  // BottomArea(floating) — 48,518 266x58, fill #ffffff@0.72 r=30, pad 12,24,12,14, row gap 10

  // BottomArea(panel) — 0,606 360x194, fill #ffffff, column gap16, pad 16,24,*,24, align=center.
  // 하단 padding(디자인 24)은 실제 홈 인디케이터 영역(insets.bottom)으로 대체한다.
  bottomPanel: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 16,
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    // 디자인의 #e5e7eb 테두리는 stroke opacity가 0으로 보인다 — Penpot 연결이 끊겨 직접 확인은 못 했고
    // step0의 동일 패턴(Frame 530/539, opacity 0 확인됨)에서 추론했다. 실제 보이지 않으므로 그리지 않는다.
    // [재검증 필요]
  },
  bottomLabels: {
    alignItems: 'center',
    gap: 4,
  },
  bottomTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    lineHeight: 26, // 18 * 1.4444
    color: '#0e0d0b',
    textAlign: 'center',
  },

  // ShutterOuter: 76x76 bg #f1f9e8(tertiary-50) border #77be36(tertiary-600) 4px radius 38
  // 색(테두리·채움)은 화면이 정한다 — CAPTURE_ACCENTS 참고
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterDisabled: {
    opacity: 0.5,
  },
  // ShutterInner: 56x56 bg #ffffff border #e5e7eb 1px radius 28
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },

  // 오프스크린 합성 캡처 대상.
  // 왜 "화면 밖으로 밀어내기"를 택했는가(opacity:0이 아니라):
  // Android는 성능 최적화로 alpha(불투명도) 0인 뷰의 실제 드로우 콜을 하드웨어 렌더 파이프라인에서
  // 생략하는 경우가 보고되어 있다(react-native-view-shot 이슈에서도 반복 등장하는 "빈 이미지" 증상).
  // 반면 좌표만 화면 밖으로 밀어낸 뷰는 alpha=1로 정상 렌더 경로를 그대로 타면서 화면에는 보이지 않으므로
  // captureRef가 실제 픽셀을 읽어올 가능성이 더 높다고 판단했다.
  // [미검증 — 실기기에서 두 방식을 직접 비교하지 못했다. 문제가 재현되면 opacity 방식으로 교체 후 재확인]
  // 크기(width/height)는 실측값이라 호출부에서 합친다
  /**
   * 오프스크린 합성 뷰.
   *
   * **배경을 검정으로 두지 않는다.** 예전 값(#000000)은 사진이 이 판을 완전히 덮는다는 전제였는데,
   * RN Android의 `Image`는 기본적으로 300ms 페이드인으로 그려진다(fadeDuration). `onLoad`는
   * 디코딩이 끝난 시점에 오고 페이드는 그때부터 시작하므로, 곧바로 캡처하면 **반투명한 사진이
   * 검은 판 위에 얹힌** 상태가 찍힌다 — 저장된 사진과 미리보기가 통째로 어두워 보이던 원인이다
   * (기기에서 저장본을 꺼내 확인했다: 피사체는 정상 노출인데 화면 전체에 고른 검은 막이 덮여 있었다).
   *
   * 페이드 자체는 `fadeDuration={0}`으로 껐고(근본 원인), 배경도 흰색으로 바꿔 둔다 —
   * 혹시 남는 순간이 있어도 어둡게가 아니라 밝게 비치는 편이 사진에 덜 해롭다.
   */
  offscreenCapture: {
    position: 'absolute',
    top: 0,
    left: -10000,
    backgroundColor: '#ffffff',
  },
  captureBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  // 촬영 직후 미리보기 (prompt §9 "캐릭터와 사진 찍었을 때 미리보기 화면 제공").
  //
  // 디자인에 전용 프레임이 없다. 찍을 때와 같은 프레임을 그대로 보여주는 것이 요구사항이라
  // 사진을 화면 전체에 절대배치로 깔고 헤더·버튼을 그 위에 얹는다. 합성 사진의 비율이 화면과
  // 같으므로 cover로 깔아도 잘리거나 레터박스가 생기지 않는다.
  previewImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  /**
   * 버튼 줄. **배경판을 두지 않는다** — 버튼만 사진 위에 떠 있어야 한다.
   *
   * 예전에는 `rgba(255,255,255,0.92)` 패널을 깔았는데, 그만큼 사진 아래쪽이 가려졌다.
   * 사진은 `previewImage`가 이미 화면 전체(absolute inset 0)를 덮고 있어서 배경만 걷어내면
   * 그 자리에 사진이 그대로 이어진다 — 사진 영역·비율·resizeMode는 손댈 것이 없다.
   *
   * 가독성은 버튼 알약 자체가 책임진다. 두 버튼 모두 **불투명**이라 뒤 사진이 비치지 않는다:
   * - "다시 찍기" = outline/cool-neutral → #ffffff 채움 + #dddddd 1px 테두리 + #222222 라벨
   * - "완료"     = solid/tertiary-strong → #2d4f14 채움 + #ffffff 라벨
   * 즉 밝은 사진 위에서도 라벨 대비는 배경판이 있을 때와 동일하다(패널은 원래 사진을 가릴 뿐
   * 버튼 대비에 기여하지 않았다). 그래서 패널을 걷어내며 버튼 쪽에 보정을 더하지 않았다.
   */
  previewBottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  previewButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // 두 버튼이 반씩 나눠 갖는다(디자인 quiz-mission-detail-complete의 CTA 2개 배치와 같은 비율)
  previewButton: {
    flex: 1,
  },
});
