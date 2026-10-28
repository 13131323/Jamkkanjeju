'use client';

/**
 * 쿠폰 "사용 완료" 상태를 브라우저에 남긴다.
 *
 * 서버에 쿠폰 사용 처리 API가 없다(completion API는 조회 전용). 화면 상태로만 두면 시트를
 * 닫는 순간 "쿠폰 사용하기"로 되돌아가 사용자가 버그로 읽는다. 그래서 기기에 남긴다.
 *
 * 한계를 알고 쓴다:
 * - 기기·브라우저를 바꾸면 초기화된다. 서버 상태가 아니다.
 * - 응답에 쿠폰 id가 없어서 사용처+금액을 key로 쓴다. 서로 다른 미션에서 받은 같은 사용처·같은
 *   금액의 쿠폰은(문서상 별개 항목으로 유지된다) 같은 key를 공유해 함께 사용 완료가 된다.
 *   쿠폰 id가 생기면 그 값으로 바꾼다.
 * - WebView는 앱이 데이터를 지우면 함께 사라진다.
 */

const STORAGE_KEY = 'tamnalog.usedCoupons.v1';

/**
 * 구독자 목록. useSyncExternalStore로 읽기 때문에 저장 후 리렌더를 일으킬 통로가 필요하다.
 * (effect에서 setState로 읽으면 cascading render가 되고 SSR 스냅샷도 어긋난다)
 *
 * 다른 탭의 변경(storage 이벤트)은 듣지 않는다 — 이 화면은 앱 WebView 한 곳에서만 열린다.
 */
const listeners = new Set<() => void>();

/**
 * 이 세션에서 사용 처리한 쿠폰. localStorage 저장이 막혔어도(프라이빗 모드 등) 버튼이
 * "쿠폰 사용 완료"로 바뀌어야 해서 메모리에도 남긴다. 새로고침하면 사라진다.
 */
const sessionUsed = new Set<string>();

/**
 * markCouponUsed 호출 횟수. 지도 마커는 "이 장소의 쿠폰들"처럼 특정 key 하나가 아니라 여러 key를
 * 한꺼번에 봐야 해서 isCouponUsed처럼 key별 스냅샷을 쓸 수 없다 — 그래서 이 값을
 * useSyncExternalStore 스냅샷으로 구독해 아무 쿠폰이나 사용 완료되면 마커를 다시 그리게 한다.
 */
let usedVersion = 0;

export function usedCouponsVersion(): number {
  return usedVersion;
}

export function subscribeUsedCoupons(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 사용처+금액으로 만드는 저장 key. locationId는 일치 장소가 없으면 null이라 key에 쓸 수 없다 */
export function couponStorageKey(couponLocation: string, couponPrice: number): string {
  return `${couponLocation}|${couponPrice}`;
}

function readAll(): string[] {
  // 프라이빗 모드·저장 차단 브라우저에서는 접근 자체가 throw한다
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // 손상된 값(다른 버전·수동 편집)을 그대로 믿으면 이후 includes에서 조용히 어긋난다
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

export function isCouponUsed(couponLocation: string, couponPrice: number): boolean {
  const key = couponStorageKey(couponLocation, couponPrice);
  return sessionUsed.has(key) || readAll().includes(key);
}

export function markCouponUsed(couponLocation: string, couponPrice: number): void {
  const key = couponStorageKey(couponLocation, couponPrice);
  if (isCouponUsed(couponLocation, couponPrice)) return;

  // 저장보다 먼저 세션에 남긴다 — setItem이 throw해도 이 화면은 사용 완료로 바뀌어야 한다
  sessionUsed.add(key);
  usedVersion += 1;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...readAll(), key]));
  } catch {
    // 저장이 막힌 브라우저. 다음 진입에서는 "쿠폰 사용하기"로 되돌아가지만 그게 최선이다
  }

  for (const listener of listeners) listener();
}

/** 테스트에서 세션 상태를 비운다. 모듈 전역이라 테스트 사이에 값이 새어 나간다 */
export function resetSessionUsedCoupons(): void {
  sessionUsed.clear();
}

/**
 * 서버 렌더 시점의 값. 저장소가 없으므로 "사용 안 함"으로 시작하고, hydration 후 실제 값으로 바뀐다.
 * useSyncExternalStore의 getServerSnapshot으로 넘긴다.
 */
export function usedCouponServerSnapshot(): boolean {
  return false;
}
