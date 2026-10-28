import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { NearbyMissionCard, RewardCouponCard } from '@packages/shared';
import { Button } from '@/components/Button/Button';
import { ButtonColor } from '@/components/Button/styles';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { useSinglePress } from '@/hooks/useSinglePress';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { formatCompletedDate } from './formatDate';
import { StoreIcon } from './StoreIcon';
import { MISSION_ALREADY_COMPLETE_CHARACTER_TOP, MISSION_CARD_PHOTO, missionAlreadyCompleteStyles as styles } from './styles';
import { ctaBottomPadding } from '@/styles/safeArea';

function ChevronLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M12 4L7 10L12 16" stroke="#2a2621" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 디자인의 chevron 보드는 20x20이고 그 안의 벡터가 5x10이다(가운데 정렬 → x 7.5~12.5, y 5~15)
function ChevronRightIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M7.5 5L12.5 10L7.5 15" stroke="#45741f" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * 상단 캐릭터.
 *
 * 서버가 준 AR 캐릭터를 쓰고, URL이 없거나 불러오지 못하면 번들 에셋으로 되돌린다
 * (MissionCompleteLayout의 CelebrationImage와 같은 구조). 되돌아가는 경로가 실제로 필요하다 —
 * 시드 데이터의 이미지 호스트가 아직 살아 있지 않아 지금은 서버 URL이 전부 실패하고,
 * 폴백이 없으면 캐릭터 자리가 통째로 비어 버린다.
 *
 * 폴백 에셋을 호출부에서 받는 이유: 이 레이아웃은 미션 종류에 묶이지 않는다(nearbyPhoto와 같은 이유).
 */
function CharacterImage({ uri, fallback, top }: { uri: string | null | undefined; fallback?: ImageSourcePropType; top: number }) {
  const [hasFailed, setHasFailed] = useState(false);

  const source = uri && !hasFailed ? { uri } : fallback;
  if (!source) return null;

  return <Image source={source} style={[styles.characterImage, { top }]} resizeMode="contain" onError={() => setHasFailed(true)} />;
}

/**
 * 근처 미션 카드의 사진.
 *
 * 대표 이미지는 TourAPI 조회 결과라 없을 수 있고(문서: firstimage/firstimage2 둘 다 없으면 null),
 * 있어도 불러오지 못할 수 있다. 둘 다 같은 크기의 스켈레톤으로 자리만 잡는다 — 크기가 다르면
 * 카드가 흔들리고, 빈 칸으로 두면 카드가 고장난 것처럼 보인다.
 *
 * 번들 폴백 사진을 쓰지 않는 이유: 어느 장소든 같은 사진 한 장을 돌려 쓰면 가 보지도 않은 곳의
 * 사진을 그 장소의 사진처럼 보여주게 된다.
 */
function MissionCardPhoto({ url }: { url: string | null }) {
  const [hasFailed, setHasFailed] = useState(false);

  if (url === null || hasFailed) {
    return <SkeletonBlock width={MISSION_CARD_PHOTO.size} height={MISSION_CARD_PHOTO.size} radius={MISSION_CARD_PHOTO.radius} color={MISSION_CARD_PHOTO.skeletonColor} pulse={false} />;
  }

  return <Image source={{ uri: url }} style={styles.missionCardPhoto} resizeMode="cover" onError={() => setHasFailed(true)} />;
}

export interface MissionAlreadyCompleteCta {
  text: string;
  color: ButtonColor;
  type?: 'solid' | 'outline';
  onPress: () => void;
}

interface MissionAlreadyCompleteLayoutProps {
  /** 화면 배경 그라디언트(위 → 아래) */
  backgroundColors: [string, string];
  /** 상단 장식 원의 그라디언트 */
  circleColors: [string, string];
  /** 예: "보물 찾기 완료" */
  title: string;
  /** 완료 시각(ISO). 배지에 "YYYY.MM.DD"로 표시된다 */
  completedAt: string;
  nearbyMissions: NearbyMissionCard[];
  coupons: RewardCouponCard[];
  /** 상단 캐릭터 보상 이미지(서버). null이거나 불러오지 못하면 characterFallback으로 되돌린다 */
  characterImageUrl?: string | null;
  /**
   * 서버 그림이 없거나 실패했을 때 그릴 번들 에셋.
   * 이것마저 없으면 캐릭터 자리를 비우고 타이틀이 가운데로 돌아간다.
   */
  characterFallback?: ImageSourcePropType;
  /**
   * 근처 미션 섹션의 "더보기" 탭. 생략하면 그 줄에 "더보기"를 그리지 않는다.
   *
   * 쿠폰 섹션과 핸들러를 나눈 이유: 두 섹션의 목록 화면이 서로 다르다(근처 미션은 web 지도의
   * 미션 목록 시트, 쿠폰은 아직 갈 곳이 없다). 하나로 묶여 있던 때는 한쪽만 연결해도
   * 양쪽에 "더보기"가 함께 나타나 눌러도 엉뚱한 데로 갔다.
   */
  onNearbyMorePress?: () => void;
  /** 쿠폰(받은 보상) 섹션의 "더보기" 탭. 목록 화면이 아직 없으면 생략한다 */
  onCouponMorePress?: () => void;
  /** 쿠폰의 "사용하러 가기" */
  onCouponPress?: (coupon: RewardCouponCard) => void;
  /** 근처 미션 카드 탭 */
  onNearbyMissionPress?: (mission: NearbyMissionCard) => void;
  /** 하단 CTA 2개. 디자인은 "방명록 남기기"(좌) / "보물이랑 사진찍기"(우) */
  ctas: [MissionAlreadyCompleteCta, MissionAlreadyCompleteCta];
  onBack: () => void;
}

/**
 * 이미 완료한 미션에 다시 들어왔을 때의 화면.
 * Penpot TreasureHunt-detail-complete / prompt §9 "이미 미션을 완료 했는데, 다시 진입한 경우".
 *
 * 미션 종류에 묶이지 않도록 문구·색·목록을 전부 prop으로 받는다 —
 * 보드는 보물찾기 이름이지만 골격은 퀴즈 완료 화면과 같아 두 미션이 함께 쓴다.
 */
export function MissionAlreadyCompleteLayout({
  backgroundColors,
  circleColors,
  title,
  completedAt,
  nearbyMissions,
  coupons,
  characterImageUrl,
  characterFallback,
  onNearbyMorePress,
  onCouponMorePress,
  onCouponPress,
  onNearbyMissionPress,
  ctas,
  onBack,
}: MissionAlreadyCompleteLayoutProps) {
  const insets = useSafeAreaInsets();
  // 직접 그린 Pressable이라 Button과 달리 연타 방지가 없어 따로 감싼다
  const handleBack = useSinglePress(onBack);
  // 타이틀 정렬은 캐릭터가 "그려지는지"로 갈린다. 서버 URL이 실패해도 폴백이 있으면 그려지므로
  // 로드 결과가 아니라 값의 유무로 판단해야 정렬이 뒤늦게 바뀌지 않는다.
  const hasCharacter = Boolean(characterImageUrl) || characterFallback !== undefined;

  return (
    <FullBleed>
      <LinearGradient colors={backgroundColors} style={styles.background} />
      <LinearGradient colors={circleColors} style={styles.circle} />

      {/* 캐릭터는 장식 원 위·흰 시트 아래에 그린다(Penpot z-order: Ellipse 34 < image 64 < Rectangle 83).
          여기 두면 뒤에 오는 시트가 캐릭터 아래쪽을 덮어 디자인과 같은 잘림이 생긴다.
          세로 기준은 상태바 아래라 insets.top을 더한다 — 디자인 y=90 = 상태바 44 + 46 */}
      <CharacterImage uri={characterImageUrl} fallback={characterFallback} top={insets.top + MISSION_ALREADY_COMPLETE_CHARACTER_TOP} />

      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={8} style={styles.backButton} accessibilityLabel="뒤로 가기">
            <ChevronLeftIcon />
          </Pressable>
        </View>
      </View>

      {/* 디자인은 캐릭터가 왼쪽에서 겹쳐 들어오고 타이틀이 오른쪽이다. 캐릭터를 아예 그리지 않는
          미션(서버 URL도 폴백 에셋도 없는 경우)에서는 빈 자리를 남기지 않고 가운데 정렬로 되돌린다 */}
      <View style={[styles.titleBlock, hasCharacter ? styles.titleBlockWithCharacter : null]}>
        <View style={hasCharacter ? styles.titleColumn : undefined}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>{formatCompletedDate(completedAt)}</Text>
            <View style={styles.completedBadgeDivider} />
            <Text style={styles.completedBadgeText}>미션 완료</Text>
          </View>
        </View>
      </View>

      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          <View>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>근처에서 할 수 있는 보물 찾기에요</Text>
              {onNearbyMorePress && (
                <Pressable onPress={onNearbyMorePress} hitSlop={8}>
                  <Text style={styles.blockMore}>더보기</Text>
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
              {nearbyMissions.map((mission) => (
                <Pressable key={mission.missionId} style={styles.missionCard} onPress={() => onNearbyMissionPress?.(mission)} accessibilityRole="button">
                  <MissionCardPhoto url={mission.photoUrl} />
                  <View style={styles.missionCardBody}>
                    <View>
                      <Text numberOfLines={1} style={styles.missionCardTitle}>
                        {mission.title}
                      </Text>
                      <Text style={styles.missionCardDistance}>{mission.distanceLabel}</Text>
                    </View>
                    {/* 디자인에는 난이도 배지(#fdf2bb/#685210)도 있었지만 이 API는 난이도를 반환하지 않아 뺐다.
                        보상 배지 #e2f2d2/#45741f만 남기고, 보상이 없는 미션은 배지 줄 자체를 그리지 않는다 */}
                    {mission.rewardLabel && (
                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: '#e2f2d2' }]}>
                          <Text style={[styles.badgeText, { color: '#45741f' }]}>{mission.rewardLabel}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>받은 보상, 여기서 쓸 수 있어요</Text>
              {onCouponMorePress && (
                <Pressable onPress={onCouponMorePress} hitSlop={8}>
                  <Text style={styles.blockMore}>더보기</Text>
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
              {coupons.map((coupon) => (
                <View key={coupon.couponId} style={styles.couponCard}>
                  {/* 첫째 줄은 아이콘과 고정 분류 문구, 둘째 줄이 실제 가게 이름이다.
                      예전에는 반대였다 — 가게 이름이 위, 고정 문구가 아래 */}
                  <View style={styles.couponCategoryRow}>
                    <StoreIcon />
                    <Text numberOfLines={1} style={styles.couponCategory}>
                      {coupon.categoryLabel}
                    </Text>
                  </View>
                  <View>
                    <Text numberOfLines={1} style={styles.couponStore}>
                      {coupon.storeName}
                    </Text>
                    <Text numberOfLines={1} style={styles.couponBenefit}>
                      {coupon.benefit}
                    </Text>
                  </View>
                  <Pressable style={styles.couponUseButton} onPress={() => onCouponPress?.(coupon)} accessibilityRole="button">
                    <Text style={styles.couponUseButtonText}>사용하러 가기</Text>
                    <ChevronRightIcon />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={[styles.ctaWrapper, { paddingBottom: ctaBottomPadding(insets.bottom) }]}>
          {ctas.map((cta) => (
            <View key={cta.text} style={styles.ctaButton}>
              {/* compact — 버튼 두 개가 폭을 반씩 나눠 가져 라벨이 좁다. "보물이랑 사진찍기"가
                  360dp 화면에서 md 기본 여백(24)으로는 말줄임된다(Button/styles.ts 참고) */}
              <Button type={cta.type ?? 'solid'} color={cta.color} bold compact text={cta.text} onPress={cta.onPress} />
            </View>
          ))}
        </View>
      </View>
    </FullBleed>
  );
}
