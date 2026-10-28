/**
 * 온보딩 고정값.
 *
 * 각 단계의 선택지 id와 문구를 여기 모은다. id는 그대로 서버로 나가는 값이라
 * 화면 파일에 흩어져 있으면 web/app이 서로 다른 문자열을 보내게 된다.
 * 아이콘(RN require / next Image)은 플랫폼마다 로딩 방식이 달라 각 패키지가 id로 매핑한다.
 */

/** step1에서 고를 수 있는 최대 개수 */
export const MAX_TRAVEL_INTEREST_SELECT = 3;

export interface OnboardingOption<TId extends string> {
  id: TId;
  title: string;
  subtitle: string;
}

/** step1 — 제주에서 기대하는 것 (다중 선택) */
export const TRAVEL_INTEREST_OPTIONS = [
  { id: 'photo', title: '인생 사진', subtitle: '특별한 순간을 사진으로' },
  { id: 'local', title: '제주 로컬 발견', subtitle: '숨은 가게와 골목 탐방' },
  { id: 'nature', title: '자연에서 쉬기', subtitle: '오름, 숲, 해변에서 보내기' },
  { id: 'culture', title: '제주 문화 체험', subtitle: '제주 문화와 이야기를 만나요' },
  { id: 'cafe', title: '감성 카페 가기', subtitle: '뷰 좋은 카페에서 여유 즐기기' },
  { id: 'walk', title: '골목길 산책', subtitle: '발 닿는대로 걸어다니기' },
] as const satisfies readonly OnboardingOption<string>[];

export type TravelInterestId = (typeof TRAVEL_INTEREST_OPTIONS)[number]['id'];

/** step2 — 주 교통수단 (단일 선택) */
export const TRANSPORTATION_OPTIONS = [
  { id: 'walk', title: '도보', subtitle: '가까운 곳을 천천히 걸으며 여행해요.' },
  { id: 'bus', title: '버스', subtitle: '대중교통으로 제주를 여행해요.' },
  { id: 'rental', title: '렌트카', subtitle: '원하는 곳을 자유롭게 이동해요.' },
  { id: 'bicycle', title: '자전거', subtitle: '해안길과 마을을 여유롭게 둘러봐요.' },
] as const satisfies readonly OnboardingOption<string>[];

export type TransportationId = (typeof TRANSPORTATION_OPTIONS)[number]['id'];

/** step3 — 자투리 시간을 보내는 방식 (단일 선택) */
export const SPARE_TIME_STYLE_OPTIONS = [
  { id: 'here', title: '여기서 바로', subtitle: '움직이지 않고 즐기는 제주 콘텐츠' },
  { id: 'wander', title: '발길 닿는 대로', subtitle: '근처를 추천받을래요.' },
  { id: 'destination', title: '목적지 근처', subtitle: '갈 곳은 정했어요.' },
] as const satisfies readonly OnboardingOption<string>[];

export type SpareTimeStyleId = (typeof SPARE_TIME_STYLE_OPTIONS)[number]['id'];

/** 결과 화면 분기 — "이대로 추천받기" / "나중에 할게요" */
export const ONBOARDING_RESULT_MODE = {
  RECOMMEND: 'recommend',
  SKIP: 'skip',
} as const;

export type OnboardingResultMode = (typeof ONBOARDING_RESULT_MODE)[keyof typeof ONBOARDING_RESULT_MODE];

/** 온보딩 총 단계 수 (진행 인디케이터) */
export const ONBOARDING_TOTAL_STEPS = 3;
