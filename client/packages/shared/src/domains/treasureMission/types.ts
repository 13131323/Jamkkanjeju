import type { Coordinates, ISODateString } from '../../types/common';

/**
 * 보물찾기 미션 타입.
 *
 * 서버 연동 전이라 아직 API 응답이 없다. 화면이 필요한 필드를 먼저 확정해두고
 * app의 mock 상수(app/src/constants/treasureHunt.ts)가 이 타입을 그대로 만족하게 한다 —
 * 실제 응답이 붙을 때 화면 코드를 다시 손대지 않기 위한 배치다.
 */

/**
 * 보물 아이템 종류. 획득 모달의 CTA가 종류에 따라 갈린다.
 * - CHARACTER: "캐릭터와 사진찍기" → step3(촬영)
 * - COUPON / POINT: "받기" → 모달만 닫고 획득 처리
 */
export const TREASURE_TYPE = {
  CHARACTER: 'CHARACTER',
  COUPON: 'COUPON',
  POINT: 'POINT',
} as const;

export type TreasureType = (typeof TREASURE_TYPE)[keyof typeof TREASURE_TYPE];

export interface TreasureItem {
  treasureId: string;
  /** step0 지도 마커 배지와 step2 PinLabel에 "N번째 보물"로 표시된다 */
  order: number;
  treasureType: TreasureType;
  coords: Coordinates;
  /** 획득 모달 제목 */
  title: string;
  /** 획득 모달 설명 문구 */
  description: string;
}

export interface TreasurePlace {
  placeId: string;
  /** step0 헤더의 장소명. 예: "서귀포시 성산읍 오조포구" */
  name: string;
  /** 장소 한 줄 소개. TREASURE_PLACE_SUMMARY_MAX_LENGTH를 넘지 않는다 */
  summary: string;
  coords: Coordinates;
}

export interface TreasureMissionDetail {
  missionId: string;
  place: TreasurePlace;
  treasures: TreasureItem[];
  /** 완료한 적이 없으면 null */
  completedAt: ISODateString | null;
}
