import { describe, expect, it } from 'vitest';
import { buildNearbyMissionMapPath } from './missionListWebUrl';

/**
 * web의 parseMissionListParam/parseEntryCoords와 짝이 되는 쪽. 파라미터 이름이 어긋나면 목록이
 * 열리지 않고 그냥 지도만 보이므로(에러가 나지 않는다) 여기서 못박아 둔다.
 */
describe('buildNearbyMissionMapPath', () => {
  it('미션 종류를 missions 파라미터로 넣는다', () => {
    const path = buildNearbyMissionMapPath({ missionType: 'treasure', coords: null });
    expect(path.startsWith('/map?')).toBe(true);
    expect(new URLSearchParams(path.slice(path.indexOf('?') + 1)).get('missions')).toBe('treasure');
  });

  it('좌표가 있으면 lat·lng를 함께 넣는다 — 새 WebView에는 위치 브릿지가 없다', () => {
    const path = buildNearbyMissionMapPath({ missionType: 'treasure', coords: { lat: 33.4996, lng: 126.5312 } });
    const query = new URLSearchParams(path.slice(path.indexOf('?') + 1));
    expect(query.get('lat')).toBe('33.4996');
    expect(query.get('lng')).toBe('126.5312');
  });

  it('좌표가 없으면 파라미터를 붙이지 않는다', () => {
    const path = buildNearbyMissionMapPath({ missionType: 'coop', coords: null });
    expect(path).not.toContain('lat=');
    expect(path).not.toContain('lng=');
  });

  it('좌표가 NaN이면 붙이지 않는다 — web이 지도를 엉뚱한 곳으로 옮긴다', () => {
    const path = buildNearbyMissionMapPath({ missionType: 'treasure', coords: { lat: Number.NaN, lng: 126.5312 } });
    expect(path).not.toContain('lat=');
    expect(path).not.toContain('lng=');
  });
});
