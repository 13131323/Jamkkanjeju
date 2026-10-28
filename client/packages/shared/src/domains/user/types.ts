/**
 * 사용자 도메인 타입.
 *
 * 요청/응답 계약은 OpenAPI에서 생성한 타입(GeneratedApi.OnboardingSaveRequest,
 * OnboardingSaveResponse, UserResponse)을 쓴다. 여기 있는 것들은 화면이
 * 서버 응답과 별개로 다루는 도메인 표현이다.
 */
import type { Nullable } from '../../types/common';

/** AR 캐릭터 (온보딩 결과 화면의 캐릭터 카드) */
export interface ArCharacter {
  id: number;
  name: string;
  imageUrl: string;
}

/** 온보딩 선택값으로 산출된 여행 스타일 */
export interface UserTravelStyle {
  id: number;
  /** 결과 화면 제목으로 쓰는 유형명 */
  userType: string;
  /** 유형 설명 문단 */
  typeDescription: string;
  /** 서버가 '#'를 포함해서 내려준다. 화면에서 다시 붙이지 않는다 */
  hashtags: string[];
}

export interface User {
  id: number;
  arCharacter: ArCharacter;
  /** 온보딩을 건너뛰면 null */
  userTravelStyle: Nullable<UserTravelStyle>;
}
