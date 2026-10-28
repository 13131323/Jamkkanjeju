import { ImageSourcePropType } from 'react-native';
import { ButtonColor } from '@/components/Button/styles';
import { MissionReward, MissionStep } from '@/components/Mission/MissionIntroLayout/MissionIntroLayout';
import { MissionCompleteResultRow } from '@/components/Mission/MissionCompleteLayout/MissionCompleteLayout';
import { COOP_CELEBRATION_SIZE } from '@/components/Mission/MissionCompleteLayout/completeLayout';

/**
 * 미션 종류.
 * intro/complete 페이지가 하나로 합쳐지면서(prompt §6) 이 값으로 분기한다.
 */
export type MissionType = 'culture' | 'treasure' | 'coop';

/** 라우트 쿼리로 들어오는 값이 MissionType인지 검사한다 */
const MISSION_TYPES: readonly MissionType[] = ['culture', 'treasure', 'coop'];

// 문화·보물찾기는 같은 보상(돌담이/천원 쿠폰/+100P)을 준다 — quiz-mission-detail.tsx / treasure-hunt-intro.tsx 공통
const rewardDolmeong = require('@assets/images/reward-dolmeong.png');
const rewardCoupon = require('@assets/images/reward-coupon.png');
const rewardPoint = require('@assets/images/reward-point.png');
const MISSION_REWARDS: MissionReward[] = [
  { image: rewardDolmeong, label: '돌담이' },
  { image: rewardCoupon, label: '천원 쿠폰' },
  { image: rewardPoint, label: '+100P' },
];

/**
 * 보물찾기 인트로의 남은 보상 폴백.
 *
 * 이 목록은 GET /api/v1/missions/TREASURE/{id}가 실패했을 때만 보인다(성공하면 toMissionRewards가
 * remainingReward로 덮는다). 다만 보이는 순간 틀린 말을 하면 안 된다 — 라이브 서버가 주는 보물찾기
 * 보상은 캐릭터(예: 천지연 물방울)·+150P·3,000원 쿠폰이라 MISSION_REWARDS(문화 미션 기준의
 * 천원 쿠폰/+100P)와 다르다. 캐릭터 이름은 미션마다 달라 폴백으로 특정할 수 없어 종류만 말한다.
 */
const TREASURE_REWARDS: MissionReward[] = [
  { image: rewardDolmeong, label: 'AR 캐릭터' },
  { image: rewardCoupon, label: '3,000원 쿠폰' },
  { image: rewardPoint, label: '+150P' },
];

// 협동 미션은 첫 번째 보상 이미지가 다르다 — 디자인의 해당 슬롯은 돌담이가 아니라 귤 캐릭터다
// (Penpot 협동 intro > Frame 493 > JejuCelebrationImage, 배치 60x60 → 같은 크기로 내보냈다).
// 라벨은 디자인이 "돌 정령"이고 코드가 "돌담이"인데, 이미지와 별개인 문구 문제라 그대로 둔다.
const COOP_REWARDS: MissionReward[] = [{ image: require('@assets/images/coop-reward-tangerine.png'), label: MISSION_REWARDS[0].label }, MISSION_REWARDS[1], MISSION_REWARDS[2]];

// 축하 캐릭터는 완료 화면마다 다르다(Penpot의 JejuCelebrationImage가 서로 다른 에셋).
// 문화 = 갓 쓴 돌하르방(물음표 팻말), 보물찾기 = 보물상자에서 나침반을 들고 나오는 돌멩이 캐릭터.
const cultureCelebrationImage = require('@assets/images/mission-complete-character.png');
const treasureCelebrationImage = require('@assets/images/treasure-complete-character.png');
// 협동 완료 화면의 축하 이미지는 두 장이 겹쳐 있다 — 귤나무(162x162 @100,51)와
// 귤 캐릭터(89x89 @91,138). 배치 좌표대로 한 장(171x176)으로 합성해 내보냈다.
const coopCelebrationImage = require('@assets/images/coop-complete-character.png');
// 장소 사진에는 번들 폴백이 없다. 서버가 사진을 주지 않으면 그 자리를 스켈레톤으로 비운다
// (예전에는 한담 해안 사진 한 장을 모든 장소에 돌려 썼는데, 가 보지도 않은 곳의 사진이었다).

interface MissionIntroConfig {
  /** 화면 배경 그라데이션 (위 → 아래) */
  backgroundColors: [string, string, string];
  /** 상단 장식 원의 그라데이션 */
  circleColors: [string, string];
  titleLeading: string;
  titleTrailing: string;
  titleColor: string;
  decoImage: ImageSourcePropType;
  decoSize?: { width: number; height: number };
  /** 장식을 타이틀 위에 겹쳐 놓을 때의 배치. 자세한 규칙은 MissionIntroLayout의 같은 이름 prop 참고 */
  decoPlacement?: { left: number; top: number; rotation: number };
  /** 인라인 장식과 좌우 타이틀 사이 간격. 생략하면 레이아웃 기본값(6) */
  titleGap?: number;
  subtitle: string;
  subtitleColor: string;
  rewardBadgeColor: string;
  rewardBadgeTextColor: string;
  rewardLabelColor: string;
  rewardRingOuterColors: [string, string];
  rewardRingInnerColors: [string, string];
  rewards: MissionReward[];
  steps: MissionStep[];
  ctaText: string;
  ctaColor: ButtonColor;
}

/** MissionCompleteLayout의 ctas는 onPress(router 필요)가 있어 라우트 파일에서 조립한다. 여기서는 정적인 값만 둔다 */
interface MissionCompleteCtaConfig {
  text: string;
  backgroundColor: string;
  textColor: string;
  /** 지정하면 1px 테두리를 그린다(보물찾기 완료의 "방명록 남기기") */
  borderColor?: string;
}

interface MissionCompleteConfig {
  /** 화면 배경 그라디언트(세로, 위→아래) */
  backgroundColors: [string, string];
  celebrationImage: ImageSourcePropType;
  /** 축하 이미지 크기. 생략하면 150x150 (MissionCompleteLayout 기본값) */
  celebrationSize?: { width: number; height: number };
  /** 축하 이미지 라운딩. 생략하면 82 */
  celebrationRadius?: number;
  title: string;
  titleColor: string;
  subtitle: string;
  subtitleColor: string;
  /**
   * 보상 행 / 다음 장소 값의 폴백.
   *
   * 실제 값은 미션을 끝내는 응답에 들어 있고(constants/missionComplete.ts가 변환한다) 그쪽이 우선이다.
   * 여기 남은 디자인 값은 완료 API가 아직 없는 미션(보물찾기·협동)이 쓴다 — 그쪽이 붙으면 지울 수 있다.
   */
  resultRows: MissionCompleteResultRow[];
  resultBadgeBackgroundColor: string;
  resultBadgeTextColor: string;
  suggestion: string;
  placeDescription: string;
  distanceBadgeText: string;
  distanceBadgeBackgroundColor: string;
  distanceBadgeTextColor: string;
  /** ResultCard / placeCard 틴트 그림자 색 (Penpot ResultCard.shadows) */
  cardShadowColor: string;
  ctas: MissionCompleteCtaConfig[];
}

export const MISSION_INTRO_CONFIG: Record<MissionType, MissionIntroConfig> = {
  // 협동 미션 intro. Penpot "quiz-mission-detail"(타이틀 "함께 키우는 귤나무" 보드)에서 추출.
  // 퀴즈·보물찾기와 같은 골격(원 -91/542, 헤더존 100, CTA 699~800)이라 그대로 재사용한다.
  coop: {
    backgroundColors: ['#fef9e1', '#fdf2bb', '#fdf2bb'],
    circleColors: ['#fef9e1', '#fbe884'],
    titleLeading: '함께 키우는',
    titleTrailing: '귤나무',
    // 디자인은 #ff8f18(위) → #f2d21e(아래) 그라데이션 텍스트. RN Text는 그라데이션을 지원하지 않아 시작 색으로 대체
    titleColor: '#ff8f18',
    // Penpot "Tangerine"(3D 귤 렌더). 보이는 fill을 배치 크기 그대로 내보냈다 — 투명 배경이 유지된다.
    // 같은 shape에 fillOpacity 0인 흰 배경 버전이 하나 더 붙어 있으니 다시 내보낼 때 주의한다.
    decoImage: require('@assets/images/coop-title-deco.png'),
    // 디자인은 78x78인데 실기기에서 과하게 커 보여 70으로 줄였다(에셋도 같은 70x70로 내보냈다).
    decoSize: { width: 70, height: 70 },
    // 디자인의 Tangerine은 타이틀 행 안의 인라인 요소가 아니라 보드에 절대배치돼 타이틀 위로 겹쳐 있다.
    // 보드 기준 164.4,91.4 / rotation 13.9°. 타이틀 블록 콘텐츠 영역 기준으로 환산하면
    // left = 164.4 − 24(좌우 패딩) ≈ 140, top = 91.4 − 120(블록 상단 = 헤더 100 + marginTop 20) ≈ −29.
    // 78 → 70으로 줄인 만큼(4씩) 좌표를 밀어 중심을 유지한다.
    // 실기기에서 장식이 왼쪽으로 치우쳐 보여 디자인 환산값(140)에서 오른쪽으로 더 밀었다.
    // top도 환산값(−29)보다 아래에 둔다 — 그대로 두면 귤이 타이틀 위로 너무 떠서 헤더에 붙어 보인다
    decoPlacement: { left: 150, top: -10, rotation: 13.9 },
    subtitle: '일행과 역할을 나눠 귤나무를 완성해보세요!',
    subtitleColor: '#bd6005',
    rewardBadgeColor: '#fbe884',
    rewardBadgeTextColor: '#8b6f0f',
    rewardLabelColor: '#733705',
    rewardRingOuterColors: ['#fbe884', '#f2d21e'],
    rewardRingInnerColors: ['#fdf2bb', '#fbe884'],
    // 협동은 rewardDetail을 서버에서 받는다. 연동 전까지는 하드코딩 값을 쓴다.
    rewards: COOP_REWARDS,
    // 서버(GET /api/v1/missions/COOPERATIVE/{id})의 steps를 그대로 옮긴 값.
    // 디자인은 5단계였지만 서버는 4단계다 — "재료 인증하기"·"귤나무 완성"에 대응하는 단계가 없어
    // 실패 시 화면이 있지도 않은 순서를 안내하고 있었다.
    steps: [
      { number: 1, title: '일행 초대하기', description: '함께할 일행을 초대해요.' },
      { number: 2, title: '역할 배분받기', description: '참여한 각자에게 고유한 성장 역할을 배분받아요.' },
      { number: 3, title: '재료 찾으러 가기', description: '근처 장소로 이동해 배분받은 재료를 촬영해요.' },
      { number: 4, title: '보상받기', description: '귤나무를 완성하고 미션 보상을 받아요.' },
    ],
    ctaText: '시작하기',
    ctaColor: 'coop',
  },
  // quiz-mission-detail.tsx (CultureMission_detail_1)
  culture: {
    backgroundColors: ['#c5edfa', '#ecf9fd', '#caeefa'],
    circleColors: ['#c5edfa', '#75d4f4'],
    // 디자인 문구는 "오늘의 제주 퀴즈"였지만 서버 missionTitle이 "제주 문화 퀴즈"다.
    // 서버 값을 기준으로 맞춘다 — splitMissionTitle이 마지막 공백에서 자르므로 실제 렌더도 같은 분리가 된다.
    titleLeading: '제주 문화',
    titleTrailing: '퀴즈',
    // 디자인은 #063e51 → #0a8ab5 그라데이션 텍스트. RN Text는 그라데이션을 지원하지 않아 시작 색으로 대체
    titleColor: '#063e51',
    decoImage: require('@assets/images/quiz-title-deco.png'),
    // 디자인 말풍선은 55x50이다. 정사각 기본값(40x40)에 넣으면 위아래가 남거나 잘려 보여 비율을 맞춘다
    decoSize: { width: 44, height: 40 },
    subtitle: '제주의 퀴즈를 맞춰보세요.',
    subtitleColor: '#063e51',
    rewardBadgeColor: '#75d4f4',
    rewardBadgeTextColor: '#063e51',
    rewardLabelColor: '#076c8d',
    rewardRingOuterColors: ['#75d4f4', '#0a8ab5'],
    rewardRingInnerColors: ['#4dc9f2', '#076c8d'],
    rewards: MISSION_REWARDS,
    // 서버(GET /api/v1/missions/CULTURE/{id})의 steps를 그대로 옮긴 값이다.
    // 원래는 디자인에서 가져온 4단계였는데, 마지막 "보상 받기 / 모두 맞추면 10P 적립과 스탬프를
    // 받아요"가 사실과 달랐다 — 서버가 주는 보상은 100P고 스탬프라는 개념이 없다.
    // 이 목록은 응답이 실패했을 때만 보이지만, 보이는 순간 틀린 말을 하면 안 된다.
    steps: [
      { number: 1, title: '퀴즈 시작하기', description: '제주 방언, 엔터, 역사에 대한 퀴즈를 풀어보세요.' },
      { number: 2, title: '3문제 풀기', description: '각 문제마다 보기 중 정답을 선택하세요.' },
      { number: 3, title: '정답 확인', description: '문제를 다 풀면 결과를 확인할 수 있어요.' },
    ],
    ctaText: '퀴즈 시작하기',
    ctaColor: 'primary',
  },
  // 보물찾기 intro.
  // Penpot에서 이 프레임도 "quiz-mission-detail"이라는 이름으로 들어가 있다(퀴즈 intro를 복제해 만든 흔적).
  // 타이틀 "보물        찾기" 텍스트가 들어 있는 보드가 그것이고, 아래 값들은 거기서 가져왔다.
  treasure: {
    // quiz의 primary 계열(#c5edfa/#ecf9fd)에 대응하는 tertiary 100/50
    backgroundColors: ['#e2f2d2', '#f1f9e8', '#e2f2d2'],
    circleColors: ['#e2f2d2', '#b0da8b'],
    titleLeading: '보물',
    titleTrailing: '찾기',
    titleColor: '#2d4f14', // tertiary-900
    // Penpot 보물찾기 intro의 "image 57"(보물상자 + 돌하르방 + 나침반). 디자인 렌더 크기 75x75.
    decoImage: require('@assets/images/treasure-title-deco.png'),
    decoSize: { width: 75, height: 75 },
    // 장식이 커서 좌우 타이틀이 멀어 보인다 — 기본 6에서 좁혀 가운데로 모은다
    titleGap: 0,
    subtitle: '제주 곳곳에 숨겨진 보물을 찾아보세요.',
    subtitleColor: '#2d4f14',
    rewardBadgeColor: '#b0da8b', // tertiary-300
    rewardBadgeTextColor: '#2d4f14',
    rewardLabelColor: '#45741f', // tertiary-800
    rewardRingOuterColors: ['#b0da8b', '#5d992a'], // tertiary-300 → 700
    rewardRingInnerColors: ['#94cc65', '#45741f'], // tertiary-400 → 800
    rewards: TREASURE_REWARDS,
    steps: [
      { number: 1, title: '지도에서 위치 확인', description: '보물이 숨겨진 지역을 지도로 확인하세요' },
      { number: 2, title: '카메라로 주변 비추기', description: '반경 500m 안에 들어오면 보물이 나타나요' },
      { number: 3, title: '보물 획득하기', description: '반원 안에 보물을 넣고 탭하면 획득할 수 있어요' },
      { number: 4, title: '보상 받기', description: '보물 3개를 모두 찾으면 쿠폰과 포인트를 받아요' },
    ],
    ctaText: '미션 시작하기',
    // tertiary(600 #77be36)가 아니라 tertiary-900 #2d4f14.
    // 근거: 디자인 값 문서가 보물찾기 solid CTA를 #2d4f14로 못박고 있고("홈으로 이동하기"),
    // 퀴즈 intro가 CTA 색을 타이틀 색(#063e51)과 맞춘 것과도 일치한다(보물찾기 타이틀 = #2d4f14).
    ctaColor: 'tertiary-strong',
  },
};

/**
 * 완료 화면 설정.
 *
 * Record가 아니라 Partial로 두는 이유: 미션이 늘 때 완료 화면이 늘 함께 오지는 않는다.
 * 호출부(complete.tsx)가 부재를 방어한다.
 */
export const MISSION_COMPLETE_CONFIG: Partial<Record<MissionType, MissionCompleteConfig>> = {
  // Penpot "탐라로그 V2" > TogetherMission_complete 기준 (협동 step4)
  coop: {
    backgroundColors: ['#ffffff', '#fef9e1'],
    celebrationImage: coopCelebrationImage,
    // 디자인 배치는 171x176인데 표준 크기(164)에 곱해질 상자라 환산이 필요하다 — 근거는 completeLayout.ts
    celebrationSize: COOP_CELEBRATION_SIZE,
    // 합성 PNG의 배경이 투명해서 둥글릴 이유가 없다(둥글리면 나무 잎이 잘린다)
    celebrationRadius: 0,
    title: '귤나무 미션 완료',
    // 디자인은 #ff8f18 → #f2d21e 그라데이션 텍스트. RN Text는 그라데이션을 지원하지 않아 시작 색으로 대체
    titleColor: '#ff8f18',
    subtitle: '귤나무가 완성되었어요!',
    subtitleColor: '#463f36',
    resultRows: [
      { label: '포인트', badge: '+100P' },
      { label: '로컬 쿠폰', badge: '천원 쿠폰' },
      // 디자인의 이 칸은 "보물이"인데 보물찾기 완료 보드를 복제한 흔적이다 —
      // 협동 intro가 약속한 보상(COOP_REWARDS[0])과 맞지 않아 그쪽 라벨을 쓴다.
      // 서버의 rewardDetail.arCharacter.name이 붙으면 그 값으로 대체한다.
      { label: 'AR 캐릭터 도감', badge: COOP_REWARDS[0].label },
    ],
    resultBadgeBackgroundColor: '#fff3e6',
    resultBadgeTextColor: '#733705',
    suggestion: '다음 여행지를 추천드려요',
    placeDescription: '한담 해안 산책로에서 보물찾기 미션에 참여해보세요!',
    distanceBadgeText: '500m',
    // 협동 완료의 거리 배지는 미션 색이 아니라 중립 회색이다(Penpot Frame 399)
    distanceBadgeBackgroundColor: '#e2deda',
    distanceBadgeTextColor: '#463f36',
    // Penpot ResultCard.shadows — 협동만 주황 틴트다
    cardShadowColor: '#ffe2c2',
    // 디자인의 두 버튼은 fill이 비어 있다(미완성). 보물찾기 완료와 같은 구성으로 두고
    // solid 쪽만 협동 CTA 색(#ff8f18)을 쓴다 — 라벨 색(#ffffff / #222222)은 디자인 값이다.
    ctas: [
      {
        text: '방명록 남기기',
        backgroundColor: '#ffffff',
        textColor: '#222222',
        borderColor: '#dddddd',
      },
      {
        text: '홈으로 이동하기',
        backgroundColor: '#ff8f18',
        textColor: '#ffffff',
      },
    ],
  },
  // culture-mission-complete.tsx
  // Penpot "탐라로그 V2" > CultureMission_Complete 기준.
  // MissionCompleteLayout 추출 후에도 렌더 결과가 원본과 동일하도록 색/문구 값을 그대로 옮겼다.
  culture: {
    backgroundColors: ['#ffffff', '#ecf9fd'],
    celebrationImage: cultureCelebrationImage,
    title: '문화 미션 완료',
    // 디자인은 #021217 → #0a8ab5 그라데이션 텍스트. RN Text는 그라데이션을 지원하지 않아 시작 색으로 대체
    titleColor: '#021217',
    subtitle: '제주에서 쓸 수 있는 쿠폰과 포인트를 획득했어요!',
    subtitleColor: '#463f36',
    resultRows: [
      { label: '포인트', badge: '+100P' },
      { label: '로컬 쿠폰', badge: '천원 쿠폰' },
      { label: 'AR 캐릭터 도감', badge: '돌담이' },
    ],
    resultBadgeBackgroundColor: '#ecf9fd',
    resultBadgeTextColor: '#076c8d',
    suggestion: '다음 여행지를 추천드려요',
    placeDescription: '한담 해안 산책로에서 보물찾기 미션에 참여해보세요!',
    distanceBadgeText: '500m',
    distanceBadgeBackgroundColor: '#c5edfa',
    distanceBadgeTextColor: '#076c8d',
    // Penpot CultureMission_Complete의 ResultCard/placeCard 그림자 색 (primary-100)
    cardShadowColor: '#c5edfa',
    ctas: [
      {
        text: '홈으로 이동하기',
        // 기존 Button color="primary" 렌더와 동일하도록 SOLID_STYLES.primary 값을 그대로 사용
        backgroundColor: '#063e51',
        textColor: '#ffffff',
      },
    ],
  },
  // treasure-hunt-complete.tsx
  // Penpot "탐라로그 V2" > Mission_Complete(보물찾기) 기준
  treasure: {
    backgroundColors: ['#ffffff', '#f1f9e8'],
    celebrationImage: treasureCelebrationImage,
    title: '보물 찾기 미션 완료',
    // spec에 제목 색 차이가 명시되지 않아 CultureMission_Complete와 동일한 값을 쓴다
    titleColor: '#021217',
    subtitle: '제주에서 쓸 수 있는 쿠폰과 포인트를 획득했어요!',
    subtitleColor: '#463f36',
    // 보물찾기는 이제 서버가 지급한 보상을 그대로 보여준다(missionComplete.ts의 toCompleteResultRows가
    // 진행도 저장 응답들에서 누적한 값을 변환한다). 이 행들은 그 값을 못 받았을 때만 보이는 폴백인데,
    // 디자인 목업 값(+100P / 천원 쿠폰 / "보물이")은 라이브 서버(+150P / 3,000원 쿠폰 / 천지연 물방울)와
    // 달라 그대로 두면 화면이 받지도 않은 보상을 말하게 된다. 캐릭터 이름은 미션마다 달라
    // 폴백으로 특정할 수 없어 종류만 말한다.
    resultRows: [
      { label: '포인트', badge: '+150P' },
      { label: '로컬 쿠폰', badge: '3,000원 쿠폰' },
      { label: 'AR 캐릭터 도감', badge: 'AR 캐릭터' },
    ],
    resultBadgeBackgroundColor: '#f1f9e8',
    resultBadgeTextColor: '#45741f',
    suggestion: '다음 여행지를 추천드려요',
    placeDescription: '한담 해안 산책로에서 보물찾기 미션에 참여해보세요!',
    distanceBadgeText: '500m',
    distanceBadgeBackgroundColor: '#e2f2d2',
    distanceBadgeTextColor: '#45741f',
    // Penpot Mission_Complete의 ResultCard/placeCard 그림자 색 (tertiary-100).
    // 문화 미션의 #c5edfa와 다르다 — 두 화면이 같은 값을 쓰고 있던 것이 오류였다
    cardShadowColor: '#e2f2d2',
    ctas: [
      {
        text: '방명록 남기기',
        // TODO: 방명록 화면이 아직 없어 연결 대상 미정. 화면이 생기면 router.push로 교체
        backgroundColor: '#ffffff',
        textColor: '#222222',
        borderColor: '#dddddd',
      },
      {
        text: '홈으로 이동하기',
        // tertiary-900
        backgroundColor: '#2d4f14',
        textColor: '#ffffff',
      },
    ],
  },
};

/**
 * 보상을 하나도 받지 못한 완료 화면의 부제.
 *
 * 미션을 중단해도 서버는 완료로 처리하지만, 맞힌 문제가 없으면 지급 항목이 전부 null로 온다.
 * 그때 config의 부제("쿠폰과 포인트를 획득했어요!")를 그대로 쓰면 화면이 거짓말을 한다.
 */
export const MISSION_COMPLETE_NO_REWARD_SUBTITLE = '아쉽지만 이번에 받은 보상은 없어요.';

/** 알 수 없거나 없는 값이면 culture로 폴백 */
export function resolveMissionType(value: string | undefined): MissionType {
  // 값이 늘 때마다 삼항식을 겹치면 읽기 어려워지므로 허용 집합으로 검사한다
  return MISSION_TYPES.find((type) => type === value) ?? 'culture';
}
