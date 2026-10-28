/** web/app이 함께 쓰는 원시 타입들 */

export type Nullable<T> = T | null;

/** ISO 8601 문자열 (예: 2026-08-25T09:00:00.000Z) */
export type ISODateString = string;

/** 위경도 한 쌍 — 브릿지 payload와 보물찾기 좌표가 공통으로 쓴다 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}
