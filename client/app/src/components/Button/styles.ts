import { TextStyle, ViewStyle } from 'react-native';

// xs: 협동 step1 member-card의 "거절" / "수락". 카드 안에 들어가는 24px 알약 버튼이다
export type ButtonSize = 'xs' | 'sm' | 'md';
// primary: quiz-mission-detail "퀴즈 시작하기" / CultureMission_Complete "홈으로 이동하기" (#063e51)
// tertiary-strong: 보물찾기 미션 CTA. tertiary(600 #77be36)로는 디자인의 #2d4f14(900)를 낼 수 없어 따로 둔다
// — docs/superpowers/specs/2026-08-15-treasure-hunt-design-values.md "기존 Button 컴포넌트와 불일치 주의" 항목.
// coop: 협동 미션 CTA. Penpot '함께 키우는 귤나무' intro의 Button fill #ff8f18
// coop-neutral: 협동 step1의 "수락"(solid #4e4e4e) / "거절"(투명 + #dddddd 테두리 + #7c6e5e 라벨).
// cool-neutral과 값이 다르다 — 수락은 #333333이 아니라 #4e4e4e고, 거절 라벨은 #222222가 아니라 #7c6e5e다
export type ButtonColor = 'primary' | 'tertiary' | 'tertiary-strong' | 'cool-neutral' | 'warm-neutral' | 'coop' | 'coop-neutral';

/**
 * 색은 className이 아니라 style 객체로 둔다.
 * NativeWind는 소스에 등장한 클래스만 빌드 타임에 생성하므로, 새 색 클래스를 추가하면
 * Metro 캐시가 갱신되기 전까지 조용히 무시된다. 버튼 상태색은 그 실패에 민감해서 style로 고정한다.
 */
interface ButtonVariantStyle {
  container: ViewStyle;
  text: TextStyle;
}

export const SOLID_STYLES: Record<ButtonColor, ButtonVariantStyle> = {
  primary: { container: { backgroundColor: '#063e51' }, text: { color: '#ffffff' } },
  tertiary: { container: { backgroundColor: '#77be36' }, text: { color: '#ffffff' } },
  'tertiary-strong': { container: { backgroundColor: '#2d4f14' }, text: { color: '#ffffff' } },
  'cool-neutral': { container: { backgroundColor: '#333333' }, text: { color: '#ffffff' } },
  'warm-neutral': { container: { backgroundColor: '#2a2621' }, text: { color: '#ffffff' } },
  coop: { container: { backgroundColor: '#ff8f18' }, text: { color: '#ffffff' } },
  // Penpot AcceptButton
  'coop-neutral': { container: { backgroundColor: '#4e4e4e' }, text: { color: '#ffffff' } },
};

// CultureMission_detail_1 "힌트": 흰 배경 + primary-400 테두리 + primary-800 라벨
export const OUTLINE_STYLES: Record<ButtonColor, ButtonVariantStyle> = {
  primary: {
    container: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#4dc9f2' },
    text: { color: '#076c8d' },
  },
  tertiary: {
    container: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#77be36' },
    text: { color: '#77be36' },
  },
  'tertiary-strong': {
    container: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#2d4f14' },
    text: { color: '#2d4f14' },
  },
  // Cancel_Confirmation_Modal "잠깐 쉴게요"가 유일한 사용처이고, 그 디자인이
  // cool-neutral-200(#dddddd)을 쓴다. 이전 값 #c6c6c6(300)은 쓰는 곳이 없던 추정치였다.
  'cool-neutral': {
    container: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dddddd' },
    text: { color: '#222222' },
  },
  'warm-neutral': {
    container: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#bbb2a7' },
    text: { color: '#2a2621' },
  },
  coop: {
    container: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ff8f18' },
    text: { color: '#ff8f18' },
  },
  // Penpot 거절 버튼(Frame 581)은 fill이 없다 — 카드 배경(#ffffff@0.8)이 그대로 비쳐야 한다
  'coop-neutral': {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#dddddd' },
    text: { color: '#7c6e5e' },
  },
};

// CultureMission_detail_fail의 비활성 "다음": #aaaaaa 배경 + 흰 라벨
export const DISABLED_STYLE: ButtonVariantStyle = {
  container: { backgroundColor: '#aaaaaa', borderWidth: 0 },
  text: { color: '#ffffff' },
};

/**
 * "+ 동반 일행 초대하기"용 점선 버튼.
 *
 * RN의 borderStyle: 'dashed'는 **Android에서 borderRadius가 0이 아니면 실선으로 렌더된다.**
 * 이 앱의 버튼은 전부 radius 999라 정면으로 걸리므로, 테두리는 react-native-svg로
 * strokeDasharray를 써서 직접 그린다. 아래 값은 그 SVG와 라벨이 함께 참조한다.
 */
export const DASHED_BUTTON_STYLE = {
  height: 52,
  borderRadius: 14,
  /** SVG stroke가 도형 중앙에 걸리므로 잘리지 않도록 절반을 안쪽으로 들인다 */
  strokeWidth: 1,
  dashPattern: '10 6',
  /** Penpot DashedInviteButton의 흰색 30% 배경 */
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  /**
   * Penpot DashedInviteButton 라벨은 14/20 SemiBold다 — 다른 버튼의 16/24와 다르다.
   * bold prop보다 뒤에 적용해 이 크기를 고정한다(디자인에 굵은 변형이 없다).
   */
  label: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 20 },
} as const;

export const DASHED_STYLES: Record<ButtonColor, { stroke: string; text: TextStyle }> = {
  primary: { stroke: '#4dc9f2', text: { color: '#076c8d' } },
  tertiary: { stroke: '#77be36', text: { color: '#77be36' } },
  'tertiary-strong': { stroke: '#2d4f14', text: { color: '#2d4f14' } },
  'cool-neutral': { stroke: '#c6c6c6', text: { color: '#222222' } },
  'warm-neutral': { stroke: '#bbb2a7', text: { color: '#2a2621' } },
  // Penpot DashedInviteButton: stroke #ff8f18 1px dashed, 라벨도 같은 #ff8f18
  coop: { stroke: '#ff8f18', text: { color: '#ff8f18' } },
  'coop-neutral': { stroke: '#dddddd', text: { color: '#7c6e5e' } },
};

export const GHOST_STYLES: Record<ButtonColor, TextStyle> = {
  primary: { color: '#063e51' },
  tertiary: { color: '#77be36' },
  'tertiary-strong': { color: '#2d4f14' },
  'cool-neutral': { color: '#888888' },
  'warm-neutral': { color: '#63584b' },
  coop: { color: '#bd6005' },
  'coop-neutral': { color: '#7c6e5e' },
};

/**
 * md 버튼 높이. 하단 CTA의 높이이기도 해서 다른 요소(토스트)가 이 위로 비켜 갈 때 참조한다.
 * BUTTON_SIZE_STYLES에서 꺼내 쓰지 않는 이유: ViewStyle의 height는 문자열도 될 수 있어
 * 계산에 바로 못 쓴다.
 */
export const BUTTON_MD_HEIGHT = 52;

/**
 * 폭이 고정된 2분할 CTA에만 쓰는 좌우 여백.
 *
 * md의 24는 360dp 화면(디자인 기준)에서 라벨에 112dp만 남긴다 — 좌우 16 여백과 가운데 8 간격을
 * 뺀 160dp짜리 버튼에서 24를 두 번 빼면 112다. "보물이랑 사진찍기"는 Pretendard-Bold 16px에서
 * 114.3dp라(assets/fonts/Pretendard-Bold.ttf의 hmtx 실측) 2dp 차이로 말줄임됐다.
 * 20으로 줄이면 120dp가 남아 한 줄에 들어간다.
 *
 * 버튼 폭은 부모가 flex로 정하므로 여백을 줄여도 버튼 크기·높이는 그대로고 라벨 자리만 넓어진다.
 * md 기본값(24)을 그대로 두는 이유는 폭이 auto인 버튼에서는 이 값이 곧 버튼 크기이기 때문이다.
 */
export const BUTTON_COMPACT_PADDING_HORIZONTAL = 20;

export const BUTTON_SIZE_STYLES: Record<ButtonSize, ViewStyle> = {
  // Penpot AcceptButton / Frame 581: 24 높이, 좌우 14, radius 999
  xs: { height: 24, paddingHorizontal: 14, borderRadius: 999 },
  sm: { height: 48, paddingHorizontal: 20, borderRadius: 999 },
  md: { height: BUTTON_MD_HEIGHT, paddingHorizontal: 24, borderRadius: 999 },
};

/**
 * 사이즈별 라벨 보정.
 *
 * BUTTON_TEXT_STYLE의 16/24는 sm·md 기준이고, xs는 디자인이 12/16 Medium이다.
 * 높이 24 안에 24 행간을 넣으면 라벨이 잘리므로 사이즈가 라벨까지 정한다.
 */
export const BUTTON_SIZE_LABEL_STYLES: Partial<Record<ButtonSize, TextStyle>> = {
  xs: { fontFamily: 'Pretendard-Medium', fontSize: 12, lineHeight: 16 },
};

export const GRADIENT_COLORS: Record<ButtonColor, [string, string]> = {
  primary: ['#076c8d', '#063e51'],
  tertiary: ['#5a9a2f', '#45741f'],
  'tertiary-strong': ['#45741f', '#2d4f14'],
  'cool-neutral': ['#6b7280', '#4b5563'],
  'warm-neutral': ['#63584b', '#2a2621'],
  coop: ['#ff8f18', '#bd6005'],
  'coop-neutral': ['#4e4e4e', '#2a2621'],
};

export const GRADIENT_BUTTON_STYLE = {
  height: 52,
  paddingHorizontal: 24,
  borderRadius: 14,
} as const;

// height를 고정하면 라벨이 한 줄을 넘겼을 때 넘친 줄이 잘려나가므로 padding으로 높이를 만든다(8+20+8=36).
export const GHOST_BUTTON_STYLE = {
  paddingVertical: 8,
  paddingHorizontal: 8,
  borderRadius: 8,
} as const;

// alignSelf: 'stretch' — 부모의 items-center 때문에 Text가 auto-width가 되면
// 커스텀 폰트(Pretendard) 폭이 잘못 측정돼 라벨이 줄바꿈되는 경우가 있다.
// 폭을 버튼 전체로 늘리고 textAlign으로 가운데 정렬해 측정에 의존하지 않게 한다.
export const BUTTON_TEXT_STYLE: TextStyle = {
  alignSelf: 'stretch',
  textAlign: 'center',
  fontFamily: 'Pretendard-Medium',
  fontSize: 16,
  // 디자인의 버튼 라벨은 전부 16/24 (lineHeight 1.5)
  lineHeight: 24,
};
