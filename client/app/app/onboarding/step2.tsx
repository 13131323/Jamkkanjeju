import { ONBOARDING_TOTAL_STEPS, TRANSPORTATION_OPTIONS, type TransportationId } from '@packages/shared';
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
const ICONS: Record<TransportationId, ImageSourcePropType> = {
  walk: require('@assets/images/walk.png'),
  bus: require('@assets/images/bus.png'),
  rental: require('@assets/images/car.png'),
  bicycle: require('@assets/images/bicycle.png'),
};

export default function OnboardingStep2() {
  const insets = useSafeAreaInsets();
  const selected = useOnboardingStore((state) => state.transportation);
  const select = useOnboardingStore((state) => state.setTransportation);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <OnboardingProgressWrap
          step={2}
          total={ONBOARDING_TOTAL_STEPS}
          title={'주로 어떤 교통수단을\n이용하실 예정인가요?'}
          description="추천 동선과 이동 가능한 콘텐츠를 추천해드릴게요."
          onBack={() => navigate.back()}
        />

        <View style={styles.selectionContent}>
          <SelectionHint max={1} />
          <View style={styles.cardList}>
            {TRANSPORTATION_OPTIONS.map((opt) => (
              <SelectionCard
                key={opt.id}
                icon={ICONS[opt.id]}
                title={opt.title}
                subtitle={opt.subtitle}
                selected={selected === opt.id}
                onPress={() => select(opt.id)}
                layout="horizontal"
                // 디자인 60의 0.9배. step1(0.8배)보다 크게 두는 쪽이 카드 폭에 맞는다(에셋도 54x54)
                iconSize={54}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomPadding(insets.bottom, ONBOARDING_FOOTER_BOTTOM) }]}>
        {/* 하나도 고르지 않으면 다음 단계로 넘어갈 수 없다 */}
        <Button color="cool-neutral" text="다음" disabled={!hasSelection(selected)} onPress={() => navigate.push('/onboarding/step3')} />
        <Button type="ghost" color="cool-neutral" text="나중에 할게요" onPress={() => navigate.push({ pathname: '/onboarding/result', params: { mode: 'skip' } })} />
      </View>
    </View>
  );
}
