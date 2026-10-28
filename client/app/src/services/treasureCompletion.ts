/**
 * GET /api/v1/missions/TREASURE/{missionId}/completion — 손으로 쓴 쿼리 훅.
 *
 * 서버에 이 엔드포인트가 아직 없어서 orval이 생성해 주지 못한다. 생성 경로인
 * `src/services/api`는 `clean: true`라 다음 `pnpm generate`에서 통째로 비워지므로
 * 그 밖(`src/services`)에 둔다.
 *
 * 서버가 구현되면 이 파일을 지우고 생성된 훅으로 갈아끼운다.
 * 응답 타입은 packages/shared의 completion.ts가 들고 있다(web과 공유해야 한다).
 */
import { useQuery } from '@tanstack/react-query';
import type { TreasureCompletionResponse } from '@packages/shared';
import { orvalClient } from './client';

/** 이 API는 missionType이 TREASURE가 아니면 404다(문서). 경로에 상수로 박는다 */
const TREASURE_MISSION_TYPE = 'TREASURE';

export function treasureCompletionQueryKey(missionId: number, latitude: number, longitude: number) {
  // 좌표가 바뀌면 추천 목록(거리순 3개)이 바뀌므로 key에 포함한다
  return [`/api/v1/missions/${TREASURE_MISSION_TYPE}/${missionId}/completion`, latitude, longitude] as const;
}

export function getTreasureCompletion(missionId: number, latitude: number, longitude: number, signal?: AbortSignal) {
  return orvalClient<TreasureCompletionResponse>({
    url: `/api/v1/missions/${TREASURE_MISSION_TYPE}/${missionId}/completion`,
    method: 'GET',
    params: { latitude, longitude },
    signal,
  });
}

interface UseTreasureCompletionOptions {
  /** 미션 홈의 남은 보상이 모두 소진된 뒤에만 켠다 — 아니면 409 TREASURE_ITEMS_REMAINING이 온다 */
  enabled: boolean;
}

export function useTreasureCompletion(missionId: number, coords: { lat: number; lng: number } | null, { enabled }: UseTreasureCompletionOptions) {
  return useQuery({
    queryKey: treasureCompletionQueryKey(missionId, coords?.lat ?? 0, coords?.lng ?? 0),
    queryFn: ({ signal }) => {
      // enabled 가드가 있어 coords가 null인 상태로는 호출되지 않는다
      if (!coords) throw new Error('좌표 없이 보물찾기 완료 조회를 호출했습니다.');
      return getTreasureCompletion(missionId, coords.lat, coords.lng, signal);
    },
    // 좌표는 필수 query라 없으면 부를 수 없다(문서: latitude/longitude 필수)
    enabled: enabled && coords !== null,
    // 조회 전용이고 완료 시각·추천 목록이 자주 바뀌지 않는다. 화면 재진입마다 다시 부르지 않는다
    staleTime: 60_000,
    // 홈과 같은 이유 — 실패해도 화면 전체를 오류로 바꾸지 않고 자리를 비운다
    throwOnError: false,
  });
}
