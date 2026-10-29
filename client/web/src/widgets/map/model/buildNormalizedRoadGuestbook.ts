import { useRoadGuestbookModal } from '@entities/guestbook';
import type { NormalizedGuestbook } from '@widgets/guestbook-feed';
import type { Coordinates } from '@shared/config/geo';

// 지도 길바닥 방명록 마커는 클릭당 방명록 1개만 안다(클러스터링 없음 — useGuestbookGroups 참고).
// GuestbookDetailModal은 여러 장을 넘기는 캐러셀용 컴포넌트라 배열을 받지만, 여기서는 1장짜리 캐러셀로 연다.
export function useNormalizedRoadGuestbook(guestbookId: number, coords: Coordinates | null, center: Coordinates): { data: NormalizedGuestbook | null; isLoading: boolean } {
  const { data, isLoading } = useRoadGuestbookModal(guestbookId, coords ?? center);

  if (!data) return { data: null, isLoading };

  return {
    data: {
      key: `road-${guestbookId}`,
      id: guestbookId,
      kind: 'ROAD',
      displayLocationName: data.locationAlias,
      locationTitle: null,
      characterImgUrl: data.characterImgUrl,
      userNickname: data.userNickname,
      visitedAt: data.visitedAt,
      savedAt: data.visitedAt,
      contentImageUrls: data.contentImageUrl ? [data.contentImageUrl] : null,
      contentWriting: data.contentWriting,
      contentAudioUrls: data.contentAudioUrl ? [data.contentAudioUrl] : null,
      audioTitle: null,
      contentWeather: data.contentWeather,
      contentColorCode: data.contentColorCode,
      mission: null,
    },
    isLoading,
  };
}
