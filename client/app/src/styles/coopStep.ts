import { StyleSheet } from 'react-native';

/**
 * 협동 미션 단계 화면(step1 초대 · step2 역할 배정 · step3 재료 찾기)의 공통 골격.
 *
 * 세 보드가 같은 구조다 — Penpot `TogetherMission_step1-invite-party-members`(360x800),
 * `TogetherMission_step2`·역할 배정 보드(360x899, 시트 안이 스크롤).
 * 장식 원 -91/542, Header-Zone 100(상태바 44 + 헤더 56), 타이틀 존 86~201,
 * 흰 시트 y=200, CTA 위 16 + 버튼 52 + 아래 33(홈 인디케이터 → 실제 inset이 대체).
 * 상태바 44는 실제 inset이 대체하므로 좌표에서 빼고 쓴다.
 *
 * 단계마다 다른 것은 문구와 시트 내용뿐이고, 그 둘만 CoopStepLayout이 prop으로 받는다.
 */
export const coopStepStyles = StyleSheet.create({
  screen: { flex: 1 },
  background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // Ellipse 34: x=-91, y=-36, 542x542
  circle: {
    position: 'absolute',
    left: -91,
    top: -36,
    width: 542,
    height: 542,
    borderRadius: 271,
  },

  // Frame 625: x=30, y=86, 300x115.
  // 86은 Header-Zone(0~100)의 끝이 아니라 뒤로가기 버튼(58~86)이 끝나는 지점이다 — 디자인은
  // 헤더 박스의 아래 패딩 14를 타이틀 존이 먹고 들어간다. 헤더(56)를 그린 뒤 -14로 끌어올려 맞춘다.
  // paddingBottom 16은 디자인에 없는 값이다 — Penpot은 타이틀 존(86~201)이 끝나는 자리에서 바로
  // 시트(y=200)가 시작해 부제 아래 간격이 0이었다. 그런데 시트 윗변이 기울어져 있어 양쪽 모서리에서
  // 흰 판이 부제 바로 밑까지 올라붙어 답답해 보인다는 사용자 지시가 있어 16으로 넓혔다.
  // 시트는 flex:1이라 이만큼 줄어들 뿐이고, 시트 안 목록·CTA는 절대 높이가 없어 잘리지 않는다.
  titleZone: { marginTop: -14, paddingHorizontal: 30, paddingBottom: 16, alignItems: 'center' },
  // Frame 193/627: 높이 24, radius 30, fill #fbe884
  stepBadge: {
    height: 24,
    borderRadius: 30,
    backgroundColor: '#fbe884',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#8b6f0f',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    lineHeight: 16,
  },
  title: {
    marginTop: 10,
    color: '#463f36',
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    color: '#7c6e5e',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },

  // 시트는 디자인상 y=200에서 시작한다(타이틀 존 86~201이 끝나는 자리라 원래는 별도 간격이 없다).
  // 지금은 위의 titleZone paddingBottom 16만큼 아래로 내려와 있다.
  // 배경·그림자는 InviteSheetBackdrop이 그린다 — 디자인의 시트는 사각형이 아니라
  // 윗변이 기울어진 두 판이 겹친 모양이어서 backgroundColor·borderRadius로는 낼 수 없다.
  sheet: { flex: 1 },
  /**
   * 일자 윗변 시트(재료 찾기).
   *
   * 기울어진 판(InviteSheetBackdrop) 대신 흰 배경을 직접 깐다 — 그 컴포넌트는 SVG로 기울기와
   * 그림자를 그리므로, 일자로 만들려고 각도를 0으로 주면 그림자만 남고 판 두 장이 무의미해진다.
   */
  sheetFlat: { backgroundColor: '#ffffff' },

  // CTA Wrapper: 위 16 + 버튼 52 + 아래 33(홈 인디케이터 자리 → 실제 inset이 대체)
  ctaWrapper: { paddingTop: 16, paddingHorizontal: 16, gap: 12 },
  // CTA 뒤 스크림. 디자인은 #fcfcfd가 위쪽 40% 구간에서 투명 → 불투명으로 바뀌는 세로 그라디언트로,
  // 스크롤되는 목록이 버튼 아래에서 자연스럽게 사라지게 한다
  ctaScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});

/** 배경 그라디언트 (위 → 아래). Penpot 보드 fill */
export const COOP_BACKGROUND_COLORS: [string, string] = ['#fef9e1', '#fdf2bb'];
/** 헤더 뒤 장식 원 그라디언트 */
export const COOP_CIRCLE_COLORS: [string, string] = ['#fef9e1', '#fbe884'];
/** CTA 스크림 그라디언트. locations [0, 0.4] */
export const COOP_CTA_SCRIM_COLORS: [string, string] = ['rgba(252, 252, 253, 0)', '#fcfcfd'];
