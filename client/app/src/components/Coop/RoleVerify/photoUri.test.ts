import { describe, expect, it } from 'vitest';
import { resolvePhotoUri } from './photoUri';

describe('resolvePhotoUri', () => {
  it('아직 올리지 않은 팀원은 사진이 없다 — null·undefined 모두 undefined', () => {
    expect(resolvePhotoUri(null)).toBeUndefined();
    expect(resolvePhotoUri(undefined)).toBeUndefined();
  });

  it('빈 문자열·공백도 사진 없음으로 본다 — 빈 주소는 영원히 로딩되는 스켈레톤이 된다', () => {
    expect(resolvePhotoUri('')).toBeUndefined();
    expect(resolvePhotoUri('   ')).toBeUndefined();
  });

  it('주소가 있으면 그대로 돌려준다(공백을 다듬지 않는다 — 주소를 바꾸면 캐시가 갈린다)', () => {
    expect(resolvePhotoUri('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
  });
});
