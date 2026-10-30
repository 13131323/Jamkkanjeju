import { DEFAULT_GUESTBOOK_FILTERS, getGuestbooks } from '@shared/api/guestbooks';

/** v2 조회의 본인 방문 장소 목록으로 작성 진입 가능 여부를 확인한다. 최종 검증은 작성 API가 한다. */
export async function canWriteGuestbookAt(locationId: number): Promise<boolean> {
  const response = await getGuestbooks({ ...DEFAULT_GUESTBOOK_FILTERS, guestbookType: 'GENERAL',
    generalPage: 0, generalSize: 1, roadPage: 0, roadSize: 1 });
  return response.visitedLocations.some((location) => location.id === locationId);
}
