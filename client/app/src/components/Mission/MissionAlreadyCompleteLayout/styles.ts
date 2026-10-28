import { StyleSheet } from 'react-native';

/**
 * Penpot "탐라로그 V2" > **TreasureHunt-detail-complete**.
 * 이미 완료한 미션에 다시 들어왔을 때의 화면(prompt §9 "이미 미션을 완료 했는데, 다시 진입한 경우").
 *
 * 좌표는 360x800 기준 디자인 값을 그대로 옮긴다. 예전에는 퀴즈 보드
 * (quiz-mission-detail-complete)를 참고했는데, 보물찾기 전용 보드가 따로 있어 그쪽 실측으로 맞췄다.
 *   - Ellipse 34: -35,-14 431x431 (#e2f2d2 → #b0da8b 그라디언트)
 *   - image 64(캐릭터): -16,90 217x217
 *   - Rectangle 83: 0,265 360x601 흰 시트 r=20
 *   - Frame 711(타이틀 + 완료 배지): 151,118 181x84 / rowGap 8
 *   - Frame 642(목록 두 블록): 16,307 / column gap 32
 *   - Container(CTA): 0,705 pad 12·16
 *
 * 보드의 세로 기준선은 상태바 44 + 헤더 56 = 100이다. 코드는 상태바를 insets.top으로 받으므로
 * 디자인 y에서 44를 뺀 값이 "헤더 위쪽부터의 거리"가 된다.
 */

/**
 * 캐릭터 상단 y — insets.top에 더해서 쓴다(디자인 y=90에서 상태바 44를 뺀 값).
 *
 * 흐름(flow) 밖으로 빼야 하는 값이라 스타일이 아니라 상수로 둔다. StyleSheet에 넣으면
 * insets.top을 더할 수가 없다.
 */
export const MISSION_ALREADY_COMPLETE_CHARACTER_TOP = 46;

/**
 * 근처 미션 카드의 사진 자리.
 *
 * 사진과 (사진이 없을 때의) 스켈레톤이 **같은 크기·라운딩**을 써야 카드가 흔들리지 않아
 * 두 곳이 함께 참조한다. skeletonColor는 흰 카드 위에서 보이는 회색이다 —
 * SkeletonBlock의 기본값(흰색)은 색이 깔린 배경 위를 전제한 값이라 여기서는 보이지 않는다.
 */
export const MISSION_CARD_PHOTO = { size: 68, radius: 10, skeletonColor: '#f6f5f4' } as const;

export const missionAlreadyCompleteStyles = StyleSheet.create({
  screen: { flex: 1 },
  background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // 헤더 뒤에 깔리는 장식 원. 좌우 비대칭 배치(x=-35)라 고정값 그대로 둔다.
  // top이 음수인 건 원이 화면 위로 14 잘려 나가는 디자인이라 그렇다 — 화면 최상단(상태바 포함)
  // 기준이므로 insets를 더하지 않는다.
  circle: {
    position: 'absolute',
    left: -35,
    top: -14,
    width: 431,
    height: 431,
    borderRadius: 215.5,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 타이틀 블록(Frame 711) — 디자인 y=118. 헤더(56) 아래 18
  titleBlock: {
    alignItems: 'center',
    gap: 8, // Frame 711 rowGap
    paddingHorizontal: 24,
    marginTop: 18,
  },
  // 캐릭터가 있을 때는 블록을 오른쪽으로 붙인다 — 캐릭터가 왼쪽에서 겹쳐 들어오는 디자인이다.
  // 오른쪽 여백 28은 Frame 711의 우측 끝(x=151 + w=181 = 332)에서 나온 값이라 16과 다르다.
  titleBlockWithCharacter: {
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingRight: 28,
  },
  // 블록 안에서는 타이틀·배지가 **왼쪽** 정렬이다(Frame 711 alignItems: start).
  // 배지(157)가 타이틀(181)보다 좁아, 오른쪽 정렬로 두면 배지가 디자인보다 24 오른쪽에 선다.
  titleColumn: {
    alignItems: 'flex-start',
    gap: 8,
  },
  /**
   * 상단 캐릭터(image 64) — 디자인 -16,90 217x217.
   *
   * 흐름에서 빼고 절대 배치하는 이유가 둘이다.
   *   1) z-order: 디자인은 Ellipse 34 < image 64 < Rectangle 83 순이라 캐릭터 아래쪽 42가
   *      흰 시트에 덮인다(217 중 화면에 보이는 건 90~265의 175뿐). 흐름에 두면 덮이지 않는다.
   *   2) 높이: 흐름에 두면 217이 타이틀 블록(84) 높이를 밀어 시트가 디자인 y=265보다 내려간다.
   *
   * 왼쪽으로 16 물려 나가는 것도 디자인 값이다. 서버 이미지라 비율을 알 수 없어 contain으로
   * 넣는다 — 원본(1254x1254)은 정사각이라 그대로 217을 채운다.
   */
  characterImage: {
    position: 'absolute',
    left: -16,
    width: 217,
    height: 217,
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 32,
    lineHeight: 48,
    // 디자인은 #152a09 → #5d992a 그라디언트 텍스트다. RN은 텍스트에 그라디언트를 채울 수 없어
    // (MaskedView 없이는) 이 레포 규칙대로 **시작 색**을 쓴다(MissionCompleteLayout titleColor와 같은 규칙).
    color: '#152a09',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    borderRadius: 40,
    paddingLeft: 10,
    paddingRight: 8,
    backgroundColor: '#b0da8b', // tertiary-300
  },
  completedBadgeText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#2d4f14',
  },
  // Vector 108 — 날짜와 "미션 완료" 사이 세로 구분선(높이 12)
  completedBadgeDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#94cc65', // tertiary-400
  },

  // 흰 시트(Rectangle 83) — 디자인 y=265. 타이틀 블록 아래에서 시작해 화면 끝까지 이어진다.
  // 63 = 265 - 202(타이틀 블록 아래끝 118+84). 헤더 56 + 18 + 84 + 63 + 상태바 44 = 265로 떨어진다.
  sheet: {
    flex: 1,
    marginTop: 63,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#ffffff',
  },
  sheetBody: {
    paddingTop: 42, // 시트 상단(265) → 첫 블록(307)
    paddingBottom: 24,
    gap: 32,
  },

  // 블록 헤더 — "근처에서 할 수 있는 보물 찾기에요" / "더보기"
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20, // 16(시트 여백) + 4(디자인 leftPadding)
    paddingRight: 16,
    marginBottom: 12,
  },
  blockTitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#0e0d0b',
  },
  blockMore: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#333333',
  },
  // 카드 줄은 화면 폭을 넘어가므로 옆으로 스크롤한다(디자인의 보드 폭 578 > 360)
  cardRow: {
    paddingHorizontal: 16,
    gap: 8,
  },

  // 근처 미션 카드 — 285x96
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: 285,
    height: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dddddd',
    backgroundColor: '#ffffff',
    paddingHorizontal: 13,
  },
  missionCardPhoto: {
    width: MISSION_CARD_PHOTO.size,
    height: MISSION_CARD_PHOTO.size,
    borderRadius: MISSION_CARD_PHOTO.radius,
    backgroundColor: MISSION_CARD_PHOTO.skeletonColor,
  },
  missionCardBody: {
    flex: 1,
    gap: 8,
  },
  missionCardTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: '#121212',
  },
  missionCardDistance: {
    marginTop: 2,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#aaaaaa',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 11,
    lineHeight: 14,
  },

  // 쿠폰 카드(list) — 148x164
  couponCard: {
    justifyContent: 'center',
    gap: 20,
    width: 148,
    height: 164,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dddddd',
    backgroundColor: '#ffffff',
    paddingHorizontal: 13,
  },
  // Frame 671 — 아이콘(20) + columnGap 4 + 분류 문구
  couponCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  /**
   * 카드 첫째 줄 문구.
   *
   * 디자인은 이 자리에 장소 이름을 두고 아래에 고정 문구를 뒀는데, 지시로 둘을 맞바꿨다.
   * **색·굵기는 자리에 남긴다** — 위는 아이콘과 한 행을 이루는 캡션(600/#958573), 아래는
   * 본문(400/#222222), 그 아래가 혜택(Bold/#121212)으로 내려갈수록 강조가 커지는 위계다.
   * 문구를 따라 색까지 옮기면 고정 분류가 가게 이름보다 강조돼 위계가 뒤집힌다.
   */
  couponCategory: {
    flexShrink: 1,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 22,
    color: '#958573', // warm-neutral
  },
  couponStore: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#222222',
  },
  couponBenefit: {
    marginTop: 2,
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#121212',
  },
  couponUseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbe7b1', // tertiary-200
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
  },
  couponUseButtonText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#45741f', // tertiary-800
  },

  // CTA — 버튼 2개가 반씩. 디자인 160+8+160 = 328
  ctaWrapper: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  ctaButton: {
    flex: 1,
  },
});
