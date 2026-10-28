export type ArCharacterColorFamily = 'primary' | 'tertiary' | 'sunnyYellow' | 'warmNeutral' | 'coolNeutral' | 'vibrantOrange';

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
  // 카드 뒷면 "획득 조건"에 그대로 찍는 한 줄. 예전에는 acquiredMissions[]를 목록으로 폈는데,
  // 그 배열은 "이미 깬 미션"이라 미획득 캐릭터에서는 비거나 조건과 어긋났다(사용자 지시로 교체).
  acquireCondition: string;
  colorFamily: ArCharacterColorFamily;
};
