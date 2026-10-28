'use client';

import { useMemo } from 'react';
import { useMyPage } from '@entities/user';
import type { ArCharacterColorFamily, ArCharacterDetail } from './types';

const COLOR_FAMILIES: ArCharacterColorFamily[] = ['primary', 'tertiary', 'sunnyYellow'];

// 캐릭터 상세 전용 API는 추가하지 않는다 — GET /users/me/mypage의 arCharacters[]가 이미 상세 표시에 필요한
// 필드(이야기/해시태그/획득조건/획득미션)를 획득 여부와 관계없이 전부 내려주므로 그걸 그대로 찾아 쓴다.
// useMyPage()는 TanStack Query 캐시를 공유해서, 마이페이지 요약 화면에서 이미 조회했다면 여기서 재요청하지 않는다.
export function useArCharacterDetail(characterId: string) {
  const { data, isLoading, isError } = useMyPage();
  const numericId = Number(characterId);

  const character = useMemo<ArCharacterDetail | null>(() => {
    const raw = data?.arCharacters.find((item) => item.id === numericId);
    if (!raw) return null;

    return {
      id: raw.id,
      name: raw.name,
      imageUrl: raw.imageUrl,
      acquiredAtLabel: raw.acquiredAt ? raw.acquiredAt.replaceAll('-', '.') : '획득 예정',
      acquiredPlaceLabel: raw.acquiredLocation ? `${raw.acquiredLocation}에서 획득` : raw.acquireCondition,
      catchphrase: raw.storyTitle,
      description: raw.storyContent,
      hashtags: raw.hashtags,
      acquiredMissions: raw.acquiredMissions,
      colorFamily: COLOR_FAMILIES[raw.id % COLOR_FAMILIES.length],
    };
  }, [data, numericId]);

  return { data: character, isLoading, isError: isError || (!isLoading && !character) };
}
