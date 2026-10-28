import { describe, expect, it } from 'vitest';
import { resolveSeededLocationFilter } from './locationFilterSeed';

const OPTIONS = ['성산일출봉', '우도'];

describe('resolveSeededLocationFilter', () => {
  it('시드가 없으면 전체를 본다', () => {
    expect(resolveSeededLocationFilter({ seedTitle: null, locationOptions: OPTIONS, isLoading: false })).toEqual({ type: 'all' });
  });

  it('칩으로 존재하는 장소면 그 장소로 필터한다', () => {
    expect(resolveSeededLocationFilter({ seedTitle: '우도', locationOptions: OPTIONS, isLoading: false })).toEqual({ type: 'location', locationTitle: '우도' });
  });

  // 지도 상세의 방명록과 피드의 칩 목록은 출처가 달라서 어긋날 수 있다.
  // 칩이 없는 장소로 필터하면 선택된 칩도 없고 목록도 비어 사용자가 이유를 알 수 없다.
  it('칩 목록에 없는 장소면 전체로 되돌린다', () => {
    expect(resolveSeededLocationFilter({ seedTitle: '한라산', locationOptions: OPTIONS, isLoading: false })).toEqual({ type: 'all' });
  });

  // 로딩 중에는 칩 목록이 아직 비어 있다 — 이때 폴백하면 시드가 그냥 버려진다
  it('아직 로딩 중이면 칩 목록이 비어 있어도 시드를 유지한다', () => {
    expect(resolveSeededLocationFilter({ seedTitle: '한라산', locationOptions: [], isLoading: true })).toEqual({ type: 'location', locationTitle: '한라산' });
  });
});
