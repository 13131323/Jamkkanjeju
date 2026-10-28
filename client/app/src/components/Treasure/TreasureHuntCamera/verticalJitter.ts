/**
 * step2 보물 아이콘의 세로 흔들기(jitter).
 *
 * ## 왜 필요한가 — "대각선으로 보인다"
 *
 * `centeredIconTop`은 모든 보물의 **중심**을 화면 세로 정중앙에 둔다. 거리감은 아이콘 크기
 * (61~123px)가 나타내므로 의도된 규칙이지만, 중심이 같은 채 크기만 다른 아이콘이 가로로 늘어서면
 * 위아래 가장자리가 일정한 기울기를 이뤄 **사선**으로 읽힌다.
 * 겹침을 풀 때 쓰던 계단(separatePlacements의 STAGGER_STEP_PX)은 더 직접적인 원인이었다 —
 * x 순서대로 일정 간격씩 내리므로 정의상 완벽한 대각선이었다.
 *
 * 요구는 "중앙에 있지만 정렬 안 된 느낌"이다. 그래서 보물마다 세로로 조금씩 다른 오프셋을 준다.
 *
 * ## 왜 난수가 아니라 해시인가
 *
 * `Math.random()`은 쓰면 안 된다. 이 화면은 방위각이 갱신될 때마다 배치를 다시 계산하므로
 * (초당 여러 번) 매번 다른 값이 나오면 아이콘이 제자리에서 떨린다 — 직전 커밋 3c0b003이
 * 정리한 "방위각 깜빡임"과 같은 종류의 회귀다.
 * 대신 **보물 id를 해시**해서 뽑는다. 같은 보물은 세션이 바뀌어도 항상 같은 자리에 선다.
 */

/** 세로 오프셋의 최대 크기(화면 높이 대비 비율). ±이 값만큼 흔든다 */
export const VERTICAL_JITTER_RATIO = 0.1;

/**
 * 아이콘이 들어가도 되는 세로 구간(화면 높이 대비 비율).
 *
 * 위쪽은 헤더(56)와 진행도 카드가, 아래쪽은 안내 알약과 라벨(`labelGap` + 한 줄)이 있다.
 * 흔들다가 그 위로 올라가거나 아래로 내려가지 않도록 아이콘의 **위·아래 가장자리**를 가둔다.
 * 800dp 화면 기준 160~608px 구간이다.
 */
export const JITTER_TOP_SAFE_RATIO = 0.2;
export const JITTER_BOTTOM_SAFE_RATIO = 0.76;

/**
 * 문자열/숫자 씨앗을 [0, 1) 실수로 바꾼다. FNV-1a 32비트 + 마무리 혼합(avalanche).
 *
 * 암호학적 성질은 필요 없다. 필요한 건 두 가지뿐이다 — **결정론적**일 것(같은 씨앗 → 같은 값),
 * 그리고 1·2·3처럼 붙어 있는 id가 서로 **멀리** 흩어질 것.
 *
 * 뒤쪽이 함정이다. FNV-1a만 쓰면 한 글자짜리 씨앗에서 실패한다 —
 * `"1"`/`"2"`/`"3"`의 해시는 `(basis ^ c) * prime`이라 서로 정확히 prime(16,777,619)씩만
 * 차이 나고, 2^32로 나누면 **0.0039 간격**이 된다. 800px 화면·지터 ±10% 기준으로 1px도 안 되는
 * 차이라, 보물 셋이 다시 한 줄에 서 버린다(테스트로 실제로 잡혔다).
 * 그래서 murmur3의 fmix32와 같은 마무리 혼합을 붙여 하위 비트 차이를 상위 비트까지 퍼뜨린다.
 */
export function hashToUnitInterval(seed: string | number): number {
  const text = String(seed);
  // FNV-1a 32bit: offset basis 2166136261, prime 16777619
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    // Math.imul로 32비트 곱셈을 유지한다 — 그냥 곱하면 2^53을 넘어가며 하위 비트가 뭉개진다
    hash = Math.imul(hash, 16777619);
  }

  // fmix32 (murmur3). 붙어 있는 씨앗을 서로 먼 값으로 떨어뜨리는 건 이 세 줄이다.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  // >>> 0 으로 부호 없는 32비트로 되돌린 뒤 정규화한다
  return (hash >>> 0) / 4294967296;
}

interface VerticalJitterInput {
  /** 보물 id 등 보물마다 고정된 값. 같은 씨앗은 항상 같은 오프셋을 낸다 */
  seed: string | number;
  /** 거리로 보간된 아이콘 크기(px) */
  iconSize: number;
  /** 화면 높이(px) */
  screenHeightPx: number;
  /** 중앙 기준 아이콘 top(px). `centeredIconTop(iconSize, screenHeightPx)`의 값 */
  centeredTop: number;
  jitterRatio?: number;
  topSafeRatio?: number;
  bottomSafeRatio?: number;
}

/**
 * 중앙 기준 top에 더할 세로 오프셋(px)을 만든다.
 *
 * 안전 구간을 벗어나지 않도록 클램프하므로, 화면이 아주 낮거나 아이콘이 아주 크면
 * 오프셋이 0에 가깝게 줄어든다(흔들기보다 화면 안에 있는 것이 우선이다).
 */
export function resolveVerticalJitter({
  seed,
  iconSize,
  screenHeightPx,
  centeredTop,
  jitterRatio = VERTICAL_JITTER_RATIO,
  topSafeRatio = JITTER_TOP_SAFE_RATIO,
  bottomSafeRatio = JITTER_BOTTOM_SAFE_RATIO,
}: VerticalJitterInput): number {
  if (screenHeightPx <= 0 || iconSize <= 0 || jitterRatio <= 0) return 0;

  // [0,1) → [-1, 1). 중앙(오프셋 0)도 나올 수 있어야 "전부 흔들린" 티가 안 난다
  const signed = hashToUnitInterval(seed) * 2 - 1;
  const raw = signed * screenHeightPx * jitterRatio;

  // 아이콘의 위·아래 가장자리가 안전 구간 안에 남도록 오프셋 자체를 가둔다
  const minTop = screenHeightPx * topSafeRatio;
  const maxBottom = screenHeightPx * bottomSafeRatio;
  const lowerBound = minTop - centeredTop;
  const upperBound = maxBottom - iconSize - centeredTop;

  // 구간이 뒤집히면(아이콘이 안전 구간보다 큼) 흔들 자리가 없다
  if (upperBound < lowerBound) return 0;

  return Math.min(Math.max(raw, lowerBound), upperBound);
}
