import type { GeneratedApi } from '@packages/shared';

export type ArCharacterColorFamily = 'primary' | 'tertiary' | 'sunnyYellow';

// GET /users/me/mypage 응답의 arCharacters[] 한 건을 상세 화면 표시용으로 가공한 것.
// 상세 전용 API는 따로 없고, 마이페이지 요약 화면이 이미 받아온 데이터를 그대로 재사용한다(useArCharacterDetail 참고).
export type ArCharacterDetail = {
  id: number;
  name: string;
  imageUrl: string;
  acquiredAtLabel: string;
  acquiredPlaceLabel: string;
  catchphrase: string;
  description: string;
  hashtags: string[];
  acquiredMissions: GeneratedApi.AcquiredMissionResponse[];
  colorFamily: ArCharacterColorFamily;
};
