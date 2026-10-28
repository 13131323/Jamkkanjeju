import { StyleSheet, Text, View } from 'react-native';

export type StatusTone = 'done' | 'waiting';

/**
 * 협동 미션의 상태 알약.
 *
 * step1 member-card의 "준비 완료", step3 RoleCard의 "인증 대기" / "인증 완료"가 같은 도형이고
 * 색만 다르다 — Penpot StatusBadge (높이 24 / radius 100 / 좌우 10 / 상하 4 / 라벨 12·500).
 */
const TONE_STYLE: Record<StatusTone, { background: string; label: string }> = {
  done: { background: '#ff8f18', label: '#ffffff' },
  waiting: { background: '#EDEDED', label: '#7C6E5E' },
};

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const { background, label: labelColor } = TONE_STYLE[tone];

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text numberOfLines={1} style={[styles.label, { color: labelColor }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 24,
    borderRadius: 100,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
});
