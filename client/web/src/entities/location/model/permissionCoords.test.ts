import { describe, expect, it } from 'vitest';
import { shouldDiscardCoordsForPermission } from './permissionCoords';

describe('shouldDiscardCoordsForPermission', () => {
  // 권한을 허용했다가 설정에서 회수하면 앱이 blocked를 다시 보내는데, 스토어의 옛 좌표가 남아 있으면
  // resolveAddressDisplay가 `coords !== null`을 먼저 보고 옛 주소를 "현재 위치"처럼 계속 그린다.
  it('권한을 잃으면 들고 있던 좌표를 버린다', () => {
    expect(shouldDiscardCoordsForPermission('denied')).toBe(true);
    expect(shouldDiscardCoordsForPermission('blocked')).toBe(true);
  });

  it('권한이 살아 있으면 좌표를 유지한다', () => {
    expect(shouldDiscardCoordsForPermission('granted-precise')).toBe(false);
    expect(shouldDiscardCoordsForPermission('granted-approximate')).toBe(false);
  });

  // 아직 응답 전이다 — 여기서 버리면 정상 부팅 중에 마커가 한 번 사라진다
  it('아직 모를 때는 버리지 않는다', () => {
    expect(shouldDiscardCoordsForPermission('undetermined')).toBe(false);
  });
});
