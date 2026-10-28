import { ONBOARDING_TOTAL_STEPS, SPARE_TIME_STYLE_OPTIONS, type SpareTimeStyleId } from '@packages/shared';
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
const ICONS: Record<SpareTimeStyleId, ImageSourcePropType> = {
  here: require('@assets/images/bus-stop.png'),
  wander: require('@assets/images/walking-path.png'),
  destination: require('@assets/images/coastal-destination.png'),
};

export default function OnboardingStep3() {
  const insets = useSafeAreaInsets();
  const selected = useOnboardingStore((state) => state.spareTimeStyle);
  const select = useOnboardingStore((state) => state.setSpareTimeStyle);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <OnboardingProgressWrap
          step={3}
          total={ONBOARDING_TOTAL_STEPS}
          title={'자투리 시간이 생긴다면\n어떻게 보낼까요?'}
          description="현재 위치와 남은 시간에 맞는 제주를 찾아드릴게요."
          onBack={() => navigate.back()}
        />

        <View style={styles.selectionContent}>
          <SelectionHint max={1} />
          <View style={styles.cardList}>
            {SPARE_TIME_STYLE_OPTIONS.map((opt) => (
              <SelectionCard key={opt.id} icon={ICONS[opt.id]} title={opt.title} subtitle={opt.subtitle} selected={selected === opt.id} onPress={() => select(opt.id)} layout="horizontal-reverse" />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomPadding(insets.bottom, ONBOARDING_FOOTER_BOTTOM) }]}>
        {/* 하나도 고르지 않으면 추천을 받을 수 없다 */}
        <Button color="cool-neutral" text="이대로 추천받기" disabled={!hasSelection(selected)} onPress={() => navigate.push({ pathname: '/onboarding/result', params: { mode: 'recommend' } })} />
        <Button type="ghost" color="cool-neutral" text="나중에 할게요" onPress={() => navigate.push({ pathname: '/onboarding/result', params: { mode: 'skip' } })} />
      </View>
    </View>
  );
}
