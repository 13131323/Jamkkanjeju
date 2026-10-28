import { describe, expect, it } from 'vitest';
import { resolveAddressDisplay, type AddressDisplayInput } from './addressDisplay';

const JEJU = { lat: 33.4996, lng: 126.5312 };

// 앱 WebView 안에서 권한 응답을 기다리는 상태 — 실제 홈이 뜨는 첫 프레임이다
const base: AddressDisplayInput = {
  address: undefined,
  lastKnownAddress: undefined,
  coords: null,
  permissionStatus: 'undetermined',
  hasAddressError: false,
  isInAppWebView: true,
};

describe('resolveAddressDisplay', () => {
  it('주소가 나왔으면 행정 단위까지만 남겨 보여준다', () => {
    expect(resolveAddressDisplay({ ...base, coords: JEJU, address: '제주특별자치도 제주시 이도이동 1234-5' })).toEqual({ state: 'resolved', label: '제주특별자치도 제주시 이도이동', isStale: false });
  });

  it('앱의 권한 응답을 기다리는 동안은 로딩이다 — 실패 문구를 쓰지 않는다', () => {
    expect(resolveAddressDisplay(base)).toEqual({ state: 'loading' });
  });

  it('권한은 있고 첫 좌표를 기다리는 동안도 로딩이다', () => {
    expect(resolveAddressDisplay({ ...base, permissionStatus: 'granted-precise' })).toEqual({ state: 'loading' });
  });

  it('좌표는 왔고 주소 변환을 기다리는 동안도 로딩이다', () => {
    expect(resolveAddressDisplay({ ...base, permissionStatus: 'granted-precise', coords: JEJU })).toEqual({ state: 'loading' });
  });

  it('권한을 거부했으면 좌표가 올 길이 없다 — 확정된 실패다', () => {
    expect(resolveAddressDisplay({ ...base, permissionStatus: 'denied' })).toEqual({ state: 'unavailable' });
    expect(resolveAddressDisplay({ ...base, permissionStatus: 'blocked' })).toEqual({ state: 'unavailable' });
  });

  it('권한을 거부해도 심사위원용 모드의 고정 좌표가 들어와 있으면 실패가 아니다', () => {
    // useCurrentCoords가 모드의 고정 좌표를 권한보다 먼저 본다 — 그 좌표로 주소를 만들 수 있다
    expect(resolveAddressDisplay({ ...base, permissionStatus: 'denied', coords: JEJU })).toEqual({ state: 'loading' });
  });

  it('좌표→주소 변환이 실패했으면 좌표가 있어도 확정된 실패다', () => {
    expect(resolveAddressDisplay({ ...base, permissionStatus: 'granted-precise', coords: JEJU, hasAddressError: true })).toEqual({ state: 'unavailable' });
  });

  it('앱 밖(일반 브라우저)에서는 좌표를 밀어줄 상대가 없다 — 영원한 로딩 대신 실패로 본다', () => {
    expect(resolveAddressDisplay({ ...base, isInAppWebView: false })).toEqual({ state: 'unavailable' });
  });

  it('앱 밖이어도 이미 받아 둔 주소가 있으면 그것이 이긴다', () => {
    expect(resolveAddressDisplay({ ...base, isInAppWebView: false, coords: JEJU, address: '제주특별자치도 제주시 연동' })).toEqual({
      state: 'resolved',
      label: '제주특별자치도 제주시 연동',
      isStale: false,
    });
  });

  /**
   * 홈 WebView는 미션을 끝낼 때마다 새로 로드되고 그때마다 주소 변환을 처음부터 다시 한다.
   * 그 사이 자리표시가 반짝이는 것이 거슬린다는 지적이 있어 직전 값으로 받친다.
   * 다만 **확정 실패에는 받치지 않는다** — 그 자리에 있다는 근거가 없는데 옛 주소를 사실처럼
   * 보여주는 것이기 때문이다.
   */
  describe('직전 주소로 받치기', () => {
    const cached = { ...base, lastKnownAddress: '제주특별자치도 제주시 노형동 900' };

    it('기다리는 동안 직전 주소를 보여주고 stale로 표시한다', () => {
      expect(resolveAddressDisplay(cached)).toEqual({ state: 'resolved', label: '제주특별자치도 제주시 노형동', isStale: true });
    });

    it('좌표는 왔고 변환을 기다리는 구간에서도 받친다', () => {
      expect(resolveAddressDisplay({ ...cached, permissionStatus: 'granted-precise', coords: JEJU })).toEqual({ state: 'resolved', label: '제주특별자치도 제주시 노형동', isStale: true });
    });

    it('새 주소가 오면 곧바로 그것으로 바뀌고 stale이 아니다', () => {
      expect(resolveAddressDisplay({ ...cached, coords: JEJU, address: '제주특별자치도 서귀포시 중문동' })).toEqual({ state: 'resolved', label: '제주특별자치도 서귀포시 중문동', isStale: false });
    });

    it('권한을 거부했으면 받치지 않는다 — 그 자리에 있다는 근거가 없다', () => {
      expect(resolveAddressDisplay({ ...cached, permissionStatus: 'denied' })).toEqual({ state: 'unavailable' });
      expect(resolveAddressDisplay({ ...cached, permissionStatus: 'blocked' })).toEqual({ state: 'unavailable' });
    });

    it('변환이 실패했으면 받치지 않는다', () => {
      expect(resolveAddressDisplay({ ...cached, permissionStatus: 'granted-precise', coords: JEJU, hasAddressError: true })).toEqual({ state: 'unavailable' });
    });

    it('앱 밖이면 받치지 않는다 — 갱신될 길이 없어 옛 값이 그대로 굳는다', () => {
      expect(resolveAddressDisplay({ ...cached, isInAppWebView: false })).toEqual({ state: 'unavailable' });
    });
  });
});
