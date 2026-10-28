import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUTTON_MD_HEIGHT } from '@/components/Button/styles';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { COOP_BACKGROUND_COLORS, COOP_CIRCLE_COLORS, coopStepStyles as styles } from '@/styles/coopStep';
import { ctaBottomPadding } from '@/styles/safeArea';

/**
 * 협동 미션 단계 화면이 **아직 어느 단계인지 모를 때** 그리는 자리표시 화면.
 *
 * ## 어디서 쓰는가
 *
 * 두 곳이다. 둘 다 "방을 여는 응답을 기다리는 중"이고, 응답이 와야 갈 단계가 정해진다.
 *   - `app/mission/together.tsx` — 홈·마이페이지의 "이어서 진행"으로 들어온 경로(`openingRoom`)
 *   - `components/Coop/CoopInviteEntry` — 초대 딥링크 착지
 *
 * 두 자리가 같은 모양이어야 해서 한 컴포넌트로 묶었다. 예전에는 같은 JSX가 양쪽에 복사돼 있었고
 * 가운데에 `ActivityIndicator` 하나만 돌았다.
 *
 * ## 왜 단계 내용을 그리지 않는가 (건드리지 말 것)
 *
 * 어느 단계로 갈지는 이어하기 응답의 `currentStep`이 정한다. 그 전에 단계 배지("일행 초대")나
 * 문구, 참여자 목록을 그리면 **3단계 방을 이어했는데 1단계 화면이 수백 ms 스쳐 지나간다** —
 * 실제로 있었던 결함이라 그때 의도적으로 배지·문구 없는 중립 화면으로 만든 자리다.
 * 스피너를 스켈레톤으로 바꾸면서도 그 의도는 그대로 지킨다:
 *
 *   - 여기 그리는 것은 **세 단계(초대·역할 배정·재료 찾기)가 글자 그대로 공유하는 골격**뿐이다 —
 *     배경 그라디언트, 장식 원, 헤더 높이, 타이틀 존(배지 24 / 제목 30 / 부제 22), 흰 시트, CTA.
 *     어느 단계에 도착하든 같은 자리에 같은 크기로 있는 것들이라 특정 단계를 암시하지 않는다.
 *   - 시트 윗변은 **일자**로 둔다. 초대(step1)만 기울어진 두 판(`InviteSheetBackdrop`)을 쓰는데,
 *     그 모양을 그리면 "1단계로 간다"는 암시가 된다. 직선은 어느 쪽도 주장하지 않는다.
 *   - 뒤로가기도 그리지 않는다(헤더는 높이만 차지하는 빈 줄이다). 아직 어느 단계인지 모르는
 *     대기라 되돌릴 곳도 정해지지 않았고, 이 화면은 응답이 오는 순간 스스로 사라진다.
 *
 * ## 색
 *
 * 타이틀 존은 유색 배경(#fef9e1 → #fdf2bb, 그 위에 장식 원 #fbe884) 위라 기본값인 흰색을 쓴다 —
 * `SkeletonBlock` 주석이 말하는 "색이 깔린 배경 위에서 반투명하게 비치는" 용도 그대로고,
 * 미션 인트로 레이아웃과 같은 처리다. 반대로 CTA는 **흰 시트 위**라 흰색이면 보이지 않는다.
 * 그쪽만 회색 계열(#f6f5f4)로, RoleVerify · together-materials의 자리표시와 같은 값을 쓴다.
 */

/** NavigationHeader의 높이(`h-14`). 헤더를 그리지 않아도 이만큼은 비워 둬야 타이틀 존의 y가 같다 */
const HEADER_HEIGHT = 56;

/** 흰 시트 위 자리표시 색. RoleVerify · together-materials와 같은 값 */
const SHEET_SKELETON_COLOR = '#f6f5f4';

/**
 * 타이틀 존 자리표시 크기. `coopStepStyles`의 실제 요소와 같은 높이여야 도착했을 때 튀지 않는다.
 *   - 배지: stepBadge height 24
 *   - 제목: title fontSize 20 / lineHeight 30, marginTop 10
 *   - 부제: subtitle fontSize 14 / lineHeight 22, marginTop 6
 * 폭은 응답이 와야 알 수 있어 세 단계 문구의 평균쯤 되는 디자인 기준값을 쓴다
 * (MissionIntroLayout이 보상·퀘스트 개수를 다루는 방식과 같다).
 */
const TITLE_ZONE = {
  badge: { width: 84, height: 24, radius: 12 },
  title: { width: 200, height: 30, radius: 10 },
  subtitle: { width: 240, height: 22, radius: 8 },
} as const;

export function CoopStepSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    // 배경 그라디언트와 장식 원이 시스템 바 뒤까지 이어져야 해서 루트 padding을 취소한다(CoopStepLayout과 같다)
    <FullBleed>
      {/* 스켈레톤만 있는 화면이라 스크린리더가 읽을 글자가 하나도 없다. 컨테이너에 한 줄을 붙여
          "아무 말도 하지 않는 화면"이 되지 않게 한다 — 단계를 말하지 않으므로 위 의도와도 어긋나지 않는다 */}
      <View style={styles.screen} accessible accessibilityLabel="방을 여는 중">
        <LinearGradient colors={COOP_BACKGROUND_COLORS} style={styles.background} />
        <LinearGradient colors={COOP_CIRCLE_COLORS} style={styles.circle} />

        <View style={{ paddingTop: insets.top }}>
          <View style={{ height: HEADER_HEIGHT }} />
        </View>

        <View style={styles.titleZone}>
          <SkeletonBlock width={TITLE_ZONE.badge.width} height={TITLE_ZONE.badge.height} radius={TITLE_ZONE.badge.radius} />
          <SkeletonBlock width={TITLE_ZONE.title.width} height={TITLE_ZONE.title.height} radius={TITLE_ZONE.title.radius} style={{ marginTop: 10 }} />
          <SkeletonBlock width={TITLE_ZONE.subtitle.width} height={TITLE_ZONE.subtitle.height} radius={TITLE_ZONE.subtitle.radius} style={{ marginTop: 6 }} />
        </View>

        <View style={[styles.sheet, styles.sheetFlat]}>
          {/* 시트 내용이 들어올 자리. 단계마다 다른 것이 바로 여기라 아무것도 그리지 않고 비워 둔다.
              CoopStepLayout에서는 children이 이 자리를 차지하며 CTA를 바닥으로 밀어낸다 */}
          <View style={{ flex: 1 }} />

          <View style={[styles.ctaWrapper, { paddingBottom: ctaBottomPadding(insets.bottom) }]}>
            <SkeletonBlock width="100%" height={BUTTON_MD_HEIGHT} radius={999} color={SHEET_SKELETON_COLOR} />
          </View>
        </View>
      </View>
    </FullBleed>
  );
}
