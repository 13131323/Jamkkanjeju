import { beforeEach, expect, it, vi } from 'vitest';
import { orvalClient } from '@shared/api/axios/instance';
import { getGuestbooks, toggleGuestbookLike } from './guestbooks';

vi.mock('@shared/api/axios/instance', () => ({ orvalClient: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it('선택한 유형·조회 기준와 두 유형의 페이지 조건을 그대로 서버에 전달한다', async () => {
  const params = { guestbookType: 'GENERAL', sort: 'LIKED', generalPage: 2, generalSize: 10, roadPage: 2, roadSize: 10 } as const;
  const signal = new AbortController().signal;
  await getGuestbooks(params, signal);
  expect(orvalClient).toHaveBeenCalledExactlyOnceWith({ url: '/api/v2/guestbooks', method: 'GET', params, signal });
});

it('좋아요는 유형·상태를 전송하지 않고 v2 토글 응답을 반환한다', async () => {
  const response = { guestbookId: 5, isLiked: true, likeCount: 3 };
  vi.mocked(orvalClient).mockResolvedValueOnce(response);
  await expect(toggleGuestbookLike(5)).resolves.toEqual(response);
  expect(orvalClient).toHaveBeenCalledExactlyOnceWith({ url: '/api/v2/guestbooks/5/like', method: 'POST' });
});
