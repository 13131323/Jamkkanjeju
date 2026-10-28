import { buildOnboardingSaveRequest, ONBOARDING_RESULT_MODE, type GeneratedApi, type OnboardingResultMode } from '@packages/shared';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button/Button';
import { PointBadge } from '@/components/PointBadge/PointBadge';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { saveUser } from '@/db/session';
import { saveOnboardingInfoApiV1UsersMePatch } from '@/services/api/onboarding/onboarding';
import { updateCachedUser } from '@/services/sessionCache';
import { getOnboardingSelection, useOnboardingStore } from '@/store/onboarding';
import { onboardingResultStyles as styles, RESULT_FOOTER_BOTTOM, RESULT_SKELETON_COLOR } from '@/styles/onboardingResult';
import { footerBottomPadding } from '@/styles/safeArea';
import { navigate } from '@/utils/navigate';

const VARIANTS = {
  // "이대로 추천받기" → IntResultScreen_1
  recommend: {
    badge: '분석 완료',
    title: '당신의 제주 여행\n스타일을 찾았어요!',
    description: '딱 맞는 여행을 함께 만들어드릴게요.',
    // 캐릭터 이미지는 응답의 arCharacter.imageUrl만 쓴다. box는 그 이미지가 들어갈 자리 크기다.
    // offsetTop: 디자인 image 59가 상태바 아래 177에서 시작하고 헤더 블록이 172이므로 5다
    character: { box: { width: 157, height: 212 }, offsetTop: 5 },
    illustrationOffsetTop: 0,
    // 디자인상 26이지만 원격 캐릭터 이미지가 contain 여백을 만들어 더 떨어져 보인다
    contentsGap: 14,
    chip: { label: '제주 여행 가이드', background: '#fff6ed', border: '#ffe5ca', color: '#ff8f18' },
    // 아래 두 값은 응답을 아직 못 받았거나 서버가 userTravelStyle을 못 채워줬을 때 쓰인다
    travelStyleTitlePlaceholder: '여행 스타일을 분석하고 있어요',
    characterDescription: '조금 뒤에 다시 시도하면 딱 맞는 여행 스타일을 찾아드릴게요.',
  },
  // "나중에 할게요" → IntResultScreen_Skip
  skip: {
    badge: '여행 준비 완료',
    title: '돌멍이와 함께\n제주를 발견해볼까요?',
    description: '돌멍이가 제주 여행을 안내해드릴게요.',
    // 디자인 Rectangle 1이 상태바 아래 214에서 시작한다 — 헤더 172 + illustrationOffsetTop 7 + 35
    character: { box: { width: 151, height: 182 }, offsetTop: 15 },
    illustrationOffsetTop: 7,
    // 디자인상 59다. recommend와 같은 이유로 줄인다
    contentsGap: 36,
    chip: { label: '제주 여행 가이드', background: '#f1f9e8', border: '#cbe7b1', color: '#82c34a' },
    travelStyleTitlePlaceholder: '안녕, 나는 돌멍이야!',
    characterDescription: '숨겨진 장소부터 미션까지\n제주의 새로운 모습을 함께 찾아줄거에요.',
  },
} as const;

export default function OnboardingResult() {
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: OnboardingResultMode }>();
  const isRecommend = mode === ONBOARDING_RESULT_MODE.RECOMMEND;
  const variant = VARIANTS[isRecommend ? 'recommend' : 'skip'];
  const resetOnboarding = useOnboardingStore((state) => state.reset);

  // 이 화면에 들어온 시점에 PATCH /api/v1/users/me를 한 번 호출한다.
  // "나중에 할게요"로 들어온 경우 선택값을 보내지 않으므로 바디는 {}가 된다.
  //
  // 성공했을 때만 로컬에 저장한다. 실패하면 저장되지 않으므로
  // 다음 실행에서 온보딩이 다시 뜬다.
  const { mutate, data, isPending } = useMutation({
    // 생성 함수를 그대로 넘기면 두 번째 인자(axios 옵션)가 react-query의
    // mutation context와 겹쳐 타입이 어긋난다. 바디만 넘기도록 감싼다.
    mutationFn: (body: GeneratedApi.OnboardingSaveRequest) => saveOnboardingInfoApiV1UsersMePatch(body),
    onSuccess: (response) => {
      updateCachedUser(response.user);
      void saveUser(response.user);
    },
  });
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    mutate(buildOnboardingSaveRequest(isRecommend ? getOnboardingSelection() : null));
  }, [isRecommend, mutate]);

  // 응답 전에는 서버가 준 값이 없다. variant의 정적 문구로 그린다.
  const user = data?.user ?? null;
  const travelStyle = user?.userTravelStyle ?? null;

  // 칩에는 캐릭터 이름, 그 아래 제목에는 여행 스타일 유형명이 들어간다.
  const characterName = user ? user.arCharacter.name : variant.chip.label;

  // 빈 문자열도 "없음"으로 본다 — mock이 imageUrl을 ''로 주면 Image가 깨진 자리만 남는다.
  const characterImageUri = user?.arCharacter.imageUrl || null;

  let travelStyleTitle: string;
  if (travelStyle) {
    travelStyleTitle = travelStyle.userType;
  } else if (user) {
    // "나중에 할게요" 응답 — 유형이 없으므로 캐릭터 인사말이 제목 자리를 채운다
    travelStyleTitle = `안녕, 나는 ${user.arCharacter.name}야!`;
  } else {
    travelStyleTitle = variant.travelStyleTitlePlaceholder;
  }

  const characterDescription = travelStyle ? travelStyle.typeDescription : variant.characterDescription;

  /**
   * 저장 요청이 **오가는 중**인지. 그 동안 제목·설명 자리는 자리표시로 그린다.
   *
   * `!user`가 아니라 "요청이 진행 중인지"로 가르는 것이 중요하다 — 요청이 끝났는데도 서버가
   * `userTravelStyle`을 못 채워 준 갈래에서는 값이 **영영** 오지 않아서, `!user` 기준이면
   * 자리표시가 영원히 반짝인다(mission/intro.tsx가 완료 조회에서 겪은 그대로). 요청이 끝나면
   * 위에서 고른 정적 문구("조금 뒤에 다시 시도하면…")가 그대로 그려진다.
   *
   * `isRecommend`를 함께 보는 이유: "나중에 할게요"(skip)의 기본 문구는 로딩 안내가 아니라
   * 그대로 보여줄 인사말("안녕, 나는 돌멍이야!")이다. 그 자리를 자리표시로 덮으면 멀쩡한 문구를
   * 숨기는 셈이 된다 — 분석을 기다리는 recommend에서만 바꾼다.
   */
  const isAnalyzing = isRecommend && isPending;
  // 서버가 '#'를 포함해서 내려준다. 여기서 다시 붙이면 '##로컬 탐방'이 된다.
  const keywords = travelStyle ? travelStyle.hashtags : [];

  // 배경 blob을 걷어냈으므로 일러스트 영역 높이는 캐릭터가 차지하는 만큼만 잡는다.
  const illustrationHeight = variant.character.box.height + variant.character.offsetTop;

  const handleStart = () => {
    // 온보딩은 여기서 끝난다. 선택값을 남겨두면 다시 진입했을 때 이전 선택이 그대로 전송된다.
    resetOnboarding();
    navigate.dismissTo('/home');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* 캐릭터·설명·키워드 높이의 합이 기기 화면을 넘길 수 있다(작은 화면 + 두꺼운 네비게이션바).
          그때 spacer가 0으로 눌려 footer가 화면 밖으로 밀려나므로, 넘칠 때만 스크롤되게 감싼다. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.badge}>{variant.badge}</Text>
          <Text style={styles.title}>{variant.title}</Text>
          <Text style={styles.description}>{variant.description}</Text>
        </View>

        {/* URL이 오기 전까지는 자리만 비워 둔다. 응답이 와도 이미지가 늦게 그려질 뿐 레이아웃은 그대로다. */}
        <View style={[styles.illustration, { height: illustrationHeight, marginTop: variant.illustrationOffsetTop }]}>
          {characterImageUri && <Image source={{ uri: characterImageUri }} style={[variant.character.box, { marginTop: variant.character.offsetTop }]} resizeMode="contain" />}
        </View>

        <View style={[styles.contents, { marginTop: variant.contentsGap }]}>
          <PointBadge size="chip" text={characterName} backgroundColor={variant.chip.background} borderColor={variant.chip.border} textColor={variant.chip.color} />
          {isAnalyzing ? (
            // "여행 스타일을 분석하고 있어요" 한 줄을 자리표시로 대신한다(앱의 로딩 표현을 스켈레톤으로 통일).
            // 높이를 실제 글줄과 같게 맞춘다: 제목 20/30(marginTop 12), 설명 12/18 두 줄(marginTop 8) —
            // 막대 12 위아래에 3씩 둬서 한 줄을 18로 만든다. 키워드 칩 자리는 그리지 않는다:
            // 서버가 유형을 못 채워 준 갈래에서는 칩이 아예 없으므로, 미리 그려 두면 그때 통째로 사라진다.
            <View style={styles.analyzingSkeleton} accessible accessibilityLabel="여행 스타일을 분석하는 중">
              <SkeletonBlock width={200} height={30} radius={10} color={RESULT_SKELETON_COLOR} style={styles.analyzingTitleSkeleton} />
              <View style={styles.analyzingDescriptionSkeleton}>
                <SkeletonBlock width={180} height={12} radius={6} color={RESULT_SKELETON_COLOR} style={styles.analyzingDescriptionLine} />
                <SkeletonBlock width={140} height={12} radius={6} color={RESULT_SKELETON_COLOR} style={styles.analyzingDescriptionLine} />
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.characterName}>{travelStyleTitle}</Text>
              <Text style={styles.characterDescription}>{characterDescription}</Text>
            </>
          )}

          {keywords.length > 0 && (
            <View style={styles.keywords}>
              {keywords.map((keyword) => (
                <View key={keyword} style={styles.keywordChip}>
                  <Text numberOfLines={1} style={styles.keywordChipText}>
                    {keyword}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomPadding(insets.bottom, RESULT_FOOTER_BOTTOM) }]}>
        <Button color="cool-neutral" text="시작하기" onPress={handleStart} />
      </View>
    </View>
  );
}
