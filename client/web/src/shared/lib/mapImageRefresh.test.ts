import { describe, expect, it } from 'vitest';
import { mapImageRefreshInterval } from './mapImageRefresh';

describe('지도 사진 갱신', () => {
  const pending = { locations: [], roadGuestbooks: [], pendingLocationImageIds: [1, 2] };
  it('준비 중인 현재 화면은 2초 후 갱신한다', () => {
    expect(mapImageRefreshInterval(pending, false, 0)).toBe(2000);
  });
  it('사진 준비 완료와 정상 사진 없음에서는 멈춘다', () => {
    expect(mapImageRefreshInterval({ ...pending, pendingLocationImageIds: [] }, false, 100)).toBe(false);
  });
  it('클러스터 화면과 데이터가 없으면 갱신하지 않는다', () => {
    expect(mapImageRefreshInterval(pending, true, 0)).toBe(false);
    expect(mapImageRefreshInterval(undefined, false, 0)).toBe(false);
  });
  it('외부 API가 계속 실패해도 2분 후 멈춘다', () => {
    expect(mapImageRefreshInterval(pending, false, 120000)).toBe(false);
  });
});
