/**
 * TreasureHuntCamera(step2) 전용 배치 계산.
 *
 * src/utils/geo.ts의 순수 함수(haversine, bearing, relativeAngle, 히스테리시스, screenX)를
 * 조합해 "보물 한 개를 이번 프레임에 화면 어디에 어떻게 그릴지"를 하나의 값으로 만든다.
 * 삼각함수는 여기서 새로 만들지 않는다 — 전부 geo.ts를 호출한 결과를 조합할 뿐이다.
 *
 * 근거: docs/superpowers/specs/2026-08-15-treasure-hunt-design-values.md "TreasureHunt_step2"
 *       docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §3
 */
import { bearingDegrees, computeScreenX, Coords, haversineDistanceMeters, isWithinFieldOfView, isWithinTreasureRadius, relativeAngle, resolveVisibilityWithHysteresis } from '@/utils/geo';
import { resolveVerticalJitter } from './verticalJitter';

/**
 * 보물 아이콘 크기(px). Penpot TreasureHunt_step2(x=29823)의 두 보물 이미지 실측값이다 —
 * 가까운 보물 "Frame 566 > image 57" = 123x123, 먼 보물 "Frame 567 > image 57" = 61x61.
 * (이전 값 74는 먼 보물의 이미지가 아니라 그 부모 프레임 폭이었다)
 *
 * 거리→크기 매핑은 디자인에 명시되어 있지 않아 두 값을 min/max로 삼아 거리로 보간한다. [추정]
 */
export const TREASURE_ICON_SIZE_FAR_PX = 61;
export const TREASURE_ICON_SIZE_NEAR_PX = 123;

/**
 * 아이콘 세로 위치의 **기준선은 화면 중앙**이다.
 *
 * 디자인(Penpot)은 먼 보물 y=309 / 가까운 보물 y=492로 원근을 세로 위치로도 표현했는데,
 * 그 값은 800px 시안 기준이라 실기기에서는 가까운 보물이 화면 아래쪽 3/4 지점까지 내려간다.
 * 카메라를 든 사람은 화면 한가운데로 조준하므로, 조준한 곳에 보물이 없으면 화면이 비어 보인다.
 * 거리감은 아이콘 크기(TREASURE_ICON_SIZE_*)가 나타내므로 **세로 위치는 거리를 뜻하지 않는다**.
 *
 * 다만 정확히 같은 중심에 세우면 크기만 다른 아이콘들의 가장자리가 사선을 이뤄 "대각선"으로
 * 읽힌다. 그래서 이 값은 기준선이고, 실제 top은 여기에 보물별 세로 지터를 더한 값이다
 * (verticalJitter.ts — 보물 id에서 결정론적으로 뽑아 프레임마다 흔들리지 않는다).
 */
export function centeredIconTop(iconSize: number, screenHeightPx: number): number {
  return screenHeightPx / 2 - iconSize / 2;
}

export interface TreasurePlacement {
  /** 현재 위치 → 보물까지 거리(m) */
  distanceMeters: number;
  /** 500m 반경 안인지 (geo.ts isWithinTreasureRadius) */
  withinRadius: boolean;
  /**
   * 화면에 그릴지 여부. distance 조건과 각도(히스테리시스) 조건은 서로 독립이다
   * (문서 §3 표 — "500m 밖 보물은 그쪽을 봐도 나타나지 않고, 500m 안이어도 등 뒤면 안 보인다").
   */
  visible: boolean;
  /** 다음 프레임 히스테리시스 입력으로 넘겨야 하는 값(각도만 반영, 거리 무관) */
  nextWasVisible: boolean;
  /**
   * 탭 가능 여부. distance 조건은 visible과 동일하게 적용하되, 각도는 히스테리시스
   * 여유 없이 "정확히 FOV 절반 안"(isWithinFieldOfView)인지로 한 번 더 엄격하게 본다.
   * 히스테리시스의 사라짐 여유 구간(경계 깜빡임 방지용, 문서 §3)에서는 아이콘이 아직
   * 화면에 남아있지만 조준은 풀린 상태로 취급해 탭을 막는다 — 이게 disabled Pressable의 존재 이유다.
   */
  clickable: boolean;
  /** 화면 X좌표(px, computeScreenX 그대로) */
  screenX: number;
  /** 거리로 보간한 아이콘 크기(px) */
  iconSize: number;
  /**
   * 아이콘 top 좌표(px). 화면 세로 중앙(centeredIconTop) + 보물별 세로 지터(verticalJitterPx).
   */
  iconTop: number;
  /**
   * `iconTop`에 이미 더해져 있는 세로 지터(px). 중앙 기준선은 `iconTop - verticalJitterPx`다.
   *
   * 값을 따로 들고 다니는 이유는 separatePlacements가 겹침을 풀 때 **기준선으로 되돌아가야**
   * 하기 때문이다. 지터 위에 계단을 또 얹으면 오프셋이 두 번 더해져 안전 구간을 벗어난다.
   * 그 함수는 이 값을 계단 순서를 정하는 데도 쓴다(x 순서로 정하면 그게 곧 대각선이다).
   */
  verticalJitterPx: number;
  /**
   * 아이콘과 PinLabel 사이 간격(px).
   * 디자인은 가까운 보물이 gap 8, 먼 보물이 gap -5(라벨이 아이콘에 살짝 겹침)라 함께 보간한다.
   */
  labelGap: number;
  /** PinLabel 타이포 프리셋. 가까운 보물 16/1.5, 먼 보물 12/1.5 */
  labelSize: 'near' | 'far';
}

export interface ComputeTreasurePlacementParams {
  currentCoords: Coords;
  treasureCoords: Coords;
  /** 스무딩까지 끝난 유효 heading. 호출 전 isValidHeading으로 확인된 값이어야 한다. */
  deviceHeading: number;
  /** 이전 프레임의 가시성(히스테리시스 stateful input) */
  wasVisible: boolean;
  screenWidthPx: number;
  /** 아이콘을 세로 가운데에 세우는 기준 높이(px). 카메라 프리뷰가 화면을 다 채우므로 화면 높이다 */
  screenHeightPx: number;
  /** 인증 반경(m). 호출 측이 constants/treasureHunt.ts의 TREASURE_DISCOVERY_RADIUS_METERS를 넘긴다. */
  radiusMeters: number;
  fovDegrees?: number;
  /**
   * 세로 지터를 뽑을 씨앗. 보물마다 고정된 값(treasureIndex 등)을 넘긴다.
   *
   * 없으면 지터 없이 정확히 중앙에 선다 — 씨앗을 안 주면 "흔들지 않는다"가 안전한 기본값이다.
   */
  jitterSeed?: string | number;
}

/** PinLabel 간격(px). 디자인 Frame 566(가까움) gap 8 / Frame 567(멂) gap -5 */
export const TREASURE_LABEL_GAP_NEAR_PX = 8;
export const TREASURE_LABEL_GAP_FAR_PX = -5;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

/**
 * [테스트용] GPS·나침반 없이 보물을 화면에 그대로 세우는 배치.
 * constants/treasureHunt.ts의 TREASURE_DEV_ALWAYS_VISIBLE이 켜져 있을 때만 쓰인다(기본 false).
 *
 * 화면 폭을 (total + 1)등분한 지점에 하나씩 놓고, 서로 겹치지 않도록 크기는 전부
 * "먼 보물" 값으로 고정한다. 거리 개념이 없으므로 distanceMeters는 0으로 둔다.
 *
 * **이 배치는 heading을 입력으로 받지 않는다** — 즉 기기를 돌려도 아이콘이 그대로 있다.
 * 방위각에 따라 아이콘이 움직여야 하는 동작을 확인할 때는 이 경로가 아니라
 * computeTreasurePlacement가 타야 한다(그 플래그를 끄면 된다).
 */
export function computeDevTreasurePlacement(index: number, total: number, screenWidthPx: number, screenHeightPx: number, jitterSeed: string | number = index): TreasurePlacement {
  const iconSize = TREASURE_ICON_SIZE_FAR_PX;
  const centeredTop = centeredIconTop(iconSize, screenHeightPx);
  // dev 배치도 실제 화면과 같은 세로 흩뜨림을 보여야 눈으로 확인하는 의미가 있다
  const verticalJitterPx = resolveVerticalJitter({ seed: jitterSeed, iconSize, screenHeightPx, centeredTop });

  return {
    distanceMeters: 0,
    withinRadius: true,
    visible: true,
    nextWasVisible: true,
    clickable: true,
    screenX: (screenWidthPx * (index + 1)) / (total + 1),
    iconSize,
    iconTop: centeredTop + verticalJitterPx,
    verticalJitterPx,
    labelGap: TREASURE_LABEL_GAP_FAR_PX,
    labelSize: 'far',
  };
}

export function computeTreasurePlacement({
  currentCoords,
  treasureCoords,
  deviceHeading,
  wasVisible,
  screenWidthPx,
  screenHeightPx,
  radiusMeters,
  fovDegrees,
  jitterSeed,
}: ComputeTreasurePlacementParams): TreasurePlacement {
  const distanceMeters = haversineDistanceMeters(currentCoords, treasureCoords);
  const withinRadius = isWithinTreasureRadius(distanceMeters, radiusMeters);

  const bearing = bearingDegrees(currentCoords, treasureCoords);
  const relative = relativeAngle(deviceHeading, bearing);

  // 렌더 여부: 히스테리시스를 적용해 FOV 경계 근처 깜빡임을 막는다(문서 §3 함정 표 "경계 깜빡임").
  const hysteresisVisible = resolveVisibilityWithHysteresis(relative, wasVisible, { fovDegrees });
  const visible = withinRadius && hysteresisVisible;

  const clickable = withinRadius && isWithinFieldOfView(relative, fovDegrees);

  const distanceRatio = clamp01(distanceMeters / radiusMeters);
  const iconSize = lerp(TREASURE_ICON_SIZE_NEAR_PX, TREASURE_ICON_SIZE_FAR_PX, distanceRatio);
  const labelGap = lerp(TREASURE_LABEL_GAP_NEAR_PX, TREASURE_LABEL_GAP_FAR_PX, distanceRatio);

  const centeredTop = centeredIconTop(iconSize, screenHeightPx);
  // 씨앗이 없으면 0 — 지터는 "정확히 중앙"에 얹는 장식이지 배치의 전제가 아니다
  const verticalJitterPx = jitterSeed === undefined ? 0 : resolveVerticalJitter({ seed: jitterSeed, iconSize, screenHeightPx, centeredTop });

  return {
    distanceMeters,
    withinRadius,
    visible,
    nextWasVisible: hysteresisVisible,
    clickable,
    screenX: computeScreenX(relative, screenWidthPx, fovDegrees),
    iconSize,
    iconTop: centeredTop + verticalJitterPx,
    verticalJitterPx,
    labelGap,
    // 두 프리셋 사이 중간 크기는 디자인에 없어, 절반을 기준으로 가까운 쪽/먼 쪽 타이포를 고른다
    labelSize: distanceRatio < 0.5 ? 'near' : 'far',
  };
}
