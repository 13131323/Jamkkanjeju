export type GuestbookWriteMissionType = 'treasure' | 'coop';

export type GuestbookWriteParams = {
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  missionId?: string;
  missionTitle?: string;
  missionType?: GuestbookWriteMissionType;
  lat?: number;
  lng?: number;
};

// 방명록 작성 화면(/travel-note/write) 진입점 3곳(장소 상세/필터 모달/지도)이 서로 다른 정보를 들고 있어
// 쿼리스트링으로 전달한다. 값이 없는 필드는 쿼리에서 아예 뺀다.
export function buildGuestbookWriteHref(params: GuestbookWriteParams): string {
  const search = new URLSearchParams();
  if (params.placeId) search.set('placeId', params.placeId);
  if (params.placeName) search.set('placeName', params.placeName);
  if (params.placeAddress) search.set('placeAddress', params.placeAddress);
  if (params.missionId) search.set('missionId', params.missionId);
  if (params.missionTitle) search.set('missionTitle', params.missionTitle);
  if (params.missionType) search.set('missionType', params.missionType);
  if (params.lat != null) search.set('lat', String(params.lat));
  if (params.lng != null) search.set('lng', String(params.lng));

  const query = search.toString();
  return query ? `/travel-note/write?${query}` : '/travel-note/write';
}

// buildGuestbookWriteHref로 실어보낸 쿼리스트링을 /travel-note/write 진입 시 다시 꺼내 쓴다.
export function parseGuestbookWriteParams(searchParams: URLSearchParams): GuestbookWriteParams {
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const missionType = searchParams.get('missionType');

  return {
    placeId: searchParams.get('placeId') ?? undefined,
    placeName: searchParams.get('placeName') ?? undefined,
    placeAddress: searchParams.get('placeAddress') ?? undefined,
    missionId: searchParams.get('missionId') ?? undefined,
    missionTitle: searchParams.get('missionTitle') ?? undefined,
    missionType: missionType === 'treasure' || missionType === 'coop' ? missionType : undefined,
    lat: lat != null ? Number(lat) : undefined,
    lng: lng != null ? Number(lng) : undefined,
  };
}
