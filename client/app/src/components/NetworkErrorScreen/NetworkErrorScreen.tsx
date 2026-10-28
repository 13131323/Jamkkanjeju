import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button/Button';
import { NETWORK_ERROR_MESSAGES, type NetworkErrorVariant } from './messages';

const icon = require('@assets/images/circle-exclamation.png');
const iconSize = 64;

interface NetworkErrorScreenProps {
  onRetry: () => void;
  /** 'server'는 서버까지 닿았지만 오류 응답이 온 경우. 문구만 달라진다 */
  variant?: NetworkErrorVariant;
}

export function NetworkErrorScreen({ onRetry, variant = 'offline' }: NetworkErrorScreenProps) {
  const insets = useSafeAreaInsets();
  const { title, description } = NETWORK_ERROR_MESSAGES[variant];

  return (
    <View className="flex-1 items-center justify-center bg-white px-6" style={{ paddingTop: insets.top }}>
      <Image source={icon} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />
      <Text className="mt-6 font-pretendard-bold text-heading-h3 text-cool-neutral-900">{title}</Text>
      <Text className="mt-2 text-center font-pretendard-regular text-body-md text-cool-neutral-500">{description}</Text>
      <View className="mt-8">
        <Button text="다시 시도" size="sm" onPress={onRetry} />
      </View>
    </View>
  );
}
