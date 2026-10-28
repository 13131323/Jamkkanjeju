import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, ImageSourcePropType, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { useSinglePress } from '@/hooks/useSinglePress';
import { resolveCelebrationRender, resolveCompleteLayout } from './completeLayout';
import { PLACE_THUMB, cardShadow, styles } from './styles';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { ctaBottomPadding } from '@/styles/safeArea';

export interface MissionCompleteResultRow {
  label: string;
  badge: string;
}

export interface MissionCompleteCta {
  text: string;
  onPress: () => void;
  backgroundColor: string;
  textColor: string;
  /** 지정하면 1px 테두리를 그린다(예: 보물찾기 완료의 "방명록 남기기" #dddddd) */
  borderColor?: string;
}

export interface MissionCompleteLayoutProps {
  /** 화면 배경 그라디언트(세로, 위→아래) */
  backgroundColors: [string, string];
  celebrationImage: ImageSourcePropType;
  /**
   * 축하 이미지 **기준** 크기. 생략하면 표준 정사각(CELEBRATION_BASE_SIZE, 문화·보물찾기).
   * 협동은 귤나무(162)와 귤 캐릭터(89)가 겹친 한 장이라 정사각형이 아니다(COOP_CELEBRATION_SIZE).
   *
   * 실제로 그려지는 크기는 여기에 기기 높이 배율이 곱해진 값이다(celebrationScale.ts).
   * 가로·세로에 같은 배율이 걸리므로 정사각형이 아닌 이미지도 비율이 유지된다.
   */
  celebrationSize?: { width: number; height: number };
  /**
   * 축하 이미지 라운딩. 생략하면 그려질 크기의 절반(= 정원). 투명 배경 PNG는 0으로 둔다.
   *
   * 고정값을 두면 배율이 바뀔 때 원형이 깨지므로, 원형을 원하면 생략하는 쪽이 맞다.
   */
  celebrationRadius?: number;
  /**
   * 서버가 지급한 AR 캐릭터 그림 URL. 이 미션의 축하 캐릭터가 곧 받은 캐릭터라 이 값이 우선한다.
   *
   * null이거나 불러오지 못하면 celebrationImage(번들 에셋)로 되돌린다.
   */
  celebrationUri?: string | null;
  title: string;
  /** 디자인이 그라데이션 텍스트인 경우 RN Text가 지원하지 않으므로 시작 색을 넣는다(CultureMission_Complete 참고) */
  titleColor: string;
  subtitle: string;
  subtitleColor: string;
  /**
   * ResultCard 행. 디자인은 3행("포인트"/"로컬 쿠폰"/"AR 캐릭터 도감")이지만 실제 개수는
   * 서버가 이번에 지급한 보상에 따라 달라진다. 비어 있으면 카드를 그리지 않는다.
   */
  resultRows: MissionCompleteResultRow[];
  resultBadgeBackgroundColor: string;
  resultBadgeTextColor: string;
  suggestion: string;
  /** 장소 카드 사진 URL. 없거나 불러오지 못하면 그 자리를 스켈레톤으로 그린다 */
  placePhotoUrl: string | null;
  placeDescription: string;
  /**
   * 장소 카드를 눌렀을 때. 생략하면 카드를 누를 수 없다 —
   * 다음 장소를 서버에서 못 받은 경우(완료 API가 없는 미션)는 열 상세 화면이 없다.
   */
  onPlacePress?: () => void;
  distanceBadgeText: string;
  distanceBadgeBackgroundColor: string;
  distanceBadgeTextColor: string;
  /** ResultCard / placeCard의 틴트 그림자 색. 미션 테마색이라 화면마다 다르다 */
  cardShadowColor: string;
  /** CTA 1개면 전체 폭으로 늘어나고, 2개면 160 고정폭으로 나란히 놓인다(spec Mission_Complete 기준) */
  ctas: MissionCompleteCta[];
}

/**
 * 화면 맨 위 축하 이미지.
 *
 * 서버가 지급한 AR 캐릭터를 그대로 축하 캐릭터로 쓰고, URL이 없거나 불러오지 못하면
 * 번들 에셋으로 되돌린다. 되돌아가는 경로가 실제로 필요한 이유: 시드 데이터의 이미지 호스트가
 * 아직 살아 있지 않아 지금은 서버 URL이 전부 실패한다.
 *
 * 상자 크기·자르기·라운딩은 resolveCelebrationRender가 정한다(completeLayout.ts).
 * 그쪽에 둔 이유: **서버 그림과 번들 에셋이 같은 상자를 써야** 같은 화면이 URL 로딩 결과에 따라
 * 다른 크기로 그려지지 않는다. 예전에는 서버 경로가 미션이 지정한 크기를 무시하고 정사각
 * 기준(150)을 따로 계산해서, 협동 완료 화면이 171x176 ↔ 150x150으로 튀었다.
 */
function CelebrationImage({
  uri,
  fallbackImage,
  celebrationSize,
  celebrationRadius,
  scale,
}: {
  uri: string | null;
  fallbackImage: ImageSourcePropType;
  celebrationSize?: { width: number; height: number };
  celebrationRadius?: number;
  scale: number;
}) {
  const [hasFailed, setHasFailed] = useState(false);

  const isRemote = uri !== null && !hasFailed;
  const { size, resizeMode, borderRadius } = resolveCelebrationRender({ celebrationSize, celebrationRadius, scale, isRemote });

  if (isRemote) {
    return <Image source={{ uri }} style={size} resizeMode={resizeMode} onError={() => setHasFailed(true)} />;
  }

  // radius를 크기의 절반으로 계산해 배율이 바뀌어도 정확히 원형을 유지한다.
  // 고정값(디자인 82 = 164/2)을 두면 축소된 크기에서는 과한 값이 된다.
  return <Image source={fallbackImage} style={[size, { borderRadius }]} resizeMode={resizeMode} />;
}

/**
 * 장소 카드 썸네일.
 *
 * 사진이 없거나 불러오지 못하면 같은 크기의 스켈레톤으로 자리만 잡는다 — 크기가 다르면
 * 카드 레이아웃이 흔들린다. 로드 실패까지 스켈레톤으로 떨어뜨리는 이유: 시드 이미지 호스트가
 * 아직 살아 있지 않아 실패가 잦은데, 그때 빈 칸이 남으면 카드가 고장난 것처럼 보인다.
 *
 * 20% 검정(thumbOverlay)은 **사진 위에 얹는 연출**이라 스켈레톤에는 덮지 않는다. 덮으면
 * 회색이 한 단 더 어두워져 다른 색으로 보인다.
 */
function PlaceThumb({ url }: { url: string | null }) {
  const [hasFailed, setHasFailed] = useState(false);

  if (url === null || hasFailed) {
    return <SkeletonBlock width={PLACE_THUMB.size} height={PLACE_THUMB.size} radius={PLACE_THUMB.radius} color={PLACE_THUMB.skeletonColor} pulse={false} />;
  }

  return (
    <>
      <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" onError={() => setHasFailed(true)} />
      {/* 디자인상 썸네일에 20% 검정이 덮인다 */}
      <View style={styles.thumbOverlay} />
    </>
  );
}

/**
 * CTA 한 개. map 안에서 훅을 부를 수 없어(연타 차단은 버튼마다 독립된 ref가 필요하다)
 * 별도 컴포넌트로 떼어냈다.
 */
function CtaButton({ cta, fixedWidth }: { cta: MissionCompleteCta; fixedWidth: boolean }) {
  const handlePress = useSinglePress(cta.onPress);

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.ctaButton, fixedWidth && styles.ctaButtonFixed, { backgroundColor: cta.backgroundColor }, cta.borderColor ? { borderWidth: 1, borderColor: cta.borderColor } : null]}
    >
      <Text numberOfLines={1} style={[styles.ctaButtonText, { color: cta.textColor }]}>
        {cta.text}
      </Text>
    </Pressable>
  );
}

/**
 * CultureMission_Complete / 보물찾기 Mission_Complete 공통 레이아웃.
 * 두 화면은 구조가 동일하고 값만 달라, 미션별 값은 src/constants/mission.ts의
 * MISSION_COMPLETE_CONFIG에서 받는다.
 *
 * CTA는 Button 컴포넌트를 쓰지 않고 여기서 직접 그린다.
 * Button의 md 사이즈(height52/radius999/paddingHorizontal24)와 텍스트 스타일(16/500)을
 * styles.ts의 ctaButton/ctaButtonText로 복제해, 색만 자유롭게 받을 수 있게 한 구조다.
 */
export function MissionCompleteLayout({
  backgroundColors,
  celebrationImage,
  celebrationSize,
  celebrationRadius,
  celebrationUri = null,
  title,
  titleColor,
  subtitle,
  subtitleColor,
  resultRows,
  resultBadgeBackgroundColor,
  resultBadgeTextColor,
  suggestion,
  placePhotoUrl,
  placeDescription,
  onPlacePress,
  distanceBadgeText,
  distanceBadgeBackgroundColor,
  distanceBadgeTextColor,
  cardShadowColor,
  ctas,
}: MissionCompleteLayoutProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const handlePlacePress = useSinglePress(onPlacePress);
  const shadow = { boxShadow: cardShadow(cardShadowColor) };

  // 이 화면은 세로 여백이 거의 없어 짧은 기기에서 스크롤이 생긴다. 축하 이미지와 suggestion 위
  // 간격을 상하한 안에서 조절해 흡수하는데, 콘텐츠 높이는 기기 높이만으로 정해지지 않는다 —
  // 보상 행이 0~3개로 달라져 그 폭이 두 값이 흡수할 수 있는 범위보다 크다. 그래서 행 수까지
  // 함께 넘긴다. 배분 규칙은 completeLayout.ts 참고
  const { celebrationScale, suggestionGap } = resolveCompleteLayout({
    usableHeight: windowHeight - insets.top - insets.bottom,
    resultRowCount: resultRows.length,
  });

  // 그라디언트 끝색이 네비게이션바 뒤까지 이어져야 해서 루트 padding을 취소한다
  return (
    <FullBleed>
      <LinearGradient colors={backgroundColors} style={{ flex: 1, paddingTop: insets.top }}>
        {/* CTA만 하단에 고정하고 나머지는 전부 스크롤된다 — 헤더와 축하 이미지 포함.
            디자인은 iOS 상태바(44)·홈 인디케이터(31) 기준이라 실제 Android 기기의
            네비게이션바를 더하면 한 화면에 들어가지 않는다.

            축하 이미지의 marginTop -42(헤더 겹침)를 ScrollView 안에서 쓸 수 있는 이유:
            헤더가 같은 콘텐츠 컨테이너 안에 있어 겹침이 컨테이너 내부에서 일어난다.
            헤더를 밖에 두면 이미지가 컨테이너 상단을 넘겨 Android가 42를 잘라낸다. */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}></View>

          <View style={styles.celebrationRow}>
            <CelebrationImage uri={celebrationUri} fallbackImage={celebrationImage} celebrationSize={celebrationSize} celebrationRadius={celebrationRadius} scale={celebrationScale} />
          </View>

          {/* MessageSection: 제목 → 8 → 부제 */}
          <View style={styles.message}>
            <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
          </View>

          {/* 서버가 이번에 지급한 보상만 내려주므로 행이 하나도 없을 수 있다(중단해서 맞힌 게 없는 경우).
              빈 카드를 그리면 얇은 흰 띠만 남아 고장난 것처럼 보여서 통째로 뺀다 */}
          {resultRows.length > 0 && (
            <View style={[styles.resultCard, shadow]}>
              {resultRows.map((row, index) => (
                <View key={row.label} style={[styles.resultRow, index > 0 && styles.resultRowDivider]}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <View style={[styles.rowBadge, { backgroundColor: resultBadgeBackgroundColor }]}>
                    <Text style={[styles.rowBadgeText, { color: resultBadgeTextColor }]}>{row.badge}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 위 간격은 남는 높이에 따라 달라진다(보상 행 수·기기 높이) — completeLayout.ts */}
          <Text style={[styles.suggestion, { marginTop: suggestionGap }]}>{suggestion}</Text>

          {/* 카드를 누르면 그 장소의 상세 화면으로 간다. 다음 장소를 못 받았으면 열 곳이 없어 비활성 */}
          <Pressable
            onPress={handlePlacePress}
            disabled={onPlacePress === undefined}
            accessibilityRole={onPlacePress === undefined ? undefined : 'button'}
            accessibilityLabel={onPlacePress === undefined ? undefined : '다음 여행지 상세 보기'}
            style={[styles.placeCard, shadow]}
          >
            <View style={styles.thumbWrapper}>
              <PlaceThumb url={placePhotoUrl} />
            </View>

            <View style={styles.placeContent}>
              <View style={[styles.distanceBadge, { backgroundColor: distanceBadgeBackgroundColor }]}>
                <Text style={[styles.distanceText, { color: distanceBadgeTextColor }]}>{distanceBadgeText}</Text>
              </View>
              <Text style={styles.placeDescription}>{placeDescription}</Text>
            </View>
          </Pressable>
        </ScrollView>

        <View style={[styles.ctaWrapper, ctas.length > 1 && styles.ctaWrapperRow, { paddingBottom: ctaBottomPadding(insets.bottom) }]}>
          {ctas.map((cta) => (
            <CtaButton key={cta.text} cta={cta} fixedWidth={ctas.length > 1} />
          ))}
        </View>
      </LinearGradient>
    </FullBleed>
  );
}
