import { StyleSheet } from 'react-native';

/**
 * 협동 미션 step2(역할 배정) · step3(재료 찾기) 시트 내용.
 *
 * Penpot 역할 배정 보드 / `TogetherMission_step2` 기준 — 시트 상단(202)에서 20 아래에
 * List(x=20, y=222)가 시작하고, 카드 사이 간격은 10이다.
 * step3만 "나의 역할" 블록과 "함께하는 역할" 블록 사이가 24로 벌어진다(RolesList gap).
 */
export const coopRolesStyles = StyleSheet.create({
  /** 스크롤 영역. flex 없이 두면 콘텐츠 높이만큼 늘어나 CTA가 화면 밖으로 밀린다 */
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },

  /** Frame 619/655: 섹션 라벨 + (있으면) 촬영 가이드 버튼 */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  /**
   * 재료 찾기의 "나의 역할" 헤더.
   *
   * 이제 스크롤 안에 있어서(사용자 지시) 좌우·위 여백은 **스크롤 내용 컨테이너가 준다** —
   * 여기서 또 주면 두 번 겹친다. 예전의 위 여백 70은 기울어진 시트 윗변을 피하려던 값인데,
   * 이 화면은 윗변이 일자가 되어(CoopStepLayout의 flatTop) 비켜 갈 대상 자체가 없다.
   * 카드와의 간격만 남긴다.
   */
  selectionSectionHeader: {
    marginBottom: 10,
  },
  sectionLabel: {
    color: '#463f36',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },

  /** Frame 481: 촬영 가이드 알약. 높이 24 / radius 40 / 좌 10·우 8 / 테두리 #bbb2a7 */
  guideChip: {
    height: 24,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#bbb2a7',
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  guideChipText: {
    color: '#63584b',
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
  },

  /** Frame 654: 역할 카드 목록 */
  list: { gap: 10 },
  /** step2: 고정 헤더 아래에서 카드 목록만 스크롤한다 */
  selectionListContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },

  /** step2: "나의 역할" 블록 → 목록 10 / step3: 24 */
  blockGapSmall: { marginTop: 10 },
  blockGapLarge: { marginTop: 24 },

  /** step3 내 역할 카드 안: 인증 영역 → 설명 12 (Penpot RoleCard의 column gap) */
  verifyDetailGap: { marginTop: 12 },

  /** 역할을 아직 고르지 않았을 때의 안내. 디자인에는 없는 상태다(항상 배정된 화면만 있다) */
  emptyNotice: {
    color: '#7c6e5e',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
});
