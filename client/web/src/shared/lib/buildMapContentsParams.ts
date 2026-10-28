import type { GeneratedApi } from '@packages/shared';
import type { Bounds, Coordinates } from '@shared/config/geo';

// GET /api/v1/map/contents는 화면 사각형을 네 귀퉁이 위경도로 받는다. 카카오맵은 회전하지 않으므로
// sw/ne 두 점으로 나머지 두 귀퉁이를 계산할 수 있다.
export function buildMapContentsParams(bounds: Bounds, center: Coordinates, isClustered: boolean): GeneratedApi.GetMapContentsApiV1MapContentsGetParams {
  return {
    leftTopLatitude: bounds.ne.lat,
    leftTopLongitude: bounds.sw.lng,
    rightTopLatitude: bounds.ne.lat,
    rightTopLongitude: bounds.ne.lng,
    leftBottomLatitude: bounds.sw.lat,
    leftBottomLongitude: bounds.sw.lng,
    rightBottomLatitude: bounds.sw.lat,
    rightBottomLongitude: bounds.ne.lng,
    userLatitude: center.lat,
    userLongitude: center.lng,
    isClustered,
  };
}
