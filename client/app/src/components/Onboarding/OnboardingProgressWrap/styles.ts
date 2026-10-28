import { StyleSheet } from 'react-native';

export const onboardingProgressStyles = StyleSheet.create({
  // 디자인 값 163은 최소 높이로만 쓴다. 고정하면 기기가 커진 만큼이 그대로
  // 화면 아래 빈 공간으로 남고, 짧은 기기에서는 제목 두 줄이 잘린다.
  container: {
    minHeight: 163,
    paddingTop: 12,
    paddingRight: 20,
    paddingBottom: 8,
    paddingLeft: 20,
  },
  header: { height: 36, flexDirection: 'row', alignItems: 'center' },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f5f4',
  },
  backIcon: {
    width: 9,
    height: 9,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#222222',
    transform: [{ rotate: '45deg' }],
  },
  badge: {
    marginLeft: 'auto',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f1f9e8',
  },
  badgeText: {
    fontSize: 13,
    lineHeight: 16,
  },
  badgeCurrent: {
    color: '#77be36',
    fontFamily: 'Pretendard-Bold',
  },
  badgeTotal: {
    color: '#6a6a6a',
    fontFamily: 'Pretendard-Regular',
  },
  title: {
    marginTop: 16,
    color: '#2a2621',
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 32,
  },
  description: {
    marginTop: 6,
    color: '#7c6e5e',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});
