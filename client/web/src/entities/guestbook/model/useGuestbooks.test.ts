import { expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { useGuestbooks } from './useGuestbooks';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn(() => ({ data: undefined })) }));

it('필터별 캐시를 분리하고 두 유형을 같은 페이지의 최대 10개씩 요청한다', () => {
  useGuestbooks(2, { guestbookType: 'ROAD', sort: 'POPULAR' });
  const popular = vi.mocked(useQuery).mock.calls.at(-1)?.[0];
  expect(popular?.queryKey).toEqual(['/api/v2/guestbooks', {
    guestbookType: 'ROAD', sort: 'POPULAR',
    generalPage: 2, generalSize: 10, roadPage: 2, roadSize: 10,
  }]);
  useGuestbooks(0);
  const defaults = vi.mocked(useQuery).mock.calls.at(-1)?.[0];
  expect(defaults?.queryKey).toEqual(['/api/v2/guestbooks', {
    guestbookType: 'ALL', sort: 'LATEST',
    generalPage: 0, generalSize: 10, roadPage: 0, roadSize: 10,
  }]);
  expect(defaults?.queryKey).not.toEqual(popular?.queryKey);
});
