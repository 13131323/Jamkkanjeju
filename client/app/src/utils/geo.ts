/**
 * 보물찾기(TreasureHunt) step2 배치/가시성 계산용 순수 함수 모음.
 *
 * 전부 순수 함수로 유지한다 — expo-location/expo-sensors 구독, React 상태 등
 * 부수효과가 있는 코드는 이 파일에 두지 않는다(문서 §3 "실기기 없이 로직을 확인").
 */

/** expo-location의 위치 좌표와 그대로 맞물리도록 최소 필드만 정의한다. */
export interface Coords {
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// 튜닝 상수 — 전부 [미검증], 실기기에서 눈으로 보정 필요 (문서 §3 함정 표)
// ---------------------------------------------------------------------------

/** 지구 반지름(m). WGS84 평균 반지름, 상수 자체는 검증 불필요. */
export const EARTH_RADIUS_METERS = 6371000;

/**
 * 카메라 수평 화각(도). expo-camera는 실제 화각을 알려주지 않는다.
 * 문서 §3 함정 표: "수평 FOV를 상수(약 60~70°)로 두고 실기기에서 눈으로 보정".
 * [미검증] 값이 틀리면 아이콘이 실제보다 빠르게/느리게 흐른다.
 */
export const CAMERA_FOV_DEGREES = 65;

/**
 * 보물찾기 인증 반경(m). 문서 §3: "디바이스 좌표 기준 500m 근방".
 * 기획 수치이지 실기기 튜닝 대상은 아니지만, 다른 상수와 함께 한 곳에 모아둔다.
 */
export const TREASURE_HUNT_RADIUS_METERS = 500;

/**
 * 나침반 heading 저역통과 스무딩 계수(0~1). 클수록 최신 값을 더 빨리 반영한다
 * (덜 부드럽고, 작을수록 더 부드럽지만 반응이 느려짐).
 * 문서 §3 함정 표: "나침반 노이즈 — 원시 heading이 몇 도씩 떨려 아이콘이 진동".
 * [미검증] 실기기에서 떨림/지연 체감을 보고 조정 필요.
 */
export const HEADING_SMOOTHING_ALPHA = 0.2;

/**
 * 가시성 히스테리시스 폭(도). FOV 절반 경계에서 나타남 임계값은 더 좁게,
 * 사라짐 임계값은 더 넓게 잡아 경계 근처에서 반복 깜빡이는 것을 막는다.
 * 문서 §3 함정 표: "경계 깜빡임 — 나타남·사라짐 임계값을 다르게".
 *
 * 처음 5도로 뒀는데 실기기에서 아이콘이 너무 빨리 사라졌다. 나침반이 손 떨림만으로도 몇 도씩
 * 흔들려서, 조준을 유지하고 있는데도 사라짐 임계값을 넘나든 것이다. 12도로 넓혀 한 번 나타난
 * 보물이 시야에서 확실히 벗어날 때까지 남게 한다 — 탭할 시간을 주는 것이 목적이다.
 */
export const VISIBILITY_HYSTERESIS_MARGIN_DEGREES = 12;

// ---------------------------------------------------------------------------
// 각도 변환 헬퍼
// ---------------------------------------------------------------------------

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// 거리 / 방위각
// ---------------------------------------------------------------------------

/**
 * 두 좌표 간 거리(m). Haversine 공식.
 */
export function haversineDistanceMeters(a: Coords, b: Coords): number {
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);

  const sinHalfDeltaLat = Math.sin(deltaLatitude / 2);
  const sinHalfDeltaLon = Math.sin(deltaLongitude / 2);

  const h = sinHalfDeltaLat * sinHalfDeltaLat + Math.cos(latitudeA) * Math.cos(latitudeB) * sinHalfDeltaLon * sinHalfDeltaLon;
  const centralAngle = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * centralAngle;
}

/**
 * from에서 to를 향하는 진북(true north) 기준 방위각. 0~360, 0=정북, 90=정동.
 * GPS bearing은 진북 기준이므로 트레저헌트에서는 반드시 trueHeading과 비교해야 한다
 * (문서 §3 함정 표: "자북 vs 진북").
 */
export function bearingDegrees(from: Coords, to: Coords): number {
  const latitudeFrom = toRadians(from.latitude);
  const latitudeTo = toRadians(to.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLongitude) * Math.cos(latitudeTo);
  const x = Math.cos(latitudeFrom) * Math.sin(latitudeTo) - Math.sin(latitudeFrom) * Math.cos(latitudeTo) * Math.cos(deltaLongitude);

  const bearing = toDegrees(Math.atan2(y, x));
  return normalizeHeadingDegrees(bearing);
}

/**
 * from에서 지정한 방위각으로 distanceMeters만큼 이동한 좌표. haversine의 역연산이다.
 *
 * 실기기 없이 "보물에 걸어서 다가가는" 상황을 만들 때 쓴다(constants/treasureHunt.ts의
 * 접근 시뮬레이션). 실제 위치 로직에는 쓰이지 않지만, 좌표 계산은 전부 이 파일에 모아 둔다.
 */
export function destinationCoords(from: Coords, distanceMeters: number, bearingDeg: number): Coords {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDeg);
  const latitudeFrom = toRadians(from.latitude);
  const longitudeFrom = toRadians(from.longitude);

  const latitudeTo = Math.asin(Math.sin(latitudeFrom) * Math.cos(angularDistance) + Math.cos(latitudeFrom) * Math.sin(angularDistance) * Math.cos(bearing));
  const longitudeTo = longitudeFrom + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeFrom), Math.cos(angularDistance) - Math.sin(latitudeFrom) * Math.sin(latitudeTo));

  return { latitude: toDegrees(latitudeTo), longitude: toDegrees(longitudeTo) };
}

// ---------------------------------------------------------------------------
// 각도 정규화
// ---------------------------------------------------------------------------

/**
 * 임의의 각도(도)를 0~360 범위로 정규화한다(음수/360 초과 모두 처리).
 * heading 값 자체(절대 방향)를 다룰 때 사용한다.
 */
export function normalizeHeadingDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * 임의의 각도 차이를 -180~+180 범위로 정규화한다.
 * 0도 경계(예: 350°와 10°는 20°밖에 차이 나지 않음)를 올바르게 넘겨야 하는
 * 계산이라 이 레포에서 부호/랩어라운드 실수가 가장 잦은 지점이다(작업 지시 참고).
 */
export function normalizeAngleDelta(degrees: number): number {
  let delta = degrees % 360;
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  return delta;
}

/**
 * 기기가 바라보는 방향(deviceHeading) 대비 보물 방위각(bearing)의 상대 각도.
 * 양수면 보물이 오른쪽(시계 방향), 음수면 왼쪽에 있다는 뜻이다.
 *
 * deviceHeading이 expo-location의 trueHeading처럼 무효값(-1 등)일 수 있으므로
 * 호출 전에 {@link isValidHeading}으로 검사해야 한다 — 이 함수는 검증하지 않고
 * 그대로 계산한다(문서 §3 함정 표: "trueHeading 무효값").
 */
export function relativeAngle(deviceHeading: number, bearing: number): number {
  return normalizeAngleDelta(bearing - deviceHeading);
}

// ---------------------------------------------------------------------------
// 화면 좌표 / 가시성
// ---------------------------------------------------------------------------

/**
 * 상대 각도를 화면 X 좌표(px)로 변환한다.
 * screenX = 화면폭/2 + relative × (화면폭 / FOV)
 */
export function computeScreenX(relativeDegrees: number, screenWidthPx: number, fovDegrees: number = CAMERA_FOV_DEGREES): number {
  return screenWidthPx / 2 + relativeDegrees * (screenWidthPx / fovDegrees);
}

/**
 * 히스테리시스 없이 순수 FOV 절반 기준으로만 가시성을 판정한다.
 * |relative| > FOV/2 이면 렌더하지 않는다(문서 §3 화면 좌표 공식 그대로).
 * 실제 렌더링에서는 경계 깜빡임 방지를 위해 {@link resolveVisibilityWithHysteresis}를 쓴다.
 */
export function isWithinFieldOfView(relativeDegrees: number, fovDegrees: number = CAMERA_FOV_DEGREES): boolean {
  return Math.abs(relativeDegrees) <= fovDegrees / 2;
}

export interface VisibilityHysteresisOptions {
  fovDegrees?: number;
  marginDegrees?: number;
}

/**
 * 이전 가시성 상태를 함께 받아, FOV 경계 근처에서 나타남/사라짐이 반복되지
 * 않도록 진입/이탈 임계값을 다르게 적용한다.
 *
 * - 현재 보이지 않던 보물은 FOV/2 - margin 이내로 들어와야 "나타남"
 * - 현재 보이던 보물은 FOV/2 + margin 을 벗어나야 "사라짐"
 *
 * 상태를 인자로 받아 새 상태를 반환하는 순수 함수이므로, 호출 측(화면 컴포넌트)에서
 * 이전 결과를 보관했다가 다음 heading 갱신 때 넘겨주면 된다.
 */
export function resolveVisibilityWithHysteresis(relativeDegrees: number, wasVisible: boolean, options: VisibilityHysteresisOptions = {}): boolean {
  const fovDegrees = options.fovDegrees ?? CAMERA_FOV_DEGREES;
  const marginDegrees = options.marginDegrees ?? VISIBILITY_HYSTERESIS_MARGIN_DEGREES;
  const halfFov = fovDegrees / 2;
  const enterThresholdDegrees = halfFov - marginDegrees;
  const exitThresholdDegrees = halfFov + marginDegrees;

  const absoluteRelative = Math.abs(relativeDegrees);

  return wasVisible ? absoluteRelative <= exitThresholdDegrees : absoluteRelative <= enterThresholdDegrees;
}

// ---------------------------------------------------------------------------
// 인증 반경
// ---------------------------------------------------------------------------

/**
 * 문서 §3 클릭 가능 조건의 절반: `distance ≤ 500m`.
 * 나머지 절반("반원 경계 안")은 화면(step2) 쪽 상태이므로 이 모듈 범위 밖이다.
 */
export function isWithinTreasureRadius(distanceMeters: number, radiusMeters: number = TREASURE_HUNT_RADIUS_METERS): boolean {
  return distanceMeters <= radiusMeters;
}

// ---------------------------------------------------------------------------
// heading 유효성 / 스무딩
// ---------------------------------------------------------------------------

/**
 * expo-location의 trueHeading은 위치 권한이 없거나 값을 구할 수 없으면 -1을 반환한다
 * (문서 §3 함정 표: "trueHeading 무효값"). 0~360 범위를 벗어나는 값은 모두 무효로 본다.
 */
export function isValidHeading(heading: number): boolean {
  return Number.isFinite(heading) && heading >= 0 && heading < 360;
}

/**
 * 나침반 heading에 저역통과 필터를 적용해 노이즈로 인한 진동을 줄인다.
 * heading은 0/360 경계를 순환하므로 단순 산술 평균이 아니라
 * {@link normalizeAngleDelta}로 최단 회전 방향의 차이만큼만 이동시킨다.
 *
 * previousHeading 또는 rawHeading이 무효({@link isValidHeading} 기준)면
 * 무효하지 않은 쪽을 그대로 반환하고, 둘 다 무효하면 rawHeading을 그대로 반환한다
 * (호출 측에서 무효 heading을 렌더링에 쓰지 않도록 별도 처리해야 한다).
 */
export function smoothHeading(previousHeading: number, rawHeading: number, alpha: number = HEADING_SMOOTHING_ALPHA): number {
  if (!isValidHeading(rawHeading)) {
    return previousHeading;
  }
  if (!isValidHeading(previousHeading)) {
    return normalizeHeadingDegrees(rawHeading);
  }

  const delta = normalizeAngleDelta(rawHeading - previousHeading);
  return normalizeHeadingDegrees(previousHeading + alpha * delta);
}
