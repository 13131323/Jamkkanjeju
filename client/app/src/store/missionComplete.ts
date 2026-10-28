import { create } from 'zustand';
import type { MissionCompleteResult } from '@/constants/missionComplete';
import type { MissionType } from '@/constants/mission';

/**
 * 방금 끝낸 미션의 완료 응답.
 *
 * 완료 화면은 `replace`로 진입하고 조회 API가 따로 없다 — 보상과 다음 장소는 미션을 끝내는
 * 그 요청의 응답에만 담겨 온다. 그래서 미션 화면이 이동 직전에 여기 넣어 두고 완료 화면이 꺼내 쓴다.
 * (라우트 파라미터는 문자열만 실을 수 있어 객체를 JSON으로 접었다 펴야 한다)
 *
 * `mission`을 함께 들고 있는 이유: 스토어는 앱이 살아 있는 동안 남으므로, 완료 API가 아직 없는
 * 미션(보물찾기·협동)으로 완료 화면에 들어왔을 때 직전 문화 미션의 보상이 그대로 보일 수 있다.
 * 완료 화면은 미션 종류가 일치할 때만 값을 쓴다.
 */
interface MissionCompleteStore {
  mission: MissionType | null;
  result: MissionCompleteResult | null;

  /** 미션 화면이 완료 화면으로 넘어가기 직전에 호출한다 */
  save: (mission: MissionType, result: MissionCompleteResult) => void;
  clear: () => void;
}

export const useMissionCompleteStore = create<MissionCompleteStore>((set) => ({
  mission: null,
  result: null,

  save: (mission, result) => set({ mission, result }),

  clear: () => set({ mission: null, result: null }),
}));
