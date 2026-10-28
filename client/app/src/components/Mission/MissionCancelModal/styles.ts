import { StyleSheet } from 'react-native';

/**
 * Penpot `Cancel_Confirmation_Modal` 기준.
 * 보드 312x254 / radius 20 / 패딩 24. 미션 종류와 무관한 공통 모달이라 색도 테마를 타지 않는다.
 */
export const missionCancelModalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: 312,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  // 디자인에는 없다. TreasureRewardModal의 닫기 버튼과 같은 이유로 추가한다 —
  // 두 선택지 모두 미션을 떠나므로 "그냥 계속하기" 경로가 필요하다.
  closeButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Icon_Alert_Circle 48x48 radius 24, fill #f1f9e8(tertiary-50), 아이콘 #77be36(tertiary-600)
  alertCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f9e8',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  // Text_Group y=64 → 아이콘(48) 아래 16
  title: {
    marginTop: 16,
    color: '#111111',
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  // Modal_Subtitle y=34 → 타이틀(26) 아래 8
  subtitle: {
    marginTop: 8,
    color: '#6a6a6a',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  // Button_Group y=182 → Content_Group(24+134=158) 아래 24
  actions: { marginTop: 24, flexDirection: 'row', gap: 8 },
  // 디자인이 두 버튼을 내용에 맞춰 121 / 135로 다르게 잡았다. 모달 폭이 고정(312)이라 그대로 쓴다.
  // 색·높이·radius는 Button의 size="sm" + cool-neutral(solid / outline)이 그대로 낸다.
  pauseSlot: { width: 121 },
  abandonSlot: { width: 135 },
});
