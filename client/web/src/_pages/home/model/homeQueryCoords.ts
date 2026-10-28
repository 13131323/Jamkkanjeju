import { JEJU_CENTER, type Coordinates } from '@shared/config/geo';

/**
 * 홈 조회(GET /api/v1/users/me/home)의 query에 실을 좌표.
 *
 * **사용자의 실제 좌표를 그대로 싣는다.** 제주 밖이면 서버가 근처 추천을 못 찾아 추천 미션이
 * 비는 것이 정상 동작이다 — 그게 "지금 내 주변" 추천의 정의다.
 *
 * 심사위원용 모드가 켜져 있을 때만 제주시청 고정 좌표가 실린다. 그 치환은 이 함수가 아니라
 * `useCurrentCoords()`(entities/location)가 하므로, 여기 들어오는 값은 이미 모드가 반영된 좌표다.
 *
 * `resolveDisplayLocation()`(=`useDisplayLocation`)을 쓰면 **안 된다.** 그쪽은 "제주 지도 위에
 * 마커를 어디에 찍을지"를 정하느라 제주 밖 좌표를 null로 버리는데, 그 null을 섬 중심으로 메우면
 * 제주 밖 사용자에게 한라산 기준 추천이 나간다(실제로 그랬다).
 *
 * 좌표를 **아직 모를 때**(권한 미결정·거부, 측위 전)만 섬 중심으로 대체한다. 이 조회 하나에
 * 진행중 미션·방명록 개수·캐릭터 이미지가 함께 실려 있어서, 좌표가 없다고 조회 자체를 멈추면
 * 위치와 무관한 그 값들까지 화면에서 사라진다. 좌표가 도착하면 queryKey가 바뀌어 다시 조회된다.
 */
export function resolveHomeQueryCoords(currentCoords: Coordinates | null): Coordinates {
  return currentCoords ?? JEJU_CENTER;
}
