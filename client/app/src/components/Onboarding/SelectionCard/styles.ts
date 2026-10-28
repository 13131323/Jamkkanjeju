import { StyleSheet } from 'react-native';

export const SELECTION_CARD_TYPOGRAPHY = {
  verticalTitle: { color: '#222222', fontFamily: 'Pretendard-Bold', fontSize: 14, lineHeight: 18 },
  verticalSubtitle: { color: '#6a6a6a', fontFamily: 'Pretendard-Regular', fontSize: 11, lineHeight: 17 },
  horizontalTitle: { color: '#222222', fontFamily: 'Pretendard-Bold', fontSize: 16, lineHeight: 23 },
  horizontalSubtitle: { color: '#7c6e5e', fontFamily: 'Pretendard-Regular', fontSize: 12, lineHeight: 18 },
} as const;

const selectedStyle = {
  backgroundColor: '#f1f9e8',
  borderColor: '#77be36',
  borderWidth: 1,
} as const;

const unselectedStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#dddddd',
  borderWidth: 1,
} as const;

export function getSelectionCardStateStyle(selected: boolean) {
  return selected ? selectedStyle : unselectedStyle;
}

export const selectionCardStyles = StyleSheet.create({
  checkCircle: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#77be36',
  },
  checkText: {
    color: '#ffffff',
    fontFamily: 'Pretendard-Bold',
    fontSize: 12,
    lineHeight: 16,
  },
  // 높이를 고정하지 않는다 — 부제가 두 줄이 되는 카드가 있어 고정하면 잘린다.
  // 같은 행끼리는 stretch로 높이가 맞춰진다.
  // 상하 여백은 디자인 값 10(Penpot Int1Screen 카드 159x118의 pt/pb)이고,
  // floor는 아이콘 0.8배 축소 후 내용 높이(10+38+8+18+4+17+10 = 105)에 맞춰 낮췄다 —
  // floor가 내용보다 크면 여백을 줄여도 화면에서 달라지지 않는다.
  // justifyContent center — 행이 늘어나 카드가 minHeight보다 커지면 남는 높이가 위아래로 균등히
  // 나뉘어 상하 여백이 기기에 맞춰 자동으로 넓어진다(패딩 10은 최소 보장선).
  verticalCard: {
    minHeight: 105,
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 10,
    paddingRight: 14,
    paddingBottom: 10,
    paddingLeft: 14,
    borderRadius: 14,
  },
  // alignSelf: 'stretch' — 카드가 items-start라 auto-width가 되면 폰트 폭 오차로 불필요한 줄바꿈이 생긴다.
  verticalTextBlock: { alignSelf: 'stretch' },
  verticalTitle: { marginTop: 8 },
  verticalSubtitle: { marginTop: 4 },
  // 디자인은 51x47이지만 실기기에서 커 보여 0.8배로 줄였다(에셋도 41x38로 다시 내보냈다)
  verticalImage: { width: 41, height: 38 },
  // Penpot Int2Screen 카드 328x84 (pt/pb 12, pl 18, gap 16) 기준.
  // 디자인 84 = 12 + 아이콘 60 + 12이고, 아이콘을 48로 줄인 뒤에도 텍스트(23+3+18 = 44)가 들어간다
  // step2는 카드가 cardList의 직접 자식이라 카드 자신이 늘어난다. 내용은 이미 세로 가운데 정렬이라
  // 늘어난 높이가 그대로 상하 여백이 된다.
  // 아이콘을 54로 키우고 상하 패딩은 12 → 7로 줄였다 → 최소 68(7+54+7)
  //
  // maxHeight를 두지 않는다 — 상한에 걸려 흡수되지 못한 높이가 화면 아래 빈 공간으로 남는다.
  horizontalCard: {
    minHeight: 68,
    flexGrow: 1,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 14,
  },
  horizontalText: { flex: 1 },
  horizontalSubtitle: { marginTop: 3 },
  // Penpot Int3Screen 기준: 카드 328x118, 일러스트는 오른쪽·아래에 붙고 카드 밖으로 나간 부분은 잘린다(clipContent).
  // 텍스트(좌 18 / 상 20, 폭 214)와 일러스트(좌 131~)는 영역이 겹치므로 텍스트를 위에 올린다.
  // 일러스트를 디자인(197x118)의 0.77배(152x91)로 줄인 만큼 카드도 낮췄다 —
  // 최소 92(텍스트 14+64+14, 일러스트 91보다 크다)
  //
  // maxHeight를 두지 않는다 — 상한에 걸려 흡수되지 못한 높이가 화면 아래 빈 공간으로 남는다.
  // 카드가 늘어나면 일러스트도 같은 비율로 커진다(illustration.ts) — 크기는 컴포넌트가 주입하므로
  // 여기 width/height는 두지 않는다.
  reverseCard: {
    minHeight: 92,
    flexGrow: 1,
    flexShrink: 0,
    borderRadius: 14,
    overflow: 'hidden',
  },
  reverseText: { position: 'absolute', left: 18, top: 14, width: 214, zIndex: 1 },
  reverseImage: { position: 'absolute', right: 0, bottom: 0 },
});
