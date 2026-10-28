import { describe, expect, it } from 'vitest';
import { resolvePermissionGuidance } from './permissionGuidance';

describe('resolvePermissionGuidance', () => {
  it('permission not yet checked (null) is not blocked', () => {
    expect(resolvePermissionGuidance(null, '카메라')).toEqual({ blocked: false });
  });

  it('granted permission is not blocked', () => {
    expect(resolvePermissionGuidance({ granted: true, canAskAgain: true }, '카메라')).toEqual({
      blocked: false,
    });
  });

  it('denied but re-askable guides to retry, not settings', () => {
    expect(resolvePermissionGuidance({ granted: false, canAskAgain: true }, '카메라')).toEqual({
      blocked: true,
      message: '카메라 권한을 허용해야 계속할 수 있어요.',
      canOpenSettings: false,
    });
  });

  it('denied and not re-askable guides to settings', () => {
    expect(resolvePermissionGuidance({ granted: false, canAskAgain: false }, '사진 저장')).toEqual({
      blocked: true,
      message: '사진 저장 권한이 거부되어 있어요. 설정에서 허용해주세요.',
      canOpenSettings: true,
    });
  });
});
