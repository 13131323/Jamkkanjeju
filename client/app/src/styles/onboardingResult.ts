import { StyleSheet } from 'react-native';

// Penpot "탐라로그 V2" > IntResultScreen_1 / IntResultScreen_Skip 기준

/**
 * 디자인 Container의 하단 여백(두 보드 모두 32).
 * 이 보드도 Android 기준(상태바 24 + 네비게이션바 48)이라 시스템 바가 이 값을 대체한다 —
 * footerBottomPadding()을 거쳐 적용한다.
 */
export const RESULT_FOOTER_BOTTOM = 32;

export const onboardingResultStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  // 화면이 넉넉하면 spacer(flex:1)가 늘어나 footer가 아래에 붙고, 모자라면 그때만 스크롤된다.
  // flexGrow 없이 두면 내용이 넘칠 때 spacer가 0으로 눌리면서 footer가 화면 밖으로 밀려
  // 루트의 하단 inset이 안 먹은 것처럼 보인다.
  scrollContent: { flexGrow: 1 },

  // ProgressWrap: pt 32 / pb 8, 그 안 Frame 179의 pb 8이 더해져 아래는 16이다. 좌우 20
  header: {
    paddingTop: 32,
    paddingRight: 20,
    paddingBottom: 16,
    paddingLeft: 20,
  },
  badge: {
    color: '#77be36',
    fontFamily: 'Pretendard-Bold',
    fontSize: 13,
    lineHeight: 16,
  },
  title: {
    marginTop: 8,
    color: '#2a2621',
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 36,
  },
  description: {
    marginTop: 6,
    color: '#63584b',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
  },

  illustration: { alignItems: 'center' },

  // 디자인 기준 폭은 290(x35)이지만, 키워드 줄(합계 289)과 캐릭터명(259)이 한 줄에 딱 맞는 수준이라
  // 폰트 폭 오차만으로 줄바꿈된다. 가운데 정렬이라 여백을 넓혀도 보이는 결과는 같으므로 16으로 넓힌다.
  contents: { paddingHorizontal: 16, alignItems: 'center' },
  // 캐릭터 칩은 PointBadge size="chip"으로 옮겼다(POINT_BADGE_SIZE_STYLES.chip에 동일 값)
  // alignSelf: 'stretch' — auto-width로 두면 폰트 폭 오차로 한 줄이 두 줄이 된다. 폭을 고정하고 textAlign으로 정렬한다.
  characterName: {
    // 디자인 Title > 칩 Container(33)는 칩 21 + 아래 12로 구성된다
    marginTop: 12,
    alignSelf: 'stretch',
    color: '#2a2621',
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'center',
  },
  characterDescription: {
    marginTop: 8,
    alignSelf: 'center',
    width: 219,
    color: '#7c6e5e',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  keywords: {
    marginTop: 32,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  keywordChip: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  keywordChipText: {
    color: '#7c6e5e',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
  },

  spacer: { flex: 1 },
  // 하단은 화면에서 footerBottomPadding(insets.bottom, RESULT_FOOTER_BOTTOM)으로 주입한다
  footer: {
    paddingTop: 12,
    paddingRight: 16,
    paddingLeft: 16,
  },
});
