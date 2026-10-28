import type { GeneratedApi } from '@packages/shared';
import type { NormalizedGuestbook } from './normalizeGuestbook';
import type { CardType } from './types';
import { parseWeatherContent } from './weatherContent';

export type LocationFilterValue = { type: 'all' } | { type: 'road' } | { type: 'location'; locationTitle: string };

// 카드 디자인 자체는 없어졌지만(weather 카드 제거) 필터 탭은 유지된다 — 실제 카드 타입과 무관하게
// contentWeather가 있는 레코드 전부를 보여주는 별도 필터 값.
export type FeedFilterValue = CardType | 'weather' | 'all';

// GET /api/v1/guestbooks의 visitedLocations(현재 사용자가 방문한 장소 전체)를 그대로 칩으로 쓴다.
// 현재 화면에 보이는 방명록에서 장소명을 뽑던 이전 방식과 달리, 방명록이 아직 없는 방문지도 칩에 뜬다.
export function getLocationFilterOptions(visitedLocations: GeneratedApi.VisitedLocationSummaryResponse[]): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const location of visitedLocations) {
    if (!seen.has(location.locationTitle)) {
      seen.add(location.locationTitle);
      titles.push(location.locationTitle);
    }
  }

  return titles;
}

export function applyLocationFilter(records: NormalizedGuestbook[], filter: LocationFilterValue): NormalizedGuestbook[] {
  switch (filter.type) {
    case 'all':
      return records;
    case 'road':
      return records.filter((record) => record.kind === 'ROAD');
    case 'location':
      return records.filter((record) => record.kind === 'GENERAL' && record.locationTitle === filter.locationTitle);
  }
}

// records는 이미 assignedTypes에 전부 존재한다고 가정한다 (호출부에서 후보 없는 레코드를 미리 걸러둠)
export function applyCardTypeFilter(records: NormalizedGuestbook[], assignedTypes: Map<string, CardType>, filter: FeedFilterValue): NormalizedGuestbook[] {
  if (filter === 'all') return records;
  // weather는 더 이상 카드 타입이 아니라서 assignedTypes로 못 거른다 — 카드 디자인(사진/글/오디오)과 무관하게
  // 날씨 데이터가 붙어있는 레코드 전부를 보여준다.
  if (filter === 'weather') return records.filter((record) => parseWeatherContent(record.contentWeather) !== null);
  return records.filter((record) => assignedTypes.get(record.key) === filter);
}
