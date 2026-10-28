import { describe, expect, it } from 'vitest';
import { buildGuestbookWritePath } from './guestbookWebUrl';

/**
 * web의 parseGuestbookWriteParams와 짝이 되는 쪽. 이름이 어긋나도 화면은 그냥 빈 폼으로 열려
 * (에러가 나지 않는다) 사용자는 미션 정보가 빠진 줄 모른다 — 그래서 여기서 못박아 둔다.
 */
const EMPTY: Parameters<typeof buildGuestbookWritePath>[0] = {
  placeId: null,
  placeName: null,
  missionId: null,
  missionTitle: null,
  missionType: null,
  coords: null,
};

function query(path: string): URLSearchParams {
  return new URLSearchParams(path.slice(path.indexOf('?') + 1));
}

describe('buildGuestbookWritePath', () => {
  it('web 라우트 경로로 시작한다', () => {
    expect(buildGuestbookWritePath({ ...EMPTY, missionType: 'treasure' }).startsWith('/travel-note/write?')).toBe(true);
  });

  it('값이 하나도 없으면 쿼리를 붙이지 않는다 — 빈 `?`가 남으면 안 된다', () => {
    expect(buildGuestbookWritePath(EMPTY)).toBe('/travel-note/write');
  });

  it('미션 정보를 넘긴다', () => {
    const params = query(buildGuestbookWritePath({ ...EMPTY, missionId: 12, missionTitle: '천지연 보물찾기', missionType: 'treasure' }));

    expect(params.get('missionId')).toBe('12');
    expect(params.get('missionTitle')).toBe('천지연 보물찾기');
    expect(params.get('missionType')).toBe('treasure');
  });

  it('좌표가 있으면 넘긴다 — placeId가 없는 방명록은 이 값이 곧 위치다', () => {
    const params = query(buildGuestbookWritePath({ ...EMPTY, coords: { lat: 33.2451, lng: 126.5623 } }));

    expect(params.get('lat')).toBe('33.2451');
    expect(params.get('lng')).toBe('126.5623');
  });

  it('좌표가 없거나 숫자가 아니면 붙이지 않는다 — 권한 거부·측위 실패', () => {
    expect(buildGuestbookWritePath(EMPTY)).not.toContain('lat');
    expect(buildGuestbookWritePath({ ...EMPTY, coords: { lat: Number.NaN, lng: 126.5 } })).not.toContain('lat');
  });

  it('장소 id가 0이어도 넣는다 — 진위값으로 거르면 id 0인 장소가 사라진다', () => {
    expect(query(buildGuestbookWritePath({ ...EMPTY, placeId: 0 })).get('placeId')).toBe('0');
  });

  it('빈 문자열은 넣지 않는다 — 호출부가 없는 값을 빈 문자열로 넘겨도 URL에 남으면 안 된다', () => {
    const path = buildGuestbookWritePath({ ...EMPTY, placeName: '', missionTitle: '' });

    expect(path).not.toContain('placeName');
    expect(path).not.toContain('missionTitle');
  });

  it('공백·한글이 섞인 장소명을 인코딩한다 — 그대로 넣으면 URL이 잘린다', () => {
    const path = buildGuestbookWritePath({ ...EMPTY, placeId: 7, placeName: '한담 해안 산책로' });

    expect(path).not.toContain(' ');
    expect(query(path).get('placeName')).toBe('한담 해안 산책로');
  });
});
