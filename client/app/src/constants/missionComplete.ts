/**
 * 미션 완료 응답 → MissionCompleteLayout prop 변환.
 *
 * 서버는 지급된 보상과 다음 추천 장소만 내려준다. 색·축하 이미지·CTA는 디자인 값이라
 * MISSION_COMPLETE_CONFIG에 그대로 남고, 여기서 만드는 값이 그 위에 덮인다.
 */
import type { GeneratedApi } from '@packages/shared';
import type { MissionCompleteResultRow } from '@/components/Mission/MissionCompleteLayout/MissionCompleteLayout';

/**
 * 완료 화면이 필요한 응답 조각.
 *
 * 완료를 알리는 API가 여러 개인데(문화 진행도 저장 / 문화 중단, 앞으로 붙는 보물찾기·협동)
 * 화면이 쓰는 건 이 두 필드뿐이다. 응답 타입마다 변환 함수를 만들지 않도록 공통 입력으로 좁혔다.
 *
 * 두 필드를 nullable로 두는 이유는 진행도 저장 응답이다 — IN_PROGRESS면 둘 다 null이고,
 * 중단 응답은 둘 다 항상 객체다(중단은 완료 처리라 다음 장소를 반드시 준다).
 */
export interface MissionCompleteResult {
  reward: GeneratedApi.GrantedRewardResponse | null;
  nextLocation: GeneratedApi.NextLocationResponse | null;
  /**
   * 방금 끝낸 **장소**의 id. 완료 화면의 "방명록 남기기"가 이 값을 방명록에 붙인다.
   *
   * `nextLocation.id`와 헷갈리면 안 된다 — 그쪽은 **다음** 추천 장소라 방명록을 붙이면
   * 가 보지도 않은 곳에 글이 달린다.
   *
   * 서버가 완료 응답에 주는 값이 아니라 **미션을 진행하는 화면이 들고 있던 값**이다.
   *   - 보물찾기: 진행도 생성 응답의 `location.locationId`(treasure.tsx)
   *   - 문화: 장소가 없는 미션이라 항상 null이다
   *   - 협동: 협동 API가 현재 장소 id를 주지 않아 지금은 null이다
   * null이면 방명록이 좌표만 가진 형태로 열린다(사용자가 장소명을 직접 적는다).
   */
  completedLocationId: number | null;
}

/**
 * 실제 지급된 보상만 ResultCard 행으로 만든다.
 *
 * 서버는 지급하지 않은 항목을 null로 준다. null을 걸러내므로 아무것도 못 받고 끝난 미션
 * (예: 한 문제도 못 맞히고 중단)은 빈 배열이 되고, 그 처리는 호출부가 정한다.
 *
 * 행 순서와 라벨은 디자인 고정값이다(포인트 → 로컬 쿠폰 → AR 캐릭터 도감).
 */
export function toCompleteResultRows(reward: GeneratedApi.GrantedRewardResponse): MissionCompleteResultRow[] {
  const rows: MissionCompleteResultRow[] = [];

  const { point, coupon, arCharacter } = reward;

  // 0P도 서버가 내려주면 지급된 보상이다 — null(미지급)과 구분해야 하므로 falsy 검사를 쓰지 않는다.
  if (point !== null && point !== undefined) {
    rows.push({ label: '포인트', badge: `+${point}P` });
  }
  if (coupon) {
    // 디자인의 "천원 쿠폰"은 실제 지급 금액으로 대체한다. 인트로의 보상 배지(toMissionRewards)와
    // 같은 형식이라 두 화면이 같은 쿠폰을 같은 문구("1,000원 쿠폰")로 보여준다.
    rows.push({ label: '로컬 쿠폰', badge: `${coupon.couponPrice.toLocaleString('ko-KR')}원 쿠폰` });
  }
  if (arCharacter) {
    rows.push({ label: 'AR 캐릭터 도감', badge: arCharacter.name });
  }

  return rows;
}

/**
 * 장소 카드의 거리 배지 문구("500m").
 *
 * 1km부터는 소수 첫째 자리까지 km로 줄인다 — 배지 폭이 좁아 "12345m"는 넘친다.
 * 값이 통신으로 들어오는 숫자라 유효하지 않으면 "0m"로 막는다("NaNm"가 그려지면 안 된다).
 */
export function formatDistanceBadge(distanceMeter: number): string {
  if (!Number.isFinite(distanceMeter) || distanceMeter < 0) return '0m';
  if (distanceMeter < 1000) return `${Math.round(distanceMeter)}m`;

  // 100m 단위로 반올림한 뒤 10으로 나눈다 — toFixed(1)과 달리 "1.0km" 같은 뒷자리 0이 생기지 않는다.
  return `${Math.round(distanceMeter / 100) / 10}km`;
}

/** 다음 장소 미션 유형 → 배지 문구. MISSION_TYPE_INPUT과 짝이 되는 역방향 표기다 */
const NEXT_MISSION_LABEL: Record<GeneratedApi.AppMissionModelsMissionType, string> = {
  CULTURE: '문화',
  COOPERATIVE: '협동',
  TREASURE: '보물찾기',
};

/**
 * 장소 카드의 안내 문구.
 *
 * 미션이 붙은 장소는 그 미션으로 유도하고("...에서 보물찾기 미션에 참여해보세요!"),
 * mission이 null이면 권할 미션이 없으므로 방문만 권한다.
 */
export function toNextPlaceDescription(nextLocation: GeneratedApi.NextLocationResponse): string {
  const { locationTitle, mission } = nextLocation;

  if (!mission) return `${locationTitle}에 방문해보세요!`;

  return `${locationTitle}에서 ${NEXT_MISSION_LABEL[mission.missionType]} 미션에 참여해보세요!`;
}

export interface MissionCompleteContent {
  resultRows: MissionCompleteResultRow[];
  /**
   * 화면 맨 위 축하 이미지로 쓸 서버 캐릭터 URL.
   *
   * 지급된 AR 캐릭터가 곧 그 미션의 축하 캐릭터다. null이면(캐릭터를 못 받았거나 응답이 없으면)
   * 레이아웃이 번들 에셋으로 그린다.
   */
  celebrationUri: string | null;
  /**
   * 장소 카드 사진 URL. 없으면(null) 레이아웃이 그 자리를 스켈레톤으로 그린다.
   *
   * 번들 폴백 이미지를 넘기지 않는 이유: 어느 장소든 같은 사진 한 장을 돌려 쓰면 가 보지도
   * 않은 곳의 사진을 그 장소의 사진처럼 보여주게 된다. 빈 자리로 두는 편이 정직하다.
   */
  placePhotoUrl: string | null;
  placeDescription: string;
  distanceBadgeText: string;
  /**
   * 장소 카드를 눌렀을 때 열 장소 상세(`/place`)의 id.
   *
   * null이면 열 곳이 없으므로 카드를 누를 수 없게 둔다 — 완료 API가 없는 미션의 폴백 카드가 그렇다.
   */
  placeId: number | null;
}

/**
 * 서버 응답이 없을 때 쓰는 디자인 값.
 *
 * celebrationUri·placeId·placePhotoUrl은 응답에만 있는 값이라 폴백이 존재하지 않는다(전부 null로 떨어진다).
 */
export type MissionCompleteFallback = Omit<MissionCompleteContent, 'celebrationUri' | 'placeId' | 'placePhotoUrl'>;

/**
 * 서버 값을 디자인 폴백 위에 덮는다.
 *
 * 필드가 각각 따로 폴백하는 이유: 보물찾기·협동은 완료 API가 아직 없어 result가 null로 들어오고,
 * 문화는 완전한 응답으로 들어온다. 한쪽만 온 응답(다음 장소는 있는데 사진이 없는 경우 등)도 있다.
 */
/**
 * 이 변환이 실제로 읽는 필드만 좁힌 입력.
 *
 * `completedLocationId`는 스토어에는 있지만 여기서 쓰지 않는다 — 그 값은 방명록 CTA가 직접
 * 읽는다. 이 함수가 내보내는 `placeId`는 **다음** 추천 장소라 둘을 섞으면 안 된다.
 */
export type MissionCompleteContentInput = Pick<MissionCompleteResult, 'reward' | 'nextLocation'>;

export function toMissionCompleteContent(result: MissionCompleteContentInput | null, fallback: MissionCompleteFallback): MissionCompleteContent {
  // 응답이 없으면 장소 사진도 없다 — 레이아웃이 그 자리를 스켈레톤으로 그린다
  if (!result) return { ...fallback, celebrationUri: null, placeId: null, placePhotoUrl: null };

  const { reward, nextLocation } = result;

  return {
    // reward가 객체면 빈 배열도 그대로 쓴다 — "아무것도 지급되지 않았다"와 "아직 모른다"는 다르다.
    // 여기서 폴백으로 넘기면 받지 않은 +100P를 받은 것처럼 보여주게 된다.
    resultRows: reward ? toCompleteResultRows(reward) : fallback.resultRows,
    // 빈 문자열도 "없음"으로 본다 — 협동 mock의 arCharacter.imageUrl이 ''이고, `?? null`만으로는
    // 걸러지지 않아 {uri: ''}로 Image를 그리게 된다(로드 실패 후에야 번들 에셋으로 되돌아간다)
    celebrationUri: reward?.arCharacter?.imageUrl || null,
    // 장소 사진이 없는 곳도 있다. 빈 문자열도 없음으로 본다 — {uri: ''}로 Image를 그리면 안 된다
    placePhotoUrl: nextLocation?.locationImageUrl || null,
    placeDescription: nextLocation ? toNextPlaceDescription(nextLocation) : fallback.placeDescription,
    distanceBadgeText: nextLocation ? formatDistanceBadge(nextLocation.distanceMeter) : fallback.distanceBadgeText,
    placeId: nextLocation?.id ?? null,
  };
}
