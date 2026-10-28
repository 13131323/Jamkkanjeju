import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, ImageSourcePropType, ImageStyle, Pressable, ScrollView, StyleProp, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/Button/Button';
import { ButtonColor } from '@/components/Button/styles';
import { useSinglePress } from '@/hooks/useSinglePress';
import { navigate } from '@/utils/navigate';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { missionIntroStyles as styles } from './styles';
import { ctaBottomPadding } from '@/styles/safeArea';

function ChevronLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M12 4L7 10L12 16" stroke="#2a2621" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * decoPlacement를 쓸 때 타이틀 두 조각 사이를 벌리는 공백.
 * Penpot 원문이 "함께 키우는      귤나무"(공백 6칸)이고, 이 공백 위에 장식이 얹힌다.
 */
const DECO_GAP = ' '.repeat(6);

/**
 * 남은 보상이 하나도 없을 때(= 이 미션의 보상을 이미 다 받았을 때) 보상 줄에 들어가는 문구.
 *
 * 서버 remainingReward는 지급된 항목을 null로 주므로(openapi RemainingRewardResponse)
 * 다 받은 미션에 다시 들어오면 rewards가 빈 배열이 된다. 그때 "미션 보상 ?" 배지만 남고
 * 아래가 텅 비면 로딩이 멈춘 것처럼 보여서, 이유를 알려주는 한 줄로 대신 채운다.
 */
const REWARD_EMPTY_TEXT = '받을 수 있는 보상을 모두 받았어요';

export interface MissionReward {
  image: ImageSourcePropType;
  /**
   * image 로드가 실패했을 때 대신 그릴 번들 그림.
   *
   * AR 캐릭터만 원격 URL이고(서버가 종류별로 내려준다) 나머지 보상은 번들 에셋이라
   * 이 값은 캐릭터 배지에만 채워진다(constants/missionHome.ts).
   */
  fallbackImage?: ImageSourcePropType;
  label: string;
}

interface RewardImageProps {
  source: ImageSourcePropType;
  fallbackImage?: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
}

/**
 * 보상 원 안의 그림. 원격 URL이 실패하면 번들 그림으로 갈아끼운다.
 *
 * 현재 서버가 주는 AR 캐릭터 호스트(cdn.jamkkan-jeju.dev)는 DNS가 없어(NXDOMAIN) 항상 실패하고,
 * 그러면 흰 원과 라벨만 남아 보상이 2개뿐인 것처럼 보인다. CDN이 살아나면 실제 캐릭터가
 * 그대로 나와야 하므로 source는 서버 URL로 두고 실패한 뒤에만 교체한다.
 *
 * RN의 defaultSource를 쓰지 않은 이유는 두 가지다.
 * 1) defaultSource는 "받는 동안" 보여주는 자리표시라 실패 상태에는 관여하지 않는다 —
 *    지금 문제는 로드 실패라 애초에 대상이 아니다.
 * 2) Android는 defaultSource를 드로어블 리소스 이름으로 찾는다
 *    (ReactImageView.setDefaultSource → ResourceDrawableIdHelper). Metro가 번들 에셋을
 *    http URI로 넘기는 개발 빌드에서는 찾지 못해 아무것도 그려지지 않는다.
 */
function RewardImage({ source, fallbackImage, style }: RewardImageProps) {
  const [failed, setFailed] = useState(false);

  // 폴백이 없으면 교체할 게 없으니 onError도 달지 않는다(불필요한 리렌더 방지)
  if (fallbackImage === undefined) return <Image source={source} style={style} />;

  return <Image source={failed ? fallbackImage : source} style={style} onError={() => setFailed(true)} />;
}

export interface MissionStep {
  number: number;
  title: string;
  description: string;
}

interface MissionIntroLayoutProps {
  /** 화면 배경 그라데이션 (위 → 아래) */
  backgroundColors: [string, string, string];
  /** 상단 장식 원의 그라데이션 */
  circleColors: [string, string];
  /** 타이틀 앞부분 / 뒷부분. 사이에 장식 이미지가 들어간다 */
  titleLeading: string;
  titleTrailing: string;
  titleColor: string;
  decoImage: ImageSourcePropType;
  /** 장식 이미지 크기. 디자인상 미션마다 다르다(보물찾기 75x75). 생략하면 기존 40x40 */
  decoSize?: { width: number; height: number };
  /**
   * 장식을 타이틀 행 안의 인라인 요소가 아니라 타이틀 위에 겹쳐 놓을 때의 배치.
   *
   * 협동 미션 디자인은 장식(Tangerine 78x78)이 보드에 절대배치돼 타이틀보다 크고 회전까지 돼 있다.
   * 인라인으로 두면 행 높이가 장식 크기로 늘어나고 타이틀이 다음 줄로 감기므로, 이 값이 있으면
   * 타이틀을 공백으로 벌린 한 줄 텍스트로 그리고 그 공백 위에 장식을 얹는다(디자인과 같은 구조).
   *
   * left/top은 타이틀 블록의 콘텐츠 영역(좌우 패딩 안쪽) 기준이고, top이 음수면 위로 튀어나온다.
   */
  decoPlacement?: { left: number; top: number; rotation: number };
  /**
   * 인라인 장식과 양쪽 타이틀 사이 간격. 생략하면 6.
   *
   * 장식이 클수록(보물찾기 75) 좌우가 벌어져 보여서 미션마다 조절할 수 있게 뺐다.
   */
  titleGap?: number;
  subtitle: string;
  subtitleColor: string;
  rewardBadgeColor: string;
  rewardBadgeTextColor: string;
  rewardLabelColor: string;
  /** 보상 원 바깥 2px 링의 그라디언트 (위 → 아래) */
  rewardRingOuterColors: [string, string];
  /** 보상 원 안쪽 4px 링의 그라디언트 (위 → 아래) */
  rewardRingInnerColors: [string, string];
  /** 보상 캐릭터 뒤에 깔리는 원의 색 */
  rewardImageBackground?: string;
  rewards: MissionReward[];
  steps: MissionStep[];
  ctaText: string;
  ctaColor: ButtonColor;
  onCtaPress: () => void;
  /**
   * 뒤로가기 동작. 생략하면 navigate.back().
   * 탭 루트로 진입하는 화면(보물찾기 intro)은 돌아갈 스택이 없어 back()이 아무 일도 하지 않으므로
   * 갈 곳을 직접 지정해야 한다.
   */
  onBack?: () => void;
  /**
   * 미션 홈 응답을 기다리는 중.
   *
   * 제목·부제·보상·단계 자리를 스켈레톤으로 채운다. 색과 장식은 디자인 값이라
   * 로딩 중에도 그대로 그린다 — 미션 종류는 라우트 파라미터로 이미 알고 있다.
   */
  loading?: boolean;
}

/** 로딩 중 보여줄 자리표시 개수. 실제 개수는 응답이 와야 알 수 있어 디자인 기준값을 쓴다 */
const SKELETON_REWARD_COUNT = 3;
const SKELETON_STEP_COUNT = 4;

export function MissionIntroLayout({
  backgroundColors,
  circleColors,
  titleLeading,
  titleTrailing,
  titleColor,
  decoImage,
  decoSize,
  decoPlacement,
  titleGap = 6,
  subtitle,
  subtitleColor,
  rewardBadgeColor,
  rewardBadgeTextColor,
  rewardLabelColor,
  rewardRingOuterColors,
  rewardRingInnerColors,
  rewardImageBackground = '#ffffff',
  rewards,
  steps,
  ctaText,
  ctaColor,
  onCtaPress,
  onBack,
  loading = false,
}: MissionIntroLayoutProps) {
  const insets = useSafeAreaInsets();
  // CTA는 Button이 자체적으로 연타를 막지만, 이 뒤로가기는 직접 그린 Pressable이라 따로 감싼다
  const handleBack = useSinglePress(onBack ?? (() => navigate.back()));

  // 유색 그라디언트와 장식 원이 상태바 뒤까지 이어져야 해서 루트 padding을 취소한다
  return (
    <FullBleed>
      {/* 디자인의 stop 위치가 0 / 1 / 1 이다. 세 번째는 폭 0이라 실제로는 2색 그라디언트로 보인다.
          locations를 빼면 두 번째 색이 50% 지점에 와서 디자인보다 훨씬 밝아진다 */}
      <LinearGradient colors={backgroundColors} locations={[0, 1, 1]} style={styles.background} />
      {/* 헤더 뒤에 깔리는 장식 원 */}
      <LinearGradient colors={circleColors} style={styles.circle} />

      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={8} style={styles.backButton} accessibilityLabel="뒤로 가기">
            <ChevronLeftIcon />
          </Pressable>
        </View>
      </View>

      {/* 디자인이 한 화면에 들어가는 구성이라 스크롤 없이 배치한다 */}
      <View style={styles.body}>
        {/* 타이틀 / 장식 / 타이틀을 한 행에 가운데 정렬, 그 아래 부제 */}
        <View style={styles.titleBlock}>
          {loading ? (
            // 로딩 중에는 장식만 두고 글자 자리를 막대로 채운다. decoPlacement의 좌표는
            // 실제 문구 폭에 맞춰 계산된 값이라 스켈레톤에는 적용하지 않는다.
            <View style={styles.titleRow}>
              <SkeletonBlock width={200} height={40} radius={10} />
            </View>
          ) : decoPlacement === undefined ? (
            <View style={[styles.titleRow, { columnGap: titleGap }]}>
              <Text style={[styles.title, { color: titleColor }]}>{titleLeading}</Text>
              <Image source={decoImage} style={[styles.deco, decoSize]} resizeMode="contain" />
              <Text style={[styles.title, { color: titleColor }]}>{titleTrailing}</Text>
            </View>
          ) : (
            <View style={[styles.titleRow, styles.titleRowStretch]}>
              {/* 디자인과 같은 구조 — 타이틀은 공백 6칸으로 벌린 한 줄 텍스트고, 그 공백 위에 장식이 겹친다.
                  두 조각을 flex gap으로 벌리면 폭 계산이 어긋나 "귤나무"가 다음 줄로 감긴다 */}
              <Text style={[styles.title, styles.titleCentered, { color: titleColor }]}>{`${titleLeading}${DECO_GAP}${titleTrailing}`}</Text>
              <Image
                source={decoImage}
                style={[
                  styles.decoAbsolute,
                  styles.deco,
                  decoSize,
                  {
                    left: decoPlacement.left,
                    top: decoPlacement.top,
                    transform: [{ rotate: `${decoPlacement.rotation}deg` }],
                  },
                ]}
                resizeMode="contain"
              />
            </View>
          )}
          {loading ? <SkeletonBlock width={240} height={22} style={styles.subtitleSkeleton} /> : <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>}
        </View>

        <View style={styles.rewardBlock}>
          <View style={[styles.rewardBadge, { backgroundColor: rewardBadgeColor }]}>
            <Text style={[styles.rewardBadgeText, { color: rewardBadgeTextColor }]}>미션 보상</Text>
            <View style={[styles.rewardBadgeMark, { borderColor: rewardLabelColor }]}>
              <Text style={[styles.rewardBadgeMarkText, { color: rewardLabelColor }]}>?</Text>
            </View>
          </View>

          <View style={styles.rewardRow}>
            {loading ? (
              Array.from({ length: SKELETON_REWARD_COUNT }, (_, index) => (
                <View key={index} style={styles.rewardItem}>
                  <SkeletonBlock width={64} height={64} />
                  <SkeletonBlock width={48} height={16} style={styles.rewardLabelSkeleton} />
                </View>
              ))
            ) : rewards.length === 0 ? (
              // 배지와 rewardRow(그리고 그 marginTop)는 그대로 두고 원 자리만 문구로 바꾼다 —
              // 블록을 통째로 숨기면 시트가 그만큼 위로 올라와 화면 구성이 달라지고,
              // 무엇보다 "왜 사라졌는지"를 알려줄 자리가 없어진다. 시트가 flex: 1이라
              // 줄어든 높이는 시트가 흡수하고 스크롤이나 CTA 위치는 영향받지 않는다.
              <Text style={[styles.rewardEmptyText, { color: rewardLabelColor }]}>{REWARD_EMPTY_TEXT}</Text>
            ) : (
              rewards.map((reward) => (
                <View key={reward.label} style={styles.rewardItem}>
                  {/* 디자인은 그라디언트 stroke 2겹. RN에 그라디언트 테두리가 없어 원을 겹쳐 링을 만든다 */}
                  <LinearGradient colors={rewardRingOuterColors} style={styles.rewardRingOuter}>
                    <LinearGradient colors={rewardRingInnerColors} style={styles.rewardRingInner}>
                      <RewardImage source={reward.image} fallbackImage={reward.fallbackImage} style={[styles.rewardImage, { backgroundColor: rewardImageBackground }]} />
                    </LinearGradient>
                  </LinearGradient>
                  {/* 서버가 주는 AR 캐릭터 이름은 길다("자청비 모티브 탐험가").
                      한 줄로 묶으면 통째로 "…"가 되므로 두 줄까지 흘려보낸다 */}
                  <Text numberOfLines={2} style={[styles.rewardLabel, { color: rewardLabelColor }]}>
                    {reward.label}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>퀘스트 순서</Text>
          {/* 페이지는 고정이고 퀘스트 목록 안에서만 스크롤한다 */}
          <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepList} showsVerticalScrollIndicator={false}>
            {loading
              ? Array.from({ length: SKELETON_STEP_COUNT }, (_, index) => (
                  <View key={index} style={styles.stepCard}>
                    {/* 단계 번호는 응답과 무관하게 1부터라 그대로 보여준다 */}
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <SkeletonBlock width="55%" height={16} style={styles.stepSkeletonLine} />
                      <SkeletonBlock width="85%" height={16} style={styles.stepSkeletonLine} />
                    </View>
                  </View>
                ))
              : steps.map((step) => (
                  <View key={step.number} style={styles.stepCard}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{step.number}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDescription}>{step.description}</Text>
                    </View>
                  </View>
                ))}
          </ScrollView>
        </View>
      </View>

      {/* 디자인 CTA 영역 699~800: 위 16 + 버튼 52 + 아래 33(홈 인디케이터 영역).
          absolute로 띄우면 흰 시트 끝과 버튼 사이에 빈 배경이 남아서 흐름에 그대로 둔다 */}
      <View style={[styles.ctaWrapper, { paddingBottom: ctaBottomPadding(insets.bottom) }]}>
        <Button color={ctaColor} bold text={ctaText} onPress={onCtaPress} />
      </View>
    </FullBleed>
  );
}
