import { getWriteAvailabilityApiV1GuestbooksWriteAvailabilityGet } from '@/services/api/guestbook/guestbook';

// GET /api/v1/guestbooks/write-availability — 방명록 작성 페이지 진입 전에 먼저 확인해,
// 방문 기록이 없는 장소면 애초에 페이지를 열지 않는다(호출부에서 안내 토스트를 띄운다).
export async function canWriteGuestbookAt(locationId: number): Promise<boolean> {
  const { canWrite } = await getWriteAvailabilityApiV1GuestbooksWriteAvailabilityGet({ locationId });
  return canWrite;
}
