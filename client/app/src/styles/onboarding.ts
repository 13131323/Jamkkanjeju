import { StyleSheet } from 'react-native';

/**
 * 디자인 Container의 하단 여백. Int2/Int3가 28이고 Int1만 24다
 * (Int1은 Container 아래변이 네비게이션바를 1px 넘는 보드) → 다수인 28을 쓴다.
 * 시스템 바가 이 값을 대체하므로 footerBottomPadding()을 거쳐 적용한다.
 */
export const ONBOARDING_FOOTER_BOTTOM = 28;

export const onboardingScreenStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  // 내용이 짧은 기기에서도 본문이 화면을 채우도록 늘린다. 넘칠 때만 스크롤된다.
  scrollContent: { flexGrow: 1 },
  /**
   * 남는 세로 공간을 카드가 흡수하도록 flexGrow를 아래로 이어준다.
   *
   * 카드 높이를 고정하면 기기마다 가용 높이가 달라지는 만큼이 그대로 하단 여백이나 스크롤로 나타난다
   * (360x800/3버튼은 82 남고, 짧은 기기는 모자라 스크롤). ScrollView의 contentContainer가
   * `flexGrow: 1`이므로, 내용이 화면보다 짧을 때만 이 사슬을 타고 여유가 카드까지 내려간다.
   * 넘칠 때는 flexGrow가 아무 일도 하지 않아 카드는 minHeight로 돌아가고 그때만 스크롤된다.
   * flexShrink는 0으로 둬야 내용이 눌려 잘리지 않는다.
   */
  selectionContent: {
    flexGrow: 1,
    // 디자인은 20이지만 짧은 기기에서 스크롤을 늦추려고 12로 둔다(남으면 카드가 흡수한다)
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  cardList: { flexGrow: 1, gap: 8 },
  // maxHeight를 두지 않는다 — 상한에 걸려 흡수되지 못한 높이가 화면 아래 빈 공간으로 남는다.
  // 카드 내용은 justifyContent center라 늘어난 높이가 상하 여백으로 균등히 나뉜다.
  cardRow: { flexGrow: 1, flexShrink: 0, flexDirection: 'row', gap: 8 },
  // 디자인 Container(Int1~3 공통): pt 12 / 버튼 사이 10 / 좌우 16.
  // 하단은 화면에서 footerBottomPadding(insets.bottom, ONBOARDING_FOOTER_BOTTOM)으로 주입한다
  footer: {
    gap: 10,
    paddingTop: 12,
    paddingRight: 16,
    paddingLeft: 16,
  },
});
