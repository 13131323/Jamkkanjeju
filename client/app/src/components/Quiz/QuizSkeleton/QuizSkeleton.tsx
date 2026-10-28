import { View } from 'react-native';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { CTA_BOTTOM_GAP } from '@/styles/safeArea';

/**
 * 문화 미션 퀴즈 화면(`app/mission/culture.tsx`)이 시작 응답을 기다리는 동안 그리는 자리표시.
 *
 * 미션 홈에서 "시작하기"를 누르면 진행도 생성 요청이 오가는 동안 이 화면이 보인다 —
 * 사용자가 말한 "다음 화면 넘어갈 때 뜨는 로딩"이 이 자리다. 예전에는 화면 한가운데
 * `ActivityIndicator` 하나였고, 응답이 오는 순간 진행바·이미지·문제·보기가 한꺼번에 나타났다.
 *
 * ## 크기의 출처
 *
 * 스피너를 회색 사각형으로 바꾸는 것이 목적이 아니라 **곧 나타날 것의 모양**을 대신 그리는 것이
 * 목적이라, 아래 값은 전부 culture.tsx가 실제로 그리는 요소에서 가져왔다. 하나라도 어긋나면
 * 값이 도착할 때 화면이 튄다.
 *
 * | 자리        | 실제 요소                                   | 높이                                  |
 * | ----------- | ------------------------------------------- | ------------------------------------- |
 * | 진행바      | `QuizProgressBar`                           | 라벨 16(label-sm) + gap 8 + 트랙 6 = 30 |
 * | 이미지 카드 | `QuizIllustrationCard`                      | 180 (CARD_HEIGHT), radius 20          |
 * | 문제        | heading-h4 18/26                            | 26 x {@link QUESTION_LINE_COUNT}      |
 * | 보기        | `QuizOption` 52, radius 16, 사이 gap 10     | 52 x {@link OPTION_COUNT}             |
 * | CTA         | Button md                                   | 52, radius 999                        |
 *
 * 바깥 여백(좌우 16 / 위 10 / 블록 사이 20 / CTA 줄의 gap 12)도 culture.tsx의 className 값과 같다
 * (`mt-5`=20, `gap-2.5`=10, `gap-3`=12, `px-4`=16).
 *
 * ## 개수를 어떻게 정했나
 *
 * 문제 줄 수와 보기 개수는 응답이 와야 알 수 있다. MissionIntroLayout이 보상·퀘스트 자리표시에
 * 쓰는 방식 그대로 **디자인 기준값**을 쓴다 — 보기는 4지선다가 기본이고, 문제는 Penpot 시안이
 * 두 줄짜리 문장이다. 실제 문제가 한 줄이면 보기가 26만큼 위로 올라오는데, 스피너에서 통째로
 * 바뀌던 예전보다는 훨씬 작은 변화다.
 *
 * 이미지 카드는 **있는 쪽으로 가정한다.** 서버는 문제마다 이미지를 주고 culture.tsx는 없을 때만
 * 카드를 빼므로, 없는 쪽을 기본으로 두면 흔한 경우에서 180이 통째로 밀려 내려온다.
 */

/** 문제 문장이 차지할 줄 수(heading-h4 18/26). 실제 줄 수는 응답이 와야 알 수 있다 */
const QUESTION_LINE_COUNT = 2;
/** 보기 개수. 서버 퀴즈는 4지선다가 기본이다 */
const OPTION_COUNT = 4;

/** heading-h4의 행 높이. 막대(18) 위아래에 4씩 둬서 실제 글줄과 같은 26을 만든다 */
const QUESTION_LINE_HEIGHT = 26;
const QUESTION_BAR_HEIGHT = 18;

/** 문제 줄 폭. 마지막 줄은 짧게 끝나는 실제 문장을 흉내 낸다 */
const QUESTION_LINE_WIDTHS = ['92%', '64%'] as const;

/** 흰 배경(#ffffff → #f6f6f6) 위라 흰색 자리표시는 보이지 않는다. cool-neutral-100 */
const SKELETON_COLOR = '#efefef';

interface QuizSkeletonProps {
  /** CTA 줄의 아래 여백. 화면이 `ctaBottomPadding(insets.bottom)`으로 계산해 넘긴다 */
  ctaBottomPadding: number;
}

export function QuizSkeleton({ ctaBottomPadding }: QuizSkeletonProps) {
  return (
    // 글자가 하나도 없는 화면이라 스크린리더에게 상태를 한 줄로 알린다
    <View style={{ flex: 1 }} accessible accessibilityLabel="퀴즈를 불러오는 중">
      {/* 실제 화면은 ScrollView지만 자리표시는 한 화면에 들어가므로 스크롤을 두지 않는다.
          contentContainerStyle의 좌우 16 / 위 10은 그대로 따른다 */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}>
        {/* QuizProgressBar — 라벨 줄(Q1. / 1 / 4)과 진행 트랙 */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <SkeletonBlock width={28} height={16} radius={4} color={SKELETON_COLOR} />
            <SkeletonBlock width={40} height={16} radius={4} color={SKELETON_COLOR} />
          </View>
          <SkeletonBlock width="100%" height={6} radius={10} color={SKELETON_COLOR} />
        </View>

        {/* QuizIllustrationCard 자리 */}
        <View style={{ marginTop: 20 }}>
          <SkeletonBlock width="100%" height={180} radius={20} color={SKELETON_COLOR} />
        </View>

        {/* 문제 문장 자리 */}
        <View style={{ marginTop: 20 }}>
          {Array.from({ length: QUESTION_LINE_COUNT }, (_, index) => (
            <SkeletonBlock
              key={index}
              width={QUESTION_LINE_WIDTHS[index] ?? '92%'}
              height={QUESTION_BAR_HEIGHT}
              radius={6}
              color={SKELETON_COLOR}
              style={{ marginVertical: (QUESTION_LINE_HEIGHT - QUESTION_BAR_HEIGHT) / 2 }}
            />
          ))}
        </View>

        {/* 보기 자리 */}
        <View style={{ marginTop: 20, gap: 10 }}>
          {Array.from({ length: OPTION_COUNT }, (_, index) => (
            <SkeletonBlock key={index} width="100%" height={52} radius={16} color={SKELETON_COLOR} />
          ))}
        </View>
      </View>

      {/* CTA 줄(힌트 / 다음). 배경색·여백은 culture.tsx의 실제 CTA 줄과 같은 값이라
          응답이 와도 버튼 줄이 위아래로 움직이지 않는다 */}
      <View style={{ flexDirection: 'row', gap: 12, backgroundColor: '#fcfcfd', paddingHorizontal: 16, paddingTop: CTA_BOTTOM_GAP, paddingBottom: ctaBottomPadding }}>
        <View style={{ flex: 1 }}>
          <SkeletonBlock width="100%" height={52} radius={999} color={SKELETON_COLOR} />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonBlock width="100%" height={52} radius={999} color={SKELETON_COLOR} />
        </View>
      </View>
    </View>
  );
}
