import type { OnboardingSaveRequest } from '../../api/generated/onboardingSaveRequest';
import { CATEGORY_BY_INTEREST, TRANSPORTATION_BY_ID, TRAVEL_STYLE_BY_ID } from './mapping';
import type { OnboardingSelection } from './types';

/**
 * 온보딩 선택값 → PATCH /api/v1/users/me 바디.
 *
 * "나중에 할게요"는 선택값이 없으므로 빈 객체({})를 보낸다.
 * 고르지 않은 항목은 키를 넣지 않는다 — null을 보내면 서버가 "지움"으로 해석할 수 있다.
 * transportation과 travelStyle은 화면에서 단일 선택이지만 서버는 배열을 받는다.
 */
export function buildOnboardingSaveRequest(
  selection: OnboardingSelection | null,
): OnboardingSaveRequest {
  if (!selection) return {};

  const body: OnboardingSaveRequest = {};
  if (selection.travelInterests.length > 0) {
    body.categories = selection.travelInterests.map((id) => CATEGORY_BY_INTEREST[id]);
  }
  if (selection.transportation) {
    body.transportation = [TRANSPORTATION_BY_ID[selection.transportation]];
  }
  if (selection.spareTimeStyle) {
    body.travelStyle = [TRAVEL_STYLE_BY_ID[selection.spareTimeStyle]];
  }
  return body;
}
