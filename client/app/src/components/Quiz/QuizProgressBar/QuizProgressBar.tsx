import { Text, View } from 'react-native';

interface QuizProgressBarProps {
  current: number;
  total: number;
  label: string;
}

export function QuizProgressBar({ current, total, label }: QuizProgressBarProps) {
  const progress = (current / total) * 100;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-pretendard-medium text-label-sm text-primary-800">{label}</Text>
        <Text className="font-pretendard-medium text-label-sm text-cool-neutral-400">
          {current} / {total}
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-[10px] bg-cool-neutral-100">
        <View className="h-full rounded-[10px] bg-primary-600" style={{ width: `${progress}%` }} />
      </View>
    </View>
  );
}
