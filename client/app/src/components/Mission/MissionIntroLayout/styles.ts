import { StyleSheet } from 'react-native';

// Penpot "탐라로그 V2" > quiz-mission-detail (문화/퀴즈 미션) 기준
export const missionIntroStyles = StyleSheet.create({
  background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  circle: {
    position: 'absolute',
    left: -91,
    top: 20,
    width: 542,
    height: 542,
    borderRadius: 271,
  },

  header: { height: 56, justifyContent: 'center', paddingHorizontal: 16 },
  backButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  body: { flex: 1 },

  // 디자인 Group 101(타이틀+부제)은 헤더가 끝나는 100에서 38 아래지만,
  // 장식이 타이틀 위가 아니라 행 안으로 들어오면서 상단이 비어 보여 20으로 올림
  // overflow visible — decoAbsolute가 블록 위로 튀어나오는 배치를 쓴다
  titleBlock: { marginTop: 20, paddingHorizontal: 24, alignItems: 'center', overflow: 'visible' },
  // 타이틀 사이에 장식을 끼우는 형태. 아이콘을 타이틀 lineHeight(48) 안에 들어오는 크기로 줄여
  // 행 높이가 텍스트 기준으로 유지되고 잘리지 않는다. 크기 조절은 이 값 하나만 바꾸면 된다
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: 6,
  },
  // decoAbsolute의 left/top이 디자인 좌표와 그대로 맞도록 행을 콘텐츠 폭(360-48=312)에 고정하고
  // 타이틀은 그 안에서 가운데 정렬한다 — 행 폭이 텍스트 길이에 따라 변하면 기준점이 흔들린다
  titleRowStretch: { alignSelf: 'stretch' },
  // flex 1 — 텍스트가 행 전체(312)를 차지해야 Penpot의 312 폭 텍스트 박스와 같은 지점에서 줄이 바뀐다
  titleCentered: { flex: 1, textAlign: 'center' },
  deco: { width: 40, height: 40 },
  // 협동 미션처럼 장식이 인라인이 아니라 타이틀 위로 겹치는 경우(디자인에서 보드에 절대배치된 형태).
  // left/top/rotation은 호출부가 디자인 좌표로 주입한다.
  // [미검증] top이 음수라 타이틀 블록 위로 튀어나온다 — Android 실기기에서 잘리지 않는지 확인 필요
  decoAbsolute: { position: 'absolute' },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 32,
    lineHeight: 48,
  },
  subtitle: {
    marginTop: 4,
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
  },

  // 스켈레톤 자리표시 여백. 각각 subtitle / rewardLabel / stepTitle 자리에 대응한다
  subtitleSkeleton: { marginTop: 8 },
  rewardLabelSkeleton: { marginTop: 10 },
  stepSkeletonLine: { marginVertical: 2 },

  // paddingHorizontal 38 — rewardRow 주석의 계산에 맞춰 링 중심을 디자인 좌표(80/180/280)에 둔다
  rewardBlock: { marginTop: 24, paddingHorizontal: 38, alignItems: 'center' },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    borderRadius: 40,
    paddingLeft: 10,
    paddingRight: 8,
  },
  rewardBadgeText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 20 },
  // 디자인상 fill 없이 1px inner stroke만 있다(배지 색이 그대로 비친다). 선 색은 rewardLabelColor
  rewardBadgeMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardBadgeMarkText: { fontFamily: 'Pretendard-Medium', fontSize: 12, lineHeight: 16 },

  // 디자인 pitch 100(x=50/150/250) = 항목 폭 + gap. 링은 항목 안에서 가운데 정렬되므로
  // 폭과 gap을 합이 100이 되게 바꾸면 링 중심(80/180/280)은 그대로 있고 라벨만 넓어진다.
  //
  // 84 + 16 = 100이고 좌우 패딩은 (360 - (84*3 + 16*2)) / 2 = 38이다.
  // 원래 64였을 때는 서버가 주는 AR 캐릭터 이름("자청비 모티브 탐험가")이 한 줄에 들어가지 못해
  // 통째로 "…"로 잘렸다.
  // 디자인은 40이지만 배지와 아이콘이 떨어져 보여 28로 좁힘
  rewardRow: { marginTop: 28, flexDirection: 'row', justifyContent: 'center', gap: 16 },
  rewardItem: { width: 84, alignItems: 'center' },
  // 디자인: 60px 원에 바깥 2px + 안쪽 4px 선형 그라디언트 stroke가 겹쳐 있다.
  // RN은 그라디언트 테두리를 지원하지 않아 LinearGradient 원을 겹쳐 링을 만든다.
  // 60 + 바깥 2*2 = 64, 안쪽 4를 빼면 이미지 영역 52
  rewardRingOuter: { width: 64, height: 64, borderRadius: 32, padding: 2 },
  rewardRingInner: { width: 60, height: 60, borderRadius: 30, padding: 4 },
  // 캐릭터 PNG는 배경이 투명하다. 뒤에 깔리는 원 색은 rewardImageBackground로 주입
  // (디자인의 #d9d9d9 사각형은 그 위 흰 원에 완전히 가려지는 placeholder라 재현하지 않는다)
  rewardImage: { width: 52, height: 52, borderRadius: 26 },
  // 남은 보상이 없을 때(보상을 다 받은 미션) 원 자리에 들어가는 문구.
  // rewardRow가 flexDirection: 'row'라 폭을 안 주면 콘텐츠 폭(360-38*2=284)을 넘겨 삐져나온다.
  // flex: 1로 행을 채워 그 안에서 줄바꿈·가운데 정렬되게 한다(titleCentered와 같은 이유).
  // 크기는 subtitle과 같은 14/22 — 배지 아래 설명 문구라는 성격이 같다.
  rewardEmptyText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 22,
  },
  rewardLabel: {
    // 디자인상 원 아랫변(351)~라벨(363) = 12. 링이 2px 더 내려오므로 10
    marginTop: 10,
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
  },

  // flex: 1 — 남는 세로 공간을 흰 시트가 모두 차지해 CTA 바로 위까지 이어진다.
  // 아래 여백은 스크롤 내부(stepList)가 담당하므로 여기서는 paddingBottom을 주지 않는다
  sheet: {
    marginTop: 30,
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 34,
  },
  sheetTitle: { color: '#463f36', fontFamily: 'Pretendard-Bold', fontSize: 20, lineHeight: 30 },
  // "퀘스트 순서" 제목은 고정, 목록만 스크롤한다
  stepScroll: { flex: 1, marginTop: 24 },
  stepList: { gap: 8, paddingBottom: 24 },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingRight: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#bbb2a7',
  },
  stepNumberText: { color: '#ffffff', fontFamily: 'Pretendard-Black', fontSize: 13, lineHeight: 16 },
  stepContent: { flex: 1, gap: 2 },
  stepTitle: { color: '#63584b', fontFamily: 'Pretendard-SemiBold', fontSize: 14, lineHeight: 20 },
  stepDescription: { color: '#888888', fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 22 },

  ctaWrapper: {
    paddingTop: 16,
    paddingHorizontal: 16,
    // 흰 시트와 이어져 보이도록 시트와 같은 색. 다른 색이면 경계에 배경이 비친다
    backgroundColor: '#ffffff',
  },
});
