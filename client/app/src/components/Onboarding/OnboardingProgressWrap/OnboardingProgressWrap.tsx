import { Pressable, Text, View } from 'react-native';
import { onboardingProgressStyles as styles } from './styles';

interface OnboardingProgressWrapProps {
  step: number;
  total: number;
  title: string;
  description: string;
  onBack?: () => void;
}

export function OnboardingProgressWrap({ step, total, title, description, onBack }: OnboardingProgressWrapProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <Pressable accessibilityLabel="이전 단계로 돌아가기" hitSlop={8} onPress={onBack} style={styles.backButton}>
            <View style={styles.backIcon} />
          </Pressable>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            <Text style={styles.badgeCurrent}>{step}</Text>
            <Text style={styles.badgeTotal}> / {total}</Text>
          </Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}
