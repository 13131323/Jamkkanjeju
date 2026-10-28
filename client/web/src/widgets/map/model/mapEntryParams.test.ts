import { describe, expect, it } from 'vitest';
import { parseEntryCoords, parseMissionListParam } from './mapEntryParams';

const params = (query: string) => new URLSearchParams(query);

/**
 * app의 buildNearbyMissionMapPath와 짝이 되는 쪽. 파라미터 이름이 어긋나면 목록이 열리지 않고
 * 그냥 지도만 보이므로(에러가 나지 않는다) 여기서 못박아 둔다.
 */
describe('parseMissionListParam', () => {
  it('보물찾기·협동미션만 목록으로 연다', () => {
    expect(parseMissionListParam(params('missions=treasure'))).toBe('treasure');
    expect(parseMissionListParam(params('missions=coop'))).toBe('coop');
  });

  it('없거나 목록 시트가 없는 값이면 열지 않는다 — 일반 지도 진입을 건드리면 안 된다', () => {
    expect(parseMissionListParam(params(''))).toBeNull();
    expect(parseMissionListParam(params('missions='))).toBeNull();
    expect(parseMissionListParam(params('missions=all'))).toBeNull();
    expect(parseMissionListParam(params('missions=TREASURE'))).toBeNull();
    expect(parseMissionListParam(params('mode=treasure'))).toBeNull();
  });
});

describe('parseEntryCoords', () => {
  it('lat·lng가 둘 다 있으면 좌표로 읽는다', () => {
    expect(parseEntryCoords(params('lat=33.4996&lng=126.5312'))).toEqual({ lat: 33.4996, lng: 126.5312 });
  });

  it('한쪽만 오면 버린다 — 반쪽 좌표로 지도를 옮기면 엉뚱한 곳이 된다', () => {
    expect(parseEntryCoords(params('lat=33.4996'))).toBeNull();
    expect(parseEntryCoords(params('lng=126.5312'))).toBeNull();
  });

  it("빈 문자열·숫자가 아닌 값은 버린다 — Number('')=0이 통과하면 지도가 적도로 간다", () => {
    expect(parseEntryCoords(params('lat=&lng='))).toBeNull();
    expect(parseEntryCoords(params('lat=abc&lng=126.5312'))).toBeNull();
    expect(parseEntryCoords(params('lat=33.4996&lng=abc'))).toBeNull();
  });

  it('음수 좌표도 그대로 읽는다 — 제주 안/밖 판단은 resolveDisplayLocation이 한다', () => {
    expect(parseEntryCoords(params('lat=-33.4&lng=-126.5'))).toEqual({ lat: -33.4, lng: -126.5 });
  });
});
