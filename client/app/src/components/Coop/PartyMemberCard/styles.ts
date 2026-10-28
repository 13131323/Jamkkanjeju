import { StyleSheet } from 'react-native';

/**
 * Penpot `TogetherMission_step1-invite-party-members`의 member-card 두 변형.
 *
 * 카드 320x68 / radius 14 / 좌우 16 / 아바타·정보 간격 12
 * - member-card-0 (나): fill #fdf2bb, stroke #f2d21e, 아바타 흰색
 * - member-card-1 (타인): fill #ffffff 80%, stroke #eaeaea, 아바타 #f2f2f2
 */
export const partyMemberCardStyles = StyleSheet.create({
  card: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 16,
  },
  cardMe: { backgroundColor: '#fdf2bb', borderColor: '#f2d21e' },
  // 시트가 흰색이라 80% 흰색은 거의 흰색으로 보이지만, 카드가 시트 위에 겹친 층이라는
  // 디자인 의도를 그대로 옮긴다(rgba로 두면 배경이 바뀌어도 관계가 유지된다)
  cardOther: { backgroundColor: 'rgba(255, 255, 255, 0.8)', borderColor: '#eaeaea' },

  // Avatar 38x38 radius 19
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: { backgroundColor: '#ffffff' },
  avatarOther: { backgroundColor: '#f2f2f2' },

  // Info x=66 → avatar(16+38=54) 기준 12
  info: { marginLeft: 12, flex: 1 },
  name: {
    color: '#0e0d0b',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  // 역할 라벨("방장" / "일행")
  role: {
    marginTop: 2,
    color: '#7c6e5e',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
  },

  /** InlineActions: 거절 + 수락, 간격 4 */
  actions: { flexDirection: 'row', gap: 4 },
});
