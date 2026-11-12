import { offsetAdminCoords } from '@packages/shared';
import { getCachedSession } from '@/services/sessionCache';
/** 실제 센서 좌표에 관리자 계정의 이동량을 한 번만 적용한다. */
export function applyAdminPosition<T extends { latitude: number; longitude: number }>(position: T): T {
  const result = offsetAdminCoords({ lat: position.latitude, lng: position.longitude }, getCachedSession()?.loginUser?.role);
  return { ...position, latitude: result.lat, longitude: result.lng };
}
