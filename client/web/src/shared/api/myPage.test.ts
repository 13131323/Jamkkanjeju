import { expect, it, vi } from 'vitest';
import { orvalClient } from '@shared/api/axios/instance';
import { getMyPage, MY_PAGE_QUERY_KEY } from './myPage';

vi.mock('@shared/api/axios/instance', () => ({ orvalClient: vi.fn() }));

it('마이페이지를 v2로 조회하고 취소 신호를 전달한다', async () => {
  const signal = new AbortController().signal;
  await getMyPage(signal);
  expect(orvalClient).toHaveBeenCalledExactlyOnceWith({ url: '/api/v2/users/me/mypage', method: 'GET', signal });
  expect(MY_PAGE_QUERY_KEY).toEqual(['/api/v2/users/me/mypage']);
});
