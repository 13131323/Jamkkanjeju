import { expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { useMyPage } from './useMyPage';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn(() => ({})) }));

it('요약과 캐릭터 상세 조회에서 같은 v2 캐시를 공유한다', () => {
  useMyPage();
  useMyPage();
  const calls = vi.mocked(useQuery).mock.calls;
  expect(calls[0][0].queryKey).toEqual(['/api/v2/users/me/mypage']);
  expect(calls[0][0].queryKey).toEqual(calls[1][0].queryKey);
  expect(calls[0][0].throwOnError).toBe(false);
});
