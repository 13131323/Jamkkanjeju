import { describe, expect, it } from 'vitest';
import type * as Location from 'expo-location';
import { mapPermissionResponseToStatus } from './locationPermission';

// PermissionResponse의 status/expires 등 나머지 필드는 매핑 로직과 무관하므로 최소 형태로만 채운다
function response(overrides: Partial<Location.LocationPermissionResponse>): Location.LocationPermissionResponse {
  return {
    status: 'granted' as Location.PermissionStatus,
    granted: true,
    canAskAgain: true,
    expires: 'never',
    ...overrides,
  } as Location.LocationPermissionResponse;
}

describe('mapPermissionResponseToStatus', () => {
  it('maps Android coarse-only grant to granted-approximate', () => {
    expect(mapPermissionResponseToStatus(response({ android: { accuracy: 'coarse' } }))).toBe('granted-approximate');
  });

  it('maps iOS reduced accuracy grant to granted-approximate', () => {
    expect(mapPermissionResponseToStatus(response({ ios: { scope: 'whenInUse', accuracy: 'reduced' } }))).toBe('granted-approximate');
  });

  it('maps Android fine grant to granted-precise', () => {
    expect(mapPermissionResponseToStatus(response({ android: { accuracy: 'fine' } }))).toBe('granted-precise');
  });

  it('maps a grant with no platform detail to granted-precise', () => {
    expect(mapPermissionResponseToStatus(response({}))).toBe('granted-precise');
  });

  it('maps undetermined status to undetermined', () => {
    expect(mapPermissionResponseToStatus(response({ granted: false, status: 'undetermined' as Location.PermissionStatus }))).toBe('undetermined');
  });

  it('maps a deniable rejection to denied', () => {
    expect(
      mapPermissionResponseToStatus(
        response({
          granted: false,
          canAskAgain: true,
          status: 'denied' as Location.PermissionStatus,
        }),
      ),
    ).toBe('denied');
  });

  it('maps a non-deniable rejection to blocked', () => {
    expect(
      mapPermissionResponseToStatus(
        response({
          granted: false,
          canAskAgain: false,
          status: 'denied' as Location.PermissionStatus,
        }),
      ),
    ).toBe('blocked');
  });
});
