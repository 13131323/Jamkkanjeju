import type { ClusteredMapContents, DetailedMapContents } from '@shared/api/mapContents';

/** 현재 화면의 준비 중 사진만 최대 2분간 갱신한다. 정상 사진 없음은 재조회하지 않는다. */
export function mapImageRefreshInterval(
  data: DetailedMapContents | ClusteredMapContents | undefined,
  isClustered: boolean,
  elapsedMs: number,
): number | false {
  if (isClustered || elapsedMs >= 120_000 || !data || !('pendingLocationImageIds' in data)) return false;
  return data.pendingLocationImageIds.length > 0 ? 2_000 : false;
}
