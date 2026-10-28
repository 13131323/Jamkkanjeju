import { StyleSheet } from 'react-native';

/**
 * Penpot `탐라로그 V2 / RoleCard` 기준.
 *
 * 접힌 카드 320x62 / 좌우·상하 패딩 12|16 / 헤더 행 간격 14
 * - 내 카드: fill #fef9e1, radius 14, 아바타 테두리 #f2d21e 1.5
 * - 팀원 카드: fill #ffffff 70%, stroke #dddddd 1, radius 16, 아바타 테두리 #dddddd 1.5
 * 펼쳐지면 헤더 아래로 18 간격을 두고 내용이 붙는다(내 역할 카드는 아래 패딩이 24).
 */
export const roleCardStyles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cardMine: { backgroundColor: '#fef9e1', borderRadius: 14 },
  // 시안(assets/images/1.png)의 "함께하는 역할"은 불투명 흰색이다. 반투명이면 뒤 그라디언트가
  // 비쳐 카드마다 색이 달라 보인다.
  cardOther: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dddddd',
  },
  /**
   * 선택 강조는 **테두리만** 바꾼다.
   *
   * 예전에는 배경까지 #fdf2bb로 덮어서 내 역할 카드가 cardMine(#fef9e1)보다 진했다 —
   * 시안의 내 역할 카드는 연노랑 한 가지 색이고 테두리만 노랗다.
   */
  cardSelected: {
    borderWidth: 1,
    borderColor: '#f2d21e',
  },
  cardBorderless: { borderWidth: 0 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /**
   * 펼친 카드에서만 붙는 헤더 아래 구분선.
   *
   * Penpot 값은 `Frame 667`의 1px **점선** #cfc8c0였는데 사용자 지시로 같은 색의
   * 1px **실선**(colors/neutrals/warm/200 #cfc8c0)을 헤더 행 아랫면에 직접 건다.
   * 점선 구분선(DashedLine)은 이 테두리로 대체했다 — 둘을 같이 두면 선이 겹친다.
   * 아래 8 + 선 1 + 내용 위 10 = 헤더에서 19로, 원래의 "헤더 아래 18"을 그대로 유지한다.
   */
  headerRowDivided: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cfc8c0',
  },

  // Avatar 38x38. 원형 + 1.5px 테두리
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5 },
  avatarMine: { borderColor: '#f2d21e' },
  avatarOther: { borderColor: '#dddddd' },
  avatarPlain: { borderRadius: 0, borderWidth: 0 },

  // TitleRow: 역할명 + 담당자 + 상태칩, 간격 6
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // 역할명이 길어도 담당자·상태칩을 밀어내지 않도록 이 글자만 줄어든다(numberOfLines 1과 한 쌍)
  roleName: {
    flexShrink: 1,
    color: '#2a2621',
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    lineHeight: 24,
  },
  owner: {
    flexShrink: 1,
    color: '#63584b',
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  /**
   * 상태칩 자리. Penpot은 헤더 오른쪽 끝(화살표 앞)이었는데 사용자 지시로
   * 담당자 이름 바로 옆으로 옮겼다 — 간격은 TitleRow의 6을 그대로 쓴다.
   * 칩은 글자 수만큼만 넓으면 되므로 이름이 길어도 줄어들지 않게 막는다.
   */
  statusSlot: { flexShrink: 0 },

  // back-click 28x28 안의 화살표 20x20
  toggle: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  /**
   * 펼친 영역(아코디언).
   *
   * **자체 배경·테두리를 두지 않는다.** 시안(assets/images/1.png)에서 펼친 내용은 카드 배경
   * 위에 그대로 얹혀 있다 — 내 역할이면 연노랑(cardMine), 팀원이면 흰색(cardOther)이 그 바탕이다.
   * 여기에 또 판을 깔면 카드 안에 색이 다른 상자가 하나 더 생긴다.
   * 좌우 패딩도 없다. 카드가 이미 16을 갖고 있어 안쪽에서 한 번 더 주면 내용이 좁아진다.
   *
   * 구분선 위아래 여백을 **위 값(8)으로 통일**한다(사용자 지시). 예전에는 위 8 / 아래 10이라
   * 선이 가운데가 아니라 위쪽에 붙어 보였다 — 같은 선을 사이에 둔 여백이 다를 이유가 없다.
   */
  contents: { marginTop: 8 },
});
