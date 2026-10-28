import { create } from 'zustand';
import { EMPTY_ONBOARDING_SELECTION, MAX_TRAVEL_INTEREST_SELECT, type OnboardingSelection, type SpareTimeStyleId, type TransportationId, type TravelInterestId } from '@packages/shared';
import { toggleSelection } from '@/components/Onboarding/selection';

/**
 * 온보딩 step1~3의 선택값을 result 화면까지 들고 간다.
 *
 * 라우터 params로 넘기면 배열을 문자열로 직렬화했다가 되돌려야 하고,
 * 뒤로 가기로 단계를 오갈 때 이전 선택이 복원되지 않는다.
 */
interface OnboardingStore extends OnboardingSelection {
  toggleTravelInterest: (id: TravelInterestId) => void;
  setTransportation: (id: TransportationId) => void;
  setSpareTimeStyle: (id: SpareTimeStyleId) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...EMPTY_ONBOARDING_SELECTION,

  toggleTravelInterest: (id) =>
    set((state) => ({
      travelInterests: toggleSelection(state.travelInterests, id, MAX_TRAVEL_INTEREST_SELECT),
    })),

  setTransportation: (id) => set({ transportation: id }),
  setSpareTimeStyle: (id) => set({ spareTimeStyle: id }),
  reset: () => set({ ...EMPTY_ONBOARDING_SELECTION }),
}));

/** PATCH 바디를 만들 때 쓰는 선택값 스냅샷 (렌더 밖에서도 읽을 수 있게) */
export function getOnboardingSelection(): OnboardingSelection {
  const { travelInterests, transportation, spareTimeStyle } = useOnboardingStore.getState();
  return { travelInterests, transportation, spareTimeStyle };
}
