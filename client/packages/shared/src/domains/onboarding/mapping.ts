/**
 * 온보딩 화면 선택 id ↔ 서버 enum 매핑.
 *
 * 화면 id는 사람이 읽기 좋은 소문자('rental')이고 서버 enum은 도메인 용어('CAR')라
 * 서로 다르다. Record<화면 id, 서버 enum>으로 선언하면 선택지가 늘었을 때
 * 매핑 누락이 컴파일 에러로 드러난다. Partial이나 인덱스 시그니처를 쓰면
 * undefined가 그대로 서버로 나간다.
 */
import type { Category } from '../../api/generated/category';
import type { Transportation } from '../../api/generated/transportation';
import type { TravelStyle } from '../../api/generated/travelStyle';
import type { SpareTimeStyleId, TransportationId, TravelInterestId } from './constants';

/** step1 — 제주에서 기대하는 것 */
export const CATEGORY_BY_INTEREST: Record<TravelInterestId, Category> = {
  photo: 'PHOTO',
  local: 'LOCAL',
  nature: 'NATURE',
  culture: 'CULTURE',
  cafe: 'CAFE',
  walk: 'WALKING',
};

/** step2 — 주 이동 수단. 화면의 '렌트카'가 서버에서는 CAR다 */
export const TRANSPORTATION_BY_ID: Record<TransportationId, Transportation> = {
  walk: 'WALK',
  bus: 'BUS',
  rental: 'CAR',
  bicycle: 'BICYCLE',
};

/** step3 — 자투리 시간 여행 방식 */
export const TRAVEL_STYLE_BY_ID: Record<SpareTimeStyleId, TravelStyle> = {
  here: 'RIGHT_HERE',
  wander: 'NEAR_AROUND',
  destination: 'NEAR_DESTINATION',
};

/**
 * 서버 enum → 화면 id 역매핑.
 *
 * 마이페이지 수정 화면이 GET /api/v1/users/me 응답(서버 enum)을 폼 초기값(화면 id)으로
 * 되돌릴 때 쓴다. 위 두 매핑과 반대 방향이라 값이 어긋나면 즉시 드러나도록 나란히 둔다.
 */
export const INTEREST_BY_CATEGORY: Record<Category, TravelInterestId> = {
  PHOTO: 'photo',
  LOCAL: 'local',
  NATURE: 'nature',
  CULTURE: 'culture',
  CAFE: 'cafe',
  WALKING: 'walk',
};

/** 화면은 단일 선택이지만 서버는 배열로 내려주므로, 호출부가 배열의 첫 값만 골라 이 맵에 넣는다 */
export const TRANSPORTATION_ID_BY_TRANSPORTATION: Record<Transportation, TransportationId> = {
  WALK: 'walk',
  BUS: 'bus',
  CAR: 'rental',
  BICYCLE: 'bicycle',
};
