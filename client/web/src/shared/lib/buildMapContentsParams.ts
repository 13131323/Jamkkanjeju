import type { MapContentsParams } from '@shared/api/mapContents';
import type { Bounds, Coordinates } from '@shared/config/geo';

// GET /api/v2/map/contents는 회전 없는 화면의 좌상단·우하단과 사용자 좌표를 받는다.
export function buildMapContentsParams(bounds: Bounds, center: Coordinates, isClustered: boolean): MapContentsParams {
  return {
    leftTopLatitude: bounds.ne.lat,
    leftTopLongitude: bounds.sw.lng,
    rightBottomLatitude: bounds.sw.lat,
    rightBottomLongitude: bounds.ne.lng,
    userLatitude: center.lat,
    userLongitude: center.lng,
    isClustered,
  };
}
