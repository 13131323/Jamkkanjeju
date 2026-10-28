import { describe, expect, it } from 'vitest';
import { JEJU_CENTER } from '@packages/shared';
import { resolveStopCoordinates } from './missionStopCoords';

describe('resolveStopCoordinates', () => {
  it('좌표를 얻었으면 그대로 보낸다', () => {
    expect(resolveStopCoordinates({ latitude: 33.5, longitude: 126.5 })).toEqual({ latitude: 33.5, longitude: 126.5 });
  });

  // 중단 API가 위경도를 필수로 받아서, 좌표가 없으면 요청 자체를 만들 수 없다.
  // 요청을 못 보내면 서버는 그 미션을 계속 진행중으로 들고 있고 홈에 "진행중인 미션"으로 남는다.
  it('좌표를 끝내 못 얻어도 제주 중심으로 보낸다 — 포기가 서버에 반드시 닿아야 한다', () => {
    expect(resolveStopCoordinates(null)).toEqual({ latitude: JEJU_CENTER.lat, longitude: JEJU_CENTER.lng });
  });

  // 진행도 저장(save)에는 쓰면 안 된다 — 정상 플레이의 '다음 장소'가 지어낸 좌표 기준으로 뽑힌다.
  // 이 함수는 포기 경로 전용이라는 것을 이름과 테스트로 못박는다.
  it('0도 유효한 좌표다 — falsy라고 폴백하지 않는다', () => {
    expect(resolveStopCoordinates({ latitude: 0, longitude: 0 })).toEqual({ latitude: 0, longitude: 0 });
  });
});
