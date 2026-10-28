import type { Nullable } from '../../types/common';
import type { SpareTimeStyleId, TransportationId, TravelInterestId } from './constants';

/** 온보딩 진행 중 화면들이 모아두는 선택 상태 */
export interface OnboardingSelection {
  travelInterests: TravelInterestId[];
  transportation: Nullable<TransportationId>;
  spareTimeStyle: Nullable<SpareTimeStyleId>;
}

export const EMPTY_ONBOARDING_SELECTION: OnboardingSelection = {
  travelInterests: [],
  transportation: null,
  spareTimeStyle: null,
};
