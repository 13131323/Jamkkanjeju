import { ImageSourcePropType } from 'react-native';
import { TREASURE_ENTER_RADIUS_METERS, TREASURE_TYPE, type TreasureType } from '@packages/shared';
import type { TreasureSpot } from './treasureMission';

/**
 * 보물찾기 화면 에셋 — 서버가 준 보물 목록에 이미지를 붙인다.
 * 관련 프롬프트: docs/prompt.txt §5/§9 / 기술 결정: docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md
 *
 * 좌표·문구는 서버 응답을 변환한 treasureMission.ts가 만들고, 여기서는 그 결과에 에셋만 얹는다.
 * 두 모듈이 갈라져 있는 이유는 이 파일이 `require('@assets/...png')`를 들고 있어서다 —
 * vitest에는 Metro의 에셋 로더가 없어 이 모듈을 import하는 테스트는 죽는다(treasureSpots.ts 주석 참고).
 */

export { TREASURE_TYPE };
export type { TreasureType, TreasureSpot };
export type { TreasureCoords } from './treasureMission';
export { TREASURE_DEV_APPROACH_BEARING_DEG, TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_STEP_MS, TREASURE_ORIGIN, TREASURE_PLACE_FALLBACK } from './treasureSpots';

/** 보물 하나를 화면에 그리는 데 필요한 에셋 묶음 */
export interface TreasureAssets {
  /** step2에서 아직 안 찾은 보물 — "닫힌 에셋" */
  closedIcon: ImageSourcePropType;
  /** step2에서 이미 찾은 보물 — "열린 에셋" */
  openIcon: ImageSourcePropType;
  /** step3 촬영 화면에 합성되는 캐릭터. CHARACTER 종류만 쓴다 */
  characterImage?: ImageSourcePropType;
}

/** 화면 코드가 함께 쓰는 형태 — 서버 필드 + 에셋 */
export type Treasure = TreasureSpot & TreasureAssets;

/** 보물이 후보에 들어오는 거리(m). prompt §5의 "근방 500m(예시)" */
export const TREASURE_DISCOVERY_RADIUS_METERS = TREASURE_ENTER_RADIUS_METERS;

const closedIcon = require('@assets/images/treasure-chest-closed.png');
const openIcon = require('@assets/images/treasure-chest-open.png');

/**
 * 보상 종류별 에셋.
 *
 * 지금 종류로 갈리는 것은 촬영 화면의 캐릭터뿐이다 — 지도·카메라의 상자 아이콘은 전부 같고,
 * 획득 모달도 보상 종류가 아니라 진행 상태로 그림이 갈린다(TREASURE_MODAL_*_ICON).
 *
 * 예전에는 mock의 문자열 id('dolmeong'/'coupon'/'point')로 골랐는데, 서버는 보물을 번호로만
 * 식별한다. 그래서 번호 → 보상 종류(treasureMission.ts의 TREASURE_REWARD_ORDER) → 에셋 순으로 잇는다.
 */
const TREASURE_ASSETS: Record<TreasureType, TreasureAssets> = {
  [TREASURE_TYPE.CHARACTER]: {
    closedIcon,
    openIcon,
    characterImage: require('@assets/images/treasure-ar-character.png'),
  },
  [TREASURE_TYPE.COUPON]: { closedIcon, openIcon },
  [TREASURE_TYPE.POINT]: { closedIcon, openIcon },
};

/** 보상 종류를 모르는 보물(서버가 3개보다 많이 준 경우)에 쓰는 값 — 빈 이미지가 되지 않게 받친다 */
const FALLBACK_TREASURE_ASSETS: TreasureAssets = { closedIcon, openIcon };

/** 서버 보물 목록에 에셋을 붙인다 */
export function toTreasures(spots: readonly TreasureSpot[]): Treasure[] {
  return spots.map((spot) => ({
    ...spot,
    ...(spot.treasureType ? TREASURE_ASSETS[spot.treasureType] : FALLBACK_TREASURE_ASSETS),
  }));
}

/**
 * [테스트용] step2에서 GPS·나침반 조건을 무시하고 보물을 바로 화면에 띄운다.
 *
 * 보물 좌표는 서버가 미션 장소 근처로 뽑아 주므로 제주 밖에서는 어떤 보물도 500m 안에 들어오지 않고,
 * 그러면 획득 모달 → step3(촬영)까지 한 번도 도달할 수 없어 촬영·저장 동작을 확인할 수 없다.
 * 이 값이 true면 보물이 화면에 균등 배치되고 바로 탭할 수 있다(탭 이후의 진행도 저장은 실제 API로 나간다).
 *
 * **기본값을 false로 둔 이유 — 이 값이 방위각 동작을 덮어버린다.**
 * true면 computeDevTreasurePlacement가 화면을 균등분할한 **고정 위치**에 아이콘을 놓기 때문에,
 * 기기를 돌려도 아이콘이 움직이지 않는다(각도·거리 계산을 아예 하지 않는다).
 *
 * 그리고 이 값 없이도 반경 안까지 갈 수 있다 — 심사위원용 모드의 접근 시뮬레이션(treasureSpots.ts)이
 * **위치만** 시뮬레이션해 실제 보물 쪽으로 600→30m까지 걸어가 주고, heading은 그대로 실제
 * 나침반 값을 쓴다. 그래서 두 값을 이렇게 조합하는 것이 기본이다:
 *   - 심사위원용 모드 ON → 제주 밖에서도 보물이 반경 안에 들어온다
 *   - ALWAYS_VISIBLE    = false → 방위각·거리 계산을 실제로 태워 카메라 각도에 아이콘이 따라온다
 *
 * 그래도 이 값이 필요한 경우: 나침반이 없는 에뮬레이터에서 촬영·저장 흐름만 확인할 때다
 * (heading이 무효면 실제 경로는 아이콘을 하나도 그리지 않는다).
 *
 * `__DEV__` 가드가 있어 릴리즈 빌드에서는 어떤 경우에도 켜지지 않는다.
 */
export const TREASURE_DEV_ALWAYS_VISIBLE = __DEV__ && false;

/** step0 지도 마커·진행도 배지가 함께 쓰는 보물상자 아이콘 */
export const TREASURE_MARKER_ICON = require('@assets/images/treasure-map-marker.png');

/**
 * 획득 모달 아이콘. Penpot "step-3" 열의 두 모달 보드에서 가져왔다.
 *
 * 보상 종류(캐릭터/포인트/쿠폰)로 갈리지 않는다 — 디자인이 상자 하나로 통일했고, 무엇을 받았는지는
 * 그림이 아니라 설명 문구가 말한다. 다 찾은 순간에만 축하하는 캐릭터로 바뀐다.
 *
 * 파일은 표시 dp(104 / 102)의 3배다(.claude/penpot-workflow.md §3-3).
 */
export const TREASURE_MODAL_FOUND_ICON = require('@assets/images/treasure-modal-found.png');
export const TREASURE_MODAL_ALL_FOUND_ICON = require('@assets/images/treasure-modal-all-found.png');

/**
 * step0 장소 한 줄 소개 카드와 step2 안내 알약이 함께 쓰는 안내 아이콘.
 *
 * 두 화면이 같은 그림을 써야 "같은 안내"로 읽힌다. 예전에는 같은 그림을 크기만 다르게 두 벌
 * (42x42 / 34x42) 들고 있었는데 쓰이는 건 한쪽뿐이라 한 벌로 합쳤다.
 *
 * 파일은 126x126 — 표시 dp(카드 42, 알약 34)의 3배다. 표시 크기와 같은 픽셀로 두면 3배 밀도
 * 기기에서 업스케일되어 흐려진다(.claude/penpot-workflow.md §3-3).
 */
export const TREASURE_PLACE_GUIDE_ICON = require('@assets/images/treasure-place-icon.png');

// 획득 모달의 제목·설명·CTA는 전부 TreasureRewardModal/rewardModalText.ts가 만든다.
// 예전에는 보상 종류로 CTA를 갈랐지만(캐릭터만 "캐릭터와 사진찍기"), 디자인이 촬영을 마지막
// 보물 하나로 옮기면서 종류가 아니라 **진행 상태**로 갈리게 됐다.
