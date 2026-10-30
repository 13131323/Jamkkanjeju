import type { GeneratedApi } from '@packages/shared';
import type { GeneralGuestbook, RoadGuestbook } from '@shared/api/guestbooks';

export type GuestbookKind = 'GENERAL' | 'ROAD';

export type NormalizedGuestbookMission = {
  id: number;
  missionType: GeneratedApi.AppMissionModelsMissionType;
  missionTitle: string;
};

export type NormalizedGuestbook = {
  key: string; // `${kind}-${id}` — general/road는 id 시퀀스가 별개라 합친 피드에서 겹칠 수 있어 별도 고유키를 둔다
  id: number;
  userId?: number | null;
  kind: GuestbookKind;
  displayLocationName: string; // GENERAL: location.locationTitle, ROAD: locationAlias
  locationTitle: string | null; // GENERAL 전용 위치 필터용 원본 값 (ROAD는 null)
  characterImgUrl: string | null;
  userNickname: string | null;
  visitedAt: string;
  savedAt: string;
  contentImageUrls: string[] | null;
  contentWriting: string | null;
  contentAudioUrls: string[] | null;
  audioTitle: string | null;
  contentWeather: string | null;
  contentColorCode: string | null;
  mission: NormalizedGuestbookMission | null;
  // map 모달 경유(RoadGuestbookModalResponse)로 만들어진 레코드는 이 응답 자체에 좋아요 필드가 없어 undefined다.
  isLiked?: boolean;
  likeCount?: number;
};

export function normalizeGeneralGuestbook(record: GeneralGuestbook): NormalizedGuestbook {
  return {
    key: `general-${record.id}`,
    id: record.id,
    userId: record.userId,
    kind: 'GENERAL',
    displayLocationName: record.location.locationTitle,
    locationTitle: record.location.locationTitle,
    characterImgUrl: record.characterImgUrl ?? null,
    userNickname: record.userNickname ?? null,
    visitedAt: record.visitedAt,
    savedAt: record.savedAt,
    contentImageUrls: record.contentImageUrl ? [record.contentImageUrl] : null,
    contentWriting: record.contentWriting ?? null,
    contentAudioUrls: record.contentAudioUrl ? [record.contentAudioUrl] : null,
    audioTitle: record.audioTitle ?? null,
    contentWeather: record.contentWeather ?? null,
    contentColorCode: record.contentColorCode ?? null,
    mission: record.mission ?? null,
    isLiked: record.isLiked,
    likeCount: record.likeCount,
  };
}

export function normalizeRoadGuestbook(record: RoadGuestbook): NormalizedGuestbook {
  return {
    key: `road-${record.id}`,
    id: record.id,
    userId: record.userId,
    kind: 'ROAD',
    displayLocationName: record.locationAlias,
    locationTitle: null,
    characterImgUrl: record.characterImgUrl ?? null,
    userNickname: record.userNickname ?? null,
    visitedAt: record.visitedAt,
    savedAt: record.savedAt,
    contentImageUrls: record.contentImageUrl ? [record.contentImageUrl] : null,
    contentWriting: record.contentWriting ?? null,
    contentAudioUrls: record.contentAudioUrl ? [record.contentAudioUrl] : null,
    audioTitle: record.audioTitle ?? null,
    contentWeather: record.contentWeather ?? null,
    contentColorCode: record.contentColorCode ?? null,
    mission: null,
    isLiked: record.isLiked,
    likeCount: record.likeCount,
  };
}
