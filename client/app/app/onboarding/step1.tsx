import { MAX_TRAVEL_INTEREST_SELECT, ONBOARDING_TOTAL_STEPS, TRAVEL_INTEREST_OPTIONS, type TravelInterestId } from '@packages/shared';
import { ImageSourcePropType, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button/Button';
import { OnboardingProgressWrap } from '@/components/Onboarding/OnboardingProgressWrap/OnboardingProgressWrap';
import { SelectionCard } from '@/components/Onboarding/SelectionCard/SelectionCard';
import { SelectionHint } from '@/components/Onboarding/SelectionHint/SelectionHint';
import { hasSelection } from '@/components/Onboarding/selection';
import { useOnboardingStore } from '@/store/onboarding';
import { ONBOARDING_FOOTER_BOTTOM, onboardingScreenStyles as styles } from '@/styles/onboarding';
import { footerBottomPadding } from '@/styles/safeArea';
import { navigate } from '@/utils/navigate';

// 선택지 id·문구는 @packages/shared(서버로 나가는 값)에 있고, 아이콘만 앱이 id로 매핑한다.
const ICONS: Record<TravelInterestId, ImageSourcePropType> = {
  photo: require('@assets/images/camera.png'),
  local: require('@assets/images/mandarin.png'),
  nature: require('@assets/images/mountain.png'),
  culture: require('@assets/images/mask.png'),
  cafe: require('@assets/images/coffee.png'),
  walk: require('@assets/images/foot.png'),
};

export default function OnboardingStep1() {
  const insets = useSafeAreaInsets();
  const selected = useOnboardingStore((state) => state.travelInterests);
  const toggle = useOnboardingStore((state) => state.toggleTravelInterest);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <OnboardingProgressWrap step={1} total={ONBOARDING_TOTAL_STEPS} title={'제주에서 무엇을 가장\n기대하시나요?'} description="제주에서 즐기고 싶은 여행 스타일을 선택해주세요." />

        <View style={styles.selectionContent}>
          <SelectionHint max={MAX_TRAVEL_INTEREST_SELECT} />
          <View style={styles.cardList}>
            {[0, 2, 4].map((startIdx) => (
              <View key={startIdx} style={styles.cardRow}>
                {TRAVEL_INTEREST_OPTIONS.slice(startIdx, startIdx + 2).map((opt) => (
                  <SelectionCard key={opt.id} icon={ICONS[opt.id]} title={opt.title} subtitle={opt.subtitle} selected={selected.includes(opt.id)} onPress={() => toggle(opt.id)} layout="vertical" />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomPadding(insets.bottom, ONBOARDING_FOOTER_BOTTOM) }]}>
        {/* 하나도 고르지 않으면 다음 단계로 넘어갈 수 없다 */}
        <Button color="cool-neutral" text="다음" disabled={!hasSelection(selected)} onPress={() => navigate.push('/onboarding/step2')} />
        <Button type="ghost" color="cool-neutral" text="나중에 할게요" onPress={() => navigate.push({ pathname: '/onboarding/result', params: { mode: 'skip' } })} />
      </View>
    </View>
  );
}
