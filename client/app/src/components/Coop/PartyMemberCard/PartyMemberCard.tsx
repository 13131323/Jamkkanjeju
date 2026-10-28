import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/Button/Button';
import { StatusBadge, type StatusTone } from '@/components/Coop/StatusBadge/StatusBadge';
import { partyMemberCardStyles as styles } from './styles';

/** Penpot member-card의 Avatar 안 아이콘. 내 카드는 #f2d21e, 남의 카드는 #999999 */
function UserIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M10 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM4 17a6 6 0 0112 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface PartyMemberCardProps {
  name: string;
  isHost: boolean;
  /** 나 자신이면 카드 색이 달라지고 이름 뒤에 "(나)"가 붙는다 */
  isMe: boolean;
  /**
   * 우측 배지. 없으면 배지를 그리지 않는다.
   *
   * 문구와 색을 화면이 정한다 — 같은 "준비 완료"도 보는 사람이 방장인지에 따라 색이 다르다
   * (together.tsx의 memberStatus 참고).
   */
  status?: { label: string; tone: StatusTone };
  /**
   * 방장이 이 참여자를 수락·거절할 수 있을 때만 넘어온다.
   * 넘어오면 배지 대신 "거절 / 수락" 버튼을 그린다 — 둘이 같은 자리를 쓴다.
   */
  onAccept?: () => void;
  onReject?: () => void;
}

/**
 * 협동 미션 참여자 한 줄.
 *
 * 역할 라벨("방장" / "일행")은 서버의 isHost에서 그대로 나온다 —
 * 화면이 순서를 보고 방장을 추측하지 않는다.
 *
 * 카드 색이 본인과 타인을 구분한다(Penpot member-card-0 / member-card-1).
 * 이전에는 모든 카드가 본인 색(#fdf2bb)이어서 내 줄을 찾을 수 없었다.
 */
export function PartyMemberCard({ name, isHost, isMe, status, onAccept, onReject }: PartyMemberCardProps) {
  const showActions = onAccept !== undefined && onReject !== undefined;

  return (
    <View style={[styles.card, isMe ? styles.cardMe : styles.cardOther]}>
      <View style={[styles.avatar, isMe ? styles.avatarMe : styles.avatarOther]}>
        <UserIcon color={isMe ? '#f2d21e' : '#999999'} />
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.name}>
          {isMe ? `${name} (나)` : name}
        </Text>
        <Text style={styles.role}>{isHost ? '방장' : '일행'}</Text>
      </View>

      {showActions ? (
        <View style={styles.actions}>
          {/* 디자인 InlineActions: 거절(투명 + #dddddd 테두리) → 수락(#4e4e4e), 간격 4 */}
          <Button type="outline" size="xs" color="coop-neutral" text="거절" onPress={onReject} />
          <Button size="xs" color="coop-neutral" text="수락" onPress={onAccept} />
        </View>
      ) : (
        status !== undefined && <StatusBadge label={status.label} tone={status.tone} />
      )}
    </View>
  );
}
