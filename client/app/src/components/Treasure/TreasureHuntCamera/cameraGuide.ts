/**
 * step2(카메라) 하단 안내 문구.
 *
 * 이 화면은 보물이 하나도 안 보이는 상태가 **정상적으로도** 자주 생긴다:
 *   - GPS fix를 아직 못 잡았다
 *   - 나침반(heading)이 아직 안 붙었거나 기기에 없다(에뮬레이터)
 *   - 반경 안이지만 지금 향한 방향에 보물이 없다(FOV 밖)
 *
 * 세 경우 모두 화면에는 카메라 영상만 남아서, 예전에는 "보물을 선택해 확인해보세요!"가 떠 있는데
 * 선택할 게 하나도 없는 상태였다 — 고장인지 방향이 틀린 건지 구분할 수 없었다.
 * 그래서 안내 문구가 지금 무엇이 없는지를 말하게 한다.
 *
 * 문구 결정만 하는 순수 함수로 떼어 둔 이유: 조건이 세 갈래라 화면 안에 삼항식으로 쌓으면
 * 우선순위가 눈에 안 보이고, 어떤 조합에서 무슨 문구가 나오는지 테스트할 수도 없다.
 *
 * ## 길이 제약 — 네 문구 모두 한 줄이어야 한다
 *
 * 안내 알약(styles.ts의 guidePillWrapper/guidePill)에서 문구가 실제로 쓸 수 있는 폭은
 * 360dp 화면 기준 **262dp**다:
 *
 *   360 − 16x2(래퍼 좌우 padding) − 16x2(알약 좌우 padding) − 34(아이콘) − 10(gap) = 262
 *
 * 폰트는 Pretendard-Regular 14px이고, ttf의 hmtx를 직접 읽어 잰 값으로 한글 한 글자가
 * **12.10dp**, 공백이 3.51dp다(Bold 16px의 "보물이랑 사진찍기"를 114.3dp로 재현해 보정 확인).
 * 즉 최악(전부 한글)으로 잡아도 **21자**까지가 한 줄이다.
 *
 * 예전에는 두 문구가 `\n`으로 두 줄을 강제하고 있었다 — 그래서 알약이 두 줄 높이로 부풀어
 * 카메라 화면을 그만큼 더 가렸다. 줄바꿈을 없애는 대신 문구를 그 폭 안으로 줄였다.
 */

/** 보물이 화면에 있고 조작할 수 있는 정상 상태. 디자인 BottomArea 문구 그대로다 (155.8dp) */
export const CAMERA_GUIDE_DEFAULT = '보물을 선택해 확인해보세요!';

/** GPS fix 대기 — 거리·방위각을 계산할 기준점이 없다 (159.3dp) */
export const CAMERA_GUIDE_NO_COORDS = '현재 위치를 확인하고 있어요.';

/**
 * 나침반 대기. (188.4dp)
 *
 * 8자 움직임을 안내하는 이유: heading이 무효인 가장 흔한 원인이 자기 센서 미보정이고,
 * 8자로 흔드는 것이 안드로이드·iOS 공통의 표준 보정 동작이다.
 * (나침반이 아예 없는 에뮬레이터에서는 이 문구가 계속 남는다 — 그때는 이게 정확한 진단이다)
 *
 * "나침반을 확인하고 있어요"를 덜어냈다. 두 문장을 이으면 299.4dp로 한 줄에 못 들어가는데,
 * "맞춰주세요"가 이미 "아직 안 맞았다"를 담고 있어 상태 문장이 중복이었다.
 * 남긴 쪽이 사용자가 **할 수 있는 일**을 말하는 문장이다.
 */
export const CAMERA_GUIDE_NO_HEADING = '8자로 움직여 나침반을 맞춰주세요';

/**
 * 위치·방위각은 있는데 향한 방향에 보물이 없다. (199.1dp)
 *
 * "이 방향에는" → "이 방향엔", "천천히 둘러보세요" → "둘러보세요"로 줄였다(254.6 → 199.1dp).
 * 덜어낸 "천천히"는 속도 주문일 뿐 "지금 고장이 아니라 방향 문제"라는 핵심을 바꾸지 않는다.
 */
export const CAMERA_GUIDE_LOOK_AROUND = '이 방향엔 보물이 없어요. 둘러보세요';

export interface CameraGuideState {
  /** 현재 좌표를 얻었는지 */
  hasCoords: boolean;
  /** 유효한 heading을 얻었는지(utils/geo의 isValidHeading 결과) */
  hasValidHeading: boolean;
  /** 지금 화면에 그려진 보물 수 */
  visibleTreasureCount: number;
}

/**
 * 우선순위대로 문구를 고른다 — 좌표 없음 → 나침반 없음 → 보이는 보물 없음 → 정상.
 *
 * 좌표를 나침반보다 먼저 보는 이유: 좌표가 없으면 방위각을 계산할 대상 자체가 없어서
 * 나침반이 붙어 있어도 아무것도 그릴 수 없다. 더 근본적인 결핍을 먼저 알려준다.
 */
/**
 * 안내 알약 안에서 문구가 쓸 수 있는 폭(dp). 360dp 화면 기준 — 파일 헤더의 계산 참고.
 * 화면이 더 넓으면 여유는 늘어나므로 여기가 가장 빡빡한 조건이다.
 */
export const CAMERA_GUIDE_AVAILABLE_WIDTH_DP = 262;

/** Pretendard-Regular 14px의 한글 한 글자 advance(dp). ttf hmtx 실측값 */
export const CAMERA_GUIDE_HANGUL_ADVANCE_DP = 12.1;

/**
 * 한 줄에 들어가는 최대 글자 수.
 *
 * "모든 글자가 한글(가장 넓은 글자)"이라는 최악을 가정한 하한이다 — 공백·마침표는 더 좁으므로
 * 이 수를 지키면 실제로는 항상 여유가 남는다.
 */
export const CAMERA_GUIDE_MAX_LENGTH = Math.floor(CAMERA_GUIDE_AVAILABLE_WIDTH_DP / CAMERA_GUIDE_HANGUL_ADVANCE_DP);

export function resolveCameraGuide({ hasCoords, hasValidHeading, visibleTreasureCount }: CameraGuideState): string {
  if (!hasCoords) return CAMERA_GUIDE_NO_COORDS;
  if (!hasValidHeading) return CAMERA_GUIDE_NO_HEADING;
  if (visibleTreasureCount === 0) return CAMERA_GUIDE_LOOK_AROUND;

  return CAMERA_GUIDE_DEFAULT;
}
