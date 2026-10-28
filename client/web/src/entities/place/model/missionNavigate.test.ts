import { describe, expect, it } from 'vitest';
import { buildMissionNavigatePayload } from './missionNavigate';

// 지도 미션은 TREASURE·COOPERATIVE 둘뿐이다(MapMissionType). CULTURE는 지도에 올라오지 않는다.
describe('buildMissionNavigatePayload', () => {
  it('보물찾기는 treasure-mission 화면으로 보낸다', () => {
    expect(buildMissionNavigatePayload({ missionType: 'TREASURE', missionId: 7 })).toEqual({ route: 'treasure-mission', missionId: 7 });
  });

  it('협동 미션은 coop-mission 화면으로 보낸다', () => {
    expect(buildMissionNavigatePayload({ missionType: 'COOPERATIVE', missionId: 3 })).toEqual({ route: 'coop-mission', missionId: 3 });
  });

  // 근처 미션 카드는 저마다 다른 장소의 미션이다. missionId를 빠뜨리면 앱 인트로가
  // GET /api/v1/missions/{missionType}/{missionId}를 부를 수 없어 화면이 열리지 않는다.
  it('missionId를 그 미션의 것으로 싣는다 — 유형만 보내면 앱이 어떤 미션인지 알 수 없다', () => {
    expect(buildMissionNavigatePayload({ missionType: 'TREASURE', missionId: 601 }).missionId).toBe(601);
  });
});
