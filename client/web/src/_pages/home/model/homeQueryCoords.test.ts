import { describe, expect, it } from 'vitest';
import { offsetAdminCoords, SEOUL_CITY_HALL, JEJU_CITY_HALL } from '@packages/shared';
import { resolveHomeQueryCoords } from './homeQueryCoords';
import { JEJU_CENTER } from '@shared/config/geo';
describe('홈 요청 좌표', () => {
  it('일반 사용자의 실좌표를 유지한다', () => {
    expect(resolveHomeQueryCoords(offsetAdminCoords(SEOUL_CITY_HALL, 'USER'))).toEqual(SEOUL_CITY_HALL);
  });
  it('관리자의 서울시청 좌표는 제주시청으로 변환한다', () => {
    expect(resolveHomeQueryCoords(offsetAdminCoords(SEOUL_CITY_HALL, 'ADMIN'))).toEqual(JEJU_CITY_HALL);
  });
  it('이동량을 유지한다', () => {
    const p = offsetAdminCoords({ lat: SEOUL_CITY_HALL.lat + 0.001, lng: SEOUL_CITY_HALL.lng + 0.002 }, 'ADMIN');
    expect(p.lat).toBeCloseTo(JEJU_CITY_HALL.lat + 0.001);
    expect(p.lng).toBeCloseTo(JEJU_CITY_HALL.lng + 0.002);
  });
  it('GPS가 없으면 기존 홈 조회 기준점을 사용한다', () => {
    expect(resolveHomeQueryCoords(null)).toEqual(JEJU_CENTER);
  });
});
