/**
 * GET /api/v1/missions/{missionType}/{missionId}/completion — 보물찾기 완료 화면.
 *
 * **이 파일의 타입은 손으로 쓴 것이다.** 서버에 아직 이 엔드포인트가 없어서
 * (`/openapi.json`의 미션 경로에 completion이 없다) orval이 생성해 주지 못한다.
 * 그래서 생성 디렉터리(`api/generated`) 밖에 둔다 — orval은 `clean: true`라
 * 생성 경로에 손으로 넣은 파일을 다음 `pnpm generate`에서 지운다.
 *
 * 서버가 구현되면 이 파일의 **타입 선언만** 지우고 생성본을 import하도록 바꾼다.
 * 아래 매핑 함수들은 화면용 변환이라 그대로 남는다.
 *
 * 근거 문서: API 명세(요청 query latitude/longitude, path missionType=TREASURE·missionId).
 */
import { formatDistanceLabel } from '../home/missionCard';
import type { ISODateString } from '../../types';

/** 천 단위 구분자. Intl에 의존하지 않는다 — RN·Node의 ICU 구성에 따라 결과가 달라지면 테스트가 흔들린다 */
function withThousandsSeparator(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface TreasureRewardArCharacter {
  id: number;
  name: string;
  imageUrl: string;
  isReceived: boolean;
}

export interface TreasureRewardPoint {
  amount: number;
  isReceived: boolean;
}

export interface TreasureRewardCoupon {
  couponLocation: string;
  couponPrice: number;
  isReceived: boolean;
}

/** 추천 미션에 설정된 전체 보상 + 현재 사용자의 종류별 수령 여부. 해당 보상이 없으면 null */
export interface TreasureRewardDetail {
  arCharacter: TreasureRewardArCharacter | null;
  point: TreasureRewardPoint | null;
  coupon: TreasureRewardCoupon | null;
}

export interface CompletedTreasureMission {
  missionId: number;
  missionType: 'TREASURE';
  /** KST 기준 offset 없는 ISO 8601 */
  completedAt: ISODateString;
  /** 캐릭터 보상이 없거나 연결된 캐릭터가 없으면 null */
  arCharacterImageUrl: string | null;
}

export interface NearbyTreasureMission {
  missionId: number;
  missionType: 'TREASURE';
  locationId: number;
  missionTitle: string;
  representativeImageUrl: string | null;
  distanceMeter: number;
  durationMinutes: number;
  rewardDetail: TreasureRewardDetail;
}

export interface ReceivedCoupon {
  couponLocation: string;
  couponPrice: number;
  /** 사용처 이름과 일치하는 LOCATION이 없으면 셋 다 null */
  locationId: number | null;
  locationAddress: string | null;
  locationImageUrl: string | null;
}

export interface TreasureCompletionResponse {
  completedMission: CompletedTreasureMission;
  /** 최대 3개. 없으면 빈 배열(생략되지 않는다) */
  nearbyTreasureMissions: NearbyTreasureMission[];
  /** 모든 미션 유형에서 받은 쿠폰. 없으면 빈 배열 */
  receivedCoupons: ReceivedCoupon[];
}

/**
 * 미션 홈 응답의 남은 보상 — 완료 판정에 필요한 최소 형태만 본다.
 * `isReceived`가 없는 것은 미션 홈의 remainingReward가 "남은" 보상만 주기 때문이다.
 */
interface RemainingRewardLike {
  arCharacter?: unknown | null;
  point?: unknown | null;
  coupon?: unknown | null;
}

/**
 * 보물찾기 완료 화면으로 갈지 판정한다.
 *
 * 서버가 완료 여부를 직접 주지 않아 "남은 보상이 세 종류 모두 없음"으로 대신 읽는다.
 * 세 개를 OR로 묶으면 보상이 남았는데 완료 화면이 뜨고, 그 상태로 completion API를
 * 부르면 409 TREASURE_ITEMS_REMAINING이 온다.
 *
 * 응답 전(`undefined`)을 완료로 오해하지 않도록 remainingReward 자체가 없으면 false다.
 * 반면 **개별 필드**는 생성 타입이 optional(`arCharacter?`)이라 서버가 아예 빼고 보낼 수 있어
 * null과 undefined를 같은 "없음"으로 읽는다 — `=== null`만 보면 필드가 생략된 응답에서
 * 완료를 놓친다.
 */
export function isRewardExhausted(remainingReward: RemainingRewardLike | null | undefined): boolean {
  if (!remainingReward) return false;
  return remainingReward.arCharacter == null && remainingReward.point == null && remainingReward.coupon == null;
}

/** 근처 미션 카드의 "1.2km · 도보 18분" 한 줄 */
export function formatNearbyMissionDistanceLabel(distanceMeter: number, durationMinutes: number): string {
  // formatDistanceLabel은 값이 없을 때만 null이고, 여기서는 필수 필드라 항상 문자열이다
  return `${formatDistanceLabel(distanceMeter) ?? '0m'} · 도보 ${durationMinutes}분`;
}

/**
 * 근처 미션 카드의 초록 보상 배지 문구.
 *
 * 디자인에는 "300P" 한 종류만 있는데 API는 보상 세 종류를 준다.
 * 포인트 → 쿠폰 → 캐릭터 순으로 대체해 배지가 빈 칸으로 남지 않게 한다.
 * (난이도 배지는 이 화면에서 뺐다 — API가 난이도를 반환하지 않는다)
 */
export function resolveRewardBadgeLabel(rewardDetail: TreasureRewardDetail): string | null {
  if (rewardDetail.point) return `${withThousandsSeparator(rewardDetail.point.amount)}P`;
  if (rewardDetail.coupon) return formatCouponBenefit(rewardDetail.coupon.couponPrice);
  if (rewardDetail.arCharacter) return rewardDetail.arCharacter.name;
  return null;
}

/** 근처 미션 카드 한 칸이 쓰는 값 */
export interface NearbyMissionCard {
  missionId: number;
  /** 장소 상세로 보낼 때 쓴다 */
  locationId: number;
  title: string;
  distanceLabel: string;
  /** 보상이 없으면 null — 배지를 그리지 않는다 */
  rewardLabel: string | null;
  /** 대표 이미지가 없으면 null — 호출부가 폴백 이미지를 고른다 */
  photoUrl: string | null;
}

export function toNearbyMissionSummaries(missions: NearbyTreasureMission[]): NearbyMissionCard[] {
  return missions.map((mission) => ({
    missionId: mission.missionId,
    locationId: mission.locationId,
    title: mission.missionTitle,
    distanceLabel: formatNearbyMissionDistanceLabel(mission.distanceMeter, mission.durationMinutes),
    rewardLabel: resolveRewardBadgeLabel(mission.rewardDetail),
    photoUrl: mission.representativeImageUrl,
  }));
}

/**
 * 쿠폰 카드 **첫째 줄**(아이콘과 같은 행)에 들어가는 고정 문구.
 *
 * 서버가 주는 건 사용처 이름(`couponLocation`) 하나뿐이라 이 줄에는 출처가 없다.
 * 예전에는 사용처가 위, 이 문구가 아래("제주 인기 소품샵")였는데 순서를 뒤집어
 * 분류가 위·가게 이름이 아래로 왔고, 문구도 소품샵에 한정되지 않는 말로 바뀌었다.
 */
export const COUPON_CATEGORY_LABEL = '제주 인기 가게';

/** 쿠폰 혜택 문구("1,000원 할인") */
export function formatCouponBenefit(couponPrice: number): string {
  return `${withThousandsSeparator(couponPrice)}원 할인`;
}

/**
 * 쿠폰 사용 화면의 "사용조건" 목록.
 *
 * 첫 줄만 쿠폰 금액을 쓰고 나머지는 모든 쿠폰이 공유하는 고정 문구다(서버에 필드가 없다).
 * 디자인은 1,000원 쿠폰에 "2,000원 이상"으로 적혀 있어 최소 결제액이 금액의 배수일 수
 * 있는데, 서버가 그 값을 주지 않아 확정할 수 없다 — 배수가 맞다면 이 함수만 고치면 된다.
 */
export function toCouponUsageConditions(couponPrice: number): string[] {
  return [`${withThousandsSeparator(couponPrice)}원 이상 부터 사용 가능합니다.`, '매장에서 결제할 때 쿠폰을 보여주면 사용 가능합니다.', '유효기간은 26년 12월 31일까지입니다.'];
}

/** 완료 화면의 "받은 보상" 쿠폰 카드 한 칸 */
export interface RewardCouponCard {
  /** React key 겸 로컬 사용 상태 저장 key */
  couponId: string;
  /** 카드 첫째 줄. 고정 문구(COUPON_CATEGORY_LABEL)라 쿠폰마다 달라지지 않는다 */
  categoryLabel: string;
  /** 카드 둘째 줄. 실제 가게 이름이다 — 서버의 couponLocation */
  storeName: string;
  benefit: string;
  couponPrice: number;
  locationId: number | null;
  locationAddress: string | null;
  locationImageUrl: string | null;
}

/**
 * 받은 쿠폰 목록 → 카드.
 *
 * 응답에 쿠폰 id도 미션 id도 없어서 식별자를 만들어 쓴다. 문서상 "같은 사용처·같은 금액"이
 * 서로 다른 미션에서 나오면 별개 항목으로 유지되므로 목록 위치를 key에 섞어야 겹치지 않는다.
 */
export function toRewardCoupons(coupons: ReceivedCoupon[]): RewardCouponCard[] {
  return coupons.map((coupon, index) => ({
    couponId: `${coupon.couponLocation}-${coupon.couponPrice}-${index}`,
    categoryLabel: COUPON_CATEGORY_LABEL,
    storeName: coupon.couponLocation,
    benefit: formatCouponBenefit(coupon.couponPrice),
    couponPrice: coupon.couponPrice,
    locationId: coupon.locationId,
    locationAddress: coupon.locationAddress,
    locationImageUrl: coupon.locationImageUrl,
  }));
}
