import { describe, expect, it } from 'vitest';
import { hasSelection, toggleSelection } from './selection';

describe('hasSelection', () => {
  it('다중 선택에서 아무것도 고르지 않으면 false', () => {
    expect(hasSelection([])).toBe(false);
  });

  it('다중 선택에서 하나라도 고르면 true', () => {
    expect(hasSelection(['photo'])).toBe(true);
  });

  it('단일 선택에서 고르지 않으면 false', () => {
    expect(hasSelection(null)).toBe(false);
  });

  it('단일 선택에서 고르면 true', () => {
    expect(hasSelection('walk')).toBe(true);
  });
});

describe('toggleSelection', () => {
  it('고르지 않은 항목을 누르면 추가한다', () => {
    expect(toggleSelection([], 'photo', 3)).toEqual(['photo']);
  });

  it('이미 고른 항목을 누르면 뺀다', () => {
    expect(toggleSelection(['photo', 'cafe'], 'photo', 3)).toEqual(['cafe']);
  });

  it('상한에 도달하면 새 항목을 무시한다', () => {
    const selected = ['photo', 'cafe', 'walk'];
    expect(toggleSelection(selected, 'nature', 3)).toBe(selected);
  });

  it('상한에 도달해도 이미 고른 항목은 뺄 수 있다', () => {
    expect(toggleSelection(['photo', 'cafe', 'walk'], 'cafe', 3)).toEqual(['photo', 'walk']);
  });
});
