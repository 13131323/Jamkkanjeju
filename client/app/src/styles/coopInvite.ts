import { StyleSheet } from 'react-native';

/**
 * 협동 미션 초대 화면(step1)의 시트 내용 스타일.
 *
 * 화면 골격(배경·장식 원·타이틀 존·시트·CTA)은 세 단계가 공유하므로 `coopStep.ts`에 있다.
 * 여기 남은 것은 step1에만 있는 참여 멤버 섹션이다.
 * Penpot `TogetherMission_step1-invite-party-members` > MembersListSection (x=20, y=270).
 */
export const coopInviteStyles = StyleSheet.create({
  /**
   * 섹션 헤더("참여 멤버 (n/6)" + 최소 인원 안내).
   *
   * 스크롤 영역 **밖**에 둔다 — 요구사항이 "참여 멤버 text가 있는 부분까지만 스크롤"이다.
   * 목록만 움직이고 헤더는 시트에 고정된다.
   * paddingTop 70 = 시트 상단(200) → 섹션(270)
   */
  sectionHeader: { paddingHorizontal: 20, paddingTop: 70 },
  sectionTitle: {
    color: '#463f36',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  /**
   * 헤더를 **두 덩어리**로 나눈 줄(사용자 제안): 왼쪽은 "참여 멤버 (n/N)" + 안내 문구,
   * 오른쪽은 초대 칩.
   *
   * `alignItems: 'flex-end'`라 칩이 왼쪽 두 줄의 **아래쪽**에 맞춰 선다. 칩 위에 여백이 생기는
   * 건 상관없다(사용자 확인) — 제목에 맞춰 위로 붙이면 안내 문구와 칩이 서로 다른 줄에 떠서
   * 두 요소가 무관해 보인다.
   */
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  /** 왼쪽 덩어리. 문구가 길어지면 칩을 밀어내지 않고 이쪽이 줄어든다 */
  sectionHeaderText: { flexShrink: 1 },
  minNotice: {
    marginTop: 4,
    color: '#7c6e5e',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  /**
   * "일행 초대" 칩(chip-outline). 색은 협동 미션 CTA와 같은 #ff8f18이다.
   *
   * 채우지 않고 테두리만 두는 이유: 바로 아래 멤버 카드들과 화면 하단 "다음" CTA 사이에서
   * 세 번째로 눈에 띄면 안 되는 **보조 동작**이다.
   *
   * **치수는 재료 찾기의 "촬영 가이드" 칩과 같다**(사용자 지시) — styles/coopRoles.ts의 guideChip:
   * 높이 24 / radius 40 / 좌 10·우 8 / 테두리 1. 두 화면에 같은 모양의 보조 칩이 서로 다른
   * 크기로 뜨면 그게 곧 어긋남이라, 색만 다르고 나머지는 같은 값을 쓴다.
   */
  inviteChip: {
    height: 24,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#ff8f18',
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    // 문구가 길어져도 칩은 줄지 않는다 — 줄어들면 라벨이 잘린다
    flexShrink: 0,
  },
  /** 정원이 찼을 때. 테두리·라벨을 함께 흐리게 해서 "지금은 못 누른다"가 보이게 한다 */
  inviteChipDisabled: { opacity: 0.4 },
  /** guideChipText와 같은 규격(12/16). 색만 협동 오렌지다 */
  inviteChipLabel: {
    color: '#ff8f18',
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  /**
   * 목록 스크롤 영역. flex를 주지 않으면 콘텐츠 높이만큼 늘어나 CTA가 화면 밖으로 밀린다
   * (시트가 column flex 컨테이너이고 ScrollView의 기본 flex는 0이다)
   */
  scroll: { flex: 1 },
  /**
   * List: 섹션 헤더(42)에서 16 아래, 카드 사이 14.
   *
   * 마지막 항목("+ 동반 일행 초대하기")이 CTA 스크림에 가리지 않도록 아래 여백을 16에서 넓혔다 —
   * 스크롤을 끝까지 내렸을 때 버튼 아래로도 숨 쉴 자리가 있어야 "더 있나?" 싶지 않다.
   */
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 14 },
});
