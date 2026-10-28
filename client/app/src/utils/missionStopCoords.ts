import { JEJU_CENTER } from '@packages/shared';

export interface StopCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * 미션 **중단("포기 할래요")** 요청에 실을 좌표.
 *
 * 중단 API는 위경도를 **필수**로 받는다(orval 생성 params 타입). 그래서 측위가 실패하면 요청 자체를
 * 만들 수 없었고, 그러면 서버는 그 미션을 계속 진행중으로 들고 있어 홈의 "진행중인 미션"에 남았다
 * (사용자 확인: 정상 완료는 사라지는데 포기만 남는다).
 *
 * 지어낸 좌표를 보내면 완료 화면의 '다음 장소'가 그 기준으로 뽑혀 부정확해진다. 그래도 폴백을 쓰는 쪽을
 * 고른 이유는, **포기한 미션이 영영 진행중으로 남는 쪽이 더 나쁘기 때문**이다(사용자 판단). 사용자는
 * 이미 그만두기로 했으므로 다음 장소 추천의 정확도는 부차적이다.
 *
 * **진행도 저장(save)에는 쓰지 않는다.** 정상 플레이 중에 지어낸 좌표를 보내면 멀쩡히 진행 중인
 * 미션의 다음 장소가 망가진다 — 그쪽은 좌표가 없으면 사용자에게 알리고 재시도하는 기존 동작을 지킨다.
 */
export function resolveStopCoordinates(coords: StopCoordinates | null): StopCoordinates {
  if (coords) return coords;
  return { latitude: JEJU_CENTER.lat, longitude: JEJU_CENTER.lng };
}
