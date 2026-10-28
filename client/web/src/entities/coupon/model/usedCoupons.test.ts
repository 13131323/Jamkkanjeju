import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { couponStorageKey, isCouponUsed, markCouponUsed, resetSessionUsedCoupons, subscribeUsedCoupons } from './usedCoupons';

/**
 * vitest 환경이 'node'라 window가 없다. 이 모듈은 localStorage 접근이 실패해도
 * 화면이 죽지 않는 것이 핵심이라, 저장소를 갈아끼우며 그 경로를 확인한다.
 */
function stubStorage(store: Map<string, string>, { throwOnAccess = false } = {}) {
  const storage = {
    getItem: (key: string) => {
      if (throwOnAccess) throw new Error('access denied');
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (throwOnAccess) throw new Error('access denied');
      store.set(key, value);
    },
  };
  vi.stubGlobal('window', { localStorage: storage });
}

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  stubStorage(store);
  // 세션 Set은 모듈 전역이라 테스트 사이에 값이 남는다
  resetSessionUsedCoupons();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('couponStorageKey', () => {
  it('사용처와 금액을 합친다 — 응답에 쿠폰 id가 없어 이 조합이 식별자다', () => {
    expect(couponStorageKey('탐라 소품', 1000)).toBe('탐라 소품|1000');
  });

  it('사용처가 같아도 금액이 다르면 다른 key다', () => {
    expect(couponStorageKey('탐라 소품', 1000)).not.toBe(couponStorageKey('탐라 소품', 2000));
  });
});

describe('markCouponUsed / isCouponUsed', () => {
  it('저장한 쿠폰만 사용 완료로 읽는다', () => {
    expect(isCouponUsed('탐라 소품', 1000)).toBe(false);
    markCouponUsed('탐라 소품', 1000);
    expect(isCouponUsed('탐라 소품', 1000)).toBe(true);
    expect(isCouponUsed('탐라 소품', 2000)).toBe(false);
  });

  it('같은 쿠폰을 두 번 눌러도 한 번만 쌓인다', () => {
    markCouponUsed('탐라 소품', 1000);
    markCouponUsed('탐라 소품', 1000);
    expect(JSON.parse(store.get('tamnalog.usedCoupons.v1') ?? '[]')).toEqual(['탐라 소품|1000']);
  });

  it('여러 쿠폰을 각각 기억한다', () => {
    markCouponUsed('탐라 소품', 1000);
    markCouponUsed('성산 감귤 공방', 2000);
    expect(isCouponUsed('탐라 소품', 1000)).toBe(true);
    expect(isCouponUsed('성산 감귤 공방', 2000)).toBe(true);
  });
});

describe('저장소가 못 믿을 상태일 때', () => {
  it('접근 자체가 throw하면 사용 안 함으로 읽고, 저장도 조용히 넘어간다', () => {
    stubStorage(store, { throwOnAccess: true });
    expect(isCouponUsed('탐라 소품', 1000)).toBe(false);
    expect(() => markCouponUsed('탐라 소품', 1000)).not.toThrow();
  });

  it('저장이 막혀도 이 세션에서는 사용 완료로 보인다 — 버튼이 안 바뀌면 사용자가 버그로 읽는다', () => {
    stubStorage(store, { throwOnAccess: true });
    markCouponUsed('탐라 소품', 1000);
    expect(isCouponUsed('탐라 소품', 1000)).toBe(true);
    expect(isCouponUsed('탐라 소품', 2000)).toBe(false);
  });

  it('JSON이 깨져 있으면 빈 목록으로 시작한다', () => {
    store.set('tamnalog.usedCoupons.v1', '{not json');
    expect(isCouponUsed('탐라 소품', 1000)).toBe(false);
  });

  it('배열이 아닌 값이 저장돼 있어도 무시한다', () => {
    store.set('tamnalog.usedCoupons.v1', '{"a":1}');
    expect(isCouponUsed('탐라 소품', 1000)).toBe(false);
  });

  it('문자열이 아닌 항목이 섞여 있으면 걸러낸다', () => {
    store.set('tamnalog.usedCoupons.v1', '["탐라 소품|1000", 42, null]');
    expect(isCouponUsed('탐라 소품', 1000)).toBe(true);
  });
});

describe('subscribeUsedCoupons', () => {
  it('저장하면 구독자에게 알린다 — useSyncExternalStore가 이 통로로 리렌더한다', () => {
    let calls = 0;
    const unsubscribe = subscribeUsedCoupons(() => {
      calls += 1;
    });

    markCouponUsed('탐라 소품', 1000);
    expect(calls).toBe(1);

    // 이미 사용한 쿠폰을 다시 누르면 알리지 않는다
    markCouponUsed('탐라 소품', 1000);
    expect(calls).toBe(1);

    unsubscribe();
    markCouponUsed('성산 감귤 공방', 2000);
    expect(calls).toBe(1);
  });
});
