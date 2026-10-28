import { create } from 'zustand';
import type { GeneratedApi } from '@packages/shared';
import { isTreasureRunComplete, mergeGrantedRewards, withFoundTreasureIndex } from '@/constants/treasureMission';

/**
 * 보물찾기 진행도.
 *
 * step0(지도) ↔ step2(카메라) ↔ step3(촬영)이 같은 "찾은 보물" 목록을 봐야 하고,
 * 미션을 끝낸 뒤 intro로 다시 들어왔을 때도 완료 여부를 알아야 해서 라우트 상태 대신 스토어에 둔다
 * (prompt §9 "이미 미션을 완료 했는데, 다시 진입한 경우").
 *
 * 진행도 자체는 이제 서버가 저장한다 — 보물을 찾을 때마다 PATCH .../progress가 나가고, 앱을 다시
 * 켜면 시작(POST .../progress)이 기존 진행도를 그대로 돌려준다. 그래서 이 스토어는 "서버 상태의
 * 화면용 사본"이고, 값의 출처는 항상 서버 응답이다(findTreasureIndexes를 직접 계산하지 않는다).
 *
 * `completedAt`만 예외로 앱이 들고 있는 값이다 — 서버에 완료 시각을 조회할 API가 없고,
 * intro의 "이미 완료한 미션" 화면이 그 시각을 표시해야 한다.
 */
interface TreasureProgressStore {
  /** 서버 진행도 id. 시작 응답 전에는 null이고, 그 동안은 진행도를 저장할 수 없다 */
  progressId: number | null;
  /** 서버가 준 목표 보물 개수. 시작 응답 전에는 0 */
  treasureCount: number;
  /** 서버가 준 "찾은 보물 번호"(오름차순). 순서를 앱이 정하지 않는다 */
  foundTreasureIndexes: number[];
  /**
   * 이번 회차에 지급된 보상 누적값.
   *
   * 보물찾기는 보물을 찾을 때마다 보상을 하나씩 준다(AR 캐릭터 → 포인트 → 쿠폰). 각 응답의 reward에는
   * 그 요청으로 지급된 항목만 들어 있어서, 완료 화면에 마지막 응답만 넘기면 보상이 한 줄만 보인다.
   * 그래서 회차 내내 여기에 모아 두고 완료 시점에 통째로 넘긴다(constants/treasureMission.ts의
   * mergeGrantedRewards). 아직 아무 응답도 못 받았으면 null이다.
   */
  grantedReward: GeneratedApi.GrantedRewardResponse | null;
  /** 미션을 끝낸 시각(ISO). 완료한 적이 없으면 null */
  completedAt: string | null;

  /** 시작/이어하기 응답 반영. 이어하기면 이미 찾은 보물이 섞여 온다 */
  syncStarted: (progressId: number, treasureCount: number, foundTreasureIndexes: number[]) => void;
  /**
   * 진행도 저장 응답 반영 — 찾은 번호는 서버 목록으로 덮고 보상은 누적한다.
   * 누적 결과를 그대로 돌려준다: 완료 응답을 받은 화면이 곧바로 완료 화면에 넘겨야 하는데,
   * set 직후의 스토어 값은 같은 렌더에서 읽을 수 없기 때문이다.
   */
  syncSaved: (foundTreasureIndexes: number[], granted: GeneratedApi.GrantedRewardResponse | null | undefined) => GeneratedApi.GrantedRewardResponse;
  /**
   * 서버가 이미 찾은 것으로 알고 있는 보물(409)을 목록에 맞춘다.
   * 응답 본문이 없어 서버 목록으로 덮을 수 없으므로 이 한 건만 더한다.
   */
  markFoundLocally: (treasureIndex: number) => void;
  /** 목표 개수를 채웠는지 */
  isComplete: () => boolean;
  /** 완료 처리. 이미 완료 시각이 있으면 덮어쓰지 않는다(최초 완료일을 보존) */
  markComplete: (completedAt: string) => void;
  /** 완료 후 다시 도전 — 회차 상태만 비우고 최초 완료 시각은 남긴다 */
  restart: () => void;
  reset: () => void;
}

/** 한 회차에만 유효한 값. 다시 도전할 때 통째로 비운다 */
const EMPTY_RUN = {
  progressId: null,
  treasureCount: 0,
  foundTreasureIndexes: [],
  grantedReward: null,
} satisfies Partial<TreasureProgressStore>;

export const useTreasureProgressStore = create<TreasureProgressStore>((set, get) => ({
  ...EMPTY_RUN,
  completedAt: null,

  syncStarted: (progressId, treasureCount, foundTreasureIndexes) =>
    set((state) =>
      // 같은 진행도를 다시 받은 것(재요청)이면 누적 보상을 유지한다. 다른 진행도면 새 회차라
      // 이전 회차의 보상이 완료 화면에 섞이지 않게 비운다.
      state.progressId === progressId ? { progressId, treasureCount, foundTreasureIndexes } : { progressId, treasureCount, foundTreasureIndexes, grantedReward: null },
    ),

  syncSaved: (foundTreasureIndexes, granted) => {
    const grantedReward = mergeGrantedRewards(get().grantedReward, granted);
    set({ foundTreasureIndexes, grantedReward });
    return grantedReward;
  },

  markFoundLocally: (treasureIndex) => set((state) => ({ foundTreasureIndexes: withFoundTreasureIndex(state.foundTreasureIndexes, treasureIndex) })),

  isComplete: () => isTreasureRunComplete(get().foundTreasureIndexes.length, get().treasureCount),

  markComplete: (completedAt) => set((state) => (state.completedAt === null ? { completedAt } : state)),

  restart: () => set({ ...EMPTY_RUN }),

  reset: () => set({ ...EMPTY_RUN, completedAt: null }),
}));
