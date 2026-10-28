/**
 * 보물찾기 미션 고정값.
 *
 * app(네이티브 step0~step3)과 web(지도 WebView) 양쪽이 같은 반경·문구를 봐야 하므로
 * 여기 한 곳에서만 정의한다. prompt.txt §9 기준.
 */

/** 보물 좌표 기준, 카메라를 켤 수 있게 되는 반경(m). step1 모달이 열리는 경계이기도 하다 */
export const TREASURE_ENTER_RADIUS_METERS = 500;

/**
 * step1 모달이 열린 채 유지되는 반경(m).
 *
 * 진입(500m)과 이탈(1km)을 다른 값으로 두는 이유: 같은 값이면 경계에서 GPS가 몇 m씩
 * 흔들릴 때마다 모달이 깜빡인다. prompt §9 "반경 1km까진 모달 open 유지"가 그대로
 * 히스테리시스 역할을 한다.
 */
export const TREASURE_KEEP_RADIUS_METERS = 1000;

/** 한 미션에서 찾아야 하는 보물 개수. step0 진행도("n/3")의 분모 */
export const TREASURE_TARGET_COUNT = 3;

/**
 * 지도 마커의 보물 개수 배지에 표시할 최대 숫자.
 * prompt §9 "보물 아이콘을 감싸는 원에 있는 숫자는 3까지 보여짐"
 */
export const TREASURE_MARKER_BADGE_MAX = 3;

/**
 * 장소 소개의 최대 글자 수.
 *
 * prompt §9는 "최대 글자수 20자"였지만 그 길이로는 카드가 한 줄로 끝나 장소를 설명하지 못했다.
 * 지금은 카드가 두 줄을 채우고 넘치는 만큼을 말줄임표로 자른다(numberOfLines={2} + tail).
 * 몇 자에서 두 줄이 차는지는 글자 폭·기기 폭·폰트 배율에 달려 있어 숫자로 못 박을 수 없으므로,
 * 이 값은 "자르는 기준"이 아니라 **안전 상한**이다 — 서버가 본문 전체를 통째로 보내는 사고를
 * 막을 뿐, 실제로 보이는 길이는 카드가 정한다.
 */
export const TREASURE_PLACE_SUMMARY_MAX_LENGTH = 120;

/**
 * 반경 밖에서 띄우는 접근 안내 문구.
 *
 * 거리를 문구에 직접 적지 않고 반경 상수를 끼워 넣는다 — 반경이 바뀌면 문구도 같이 따라와야 한다.
 *
 * **한 줄에 들어와야 한다.** 이 토스트는 화면 아래에서 장소 소개 카드 바로 위에 뜨는데,
 * 두 줄이 되면 카드와 붙어 한 덩어리로 읽힌다. 토스트 폭 312 - 좌우 패딩 28 = 284px에
 * 14px 한글이 20자쯤 들어가므로 그 안으로 유지한다(원래 문구는 30자라 두 줄이었다).
 */
export const TREASURE_APPROACH_HINT = `${TREASURE_ENTER_RADIUS_METERS}m 안에서 카메라를 켤 수 있어요`;

/**
 * 남은 거리(m)에 해당하는 안내 문구. 반경 안이면 null(= 토스트를 띄우지 않는다).
 *
 * **반경 안이 아니라 밖에서 띄운다.** prompt §9는 원래 "멘트는 500, 400, 300, 200, 100(m 단위),
 * 거의 다 왔을 때 달라짐"이라 반경 **안**의 거리 구간마다 다른 문구를 두고 있었다. 이후 지시로
 * 규칙이 바뀌었다 — 안내는 반경 밖에 있을 때만 띄우고, 반경 안으로 들어오면 토스트 대신
 * step1 시트(모달)가 뜬다. 두 안내가 같은 자리에서 겹치지 않게 하려는 것이다.
 *
 * 그래서 구간별 문구(400/300/200/100/30)는 도달할 수 없어져 함께 지웠다. 되살릴 때는
 * 이 함수의 경계 조건부터 되돌려야 한다.
 */
export function resolveTreasureDistanceHint(distanceMeters: number): string | null {
  return distanceMeters > TREASURE_ENTER_RADIUS_METERS ? TREASURE_APPROACH_HINT : null;
}
