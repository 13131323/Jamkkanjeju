import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSinglePress } from '@/hooks/useSinglePress';

/**
 * 뒤로가기 버튼 모양.
 * - `plain`: 아이콘만. 흰 배경 화면(문화 미션, 미션 intro 등)
 * - `circle`: 32x32 #f6f5f4 원 안에 20x20 아이콘. 카메라 프리뷰 위처럼 배경이 어두워
 *   아이콘만으로는 안 보이는 화면에서 쓴다 —
 *   Penpot TreasureHunt_step2/step3의 "Back > back-button"
 */
export type NavigationHeaderBackVariant = 'plain' | 'circle';

interface NavigationHeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  backVariant?: NavigationHeaderBackVariant;
}

function ChevronLeftIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#2a2621"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function NavigationHeader({ title, onBack, rightElement, backVariant = 'plain' }: NavigationHeaderProps) {
  // 뒤로가기도 연타하면 스택이 두 장 pop된다(예상보다 한 화면 더 뒤로 나간다)
  const handleBack = useSinglePress(onBack);

  return (
    <View className="h-14 flex-row items-center justify-between px-4">
      <Pressable
        onPress={handleBack}
        hitSlop={8}
        className="flex-row items-center gap-2"
        accessibilityLabel="뒤로 가기"
      >
        {backVariant === 'circle' ? (
          <View className="h-8 w-8 items-center justify-center rounded-2xl bg-[#f6f5f4]">
            <ChevronLeftIcon size={20} />
          </View>
        ) : (
          <ChevronLeftIcon />
        )}
        {title.length > 0 && (
          <Text className="text-body-lg font-pretendard-medium text-warm-neutral-900">
            {title}
          </Text>
        )}
      </Pressable>
      {rightElement}
    </View>
  );
}
