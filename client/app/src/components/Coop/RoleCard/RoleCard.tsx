import type { ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StatusBadge, type StatusTone } from '@/components/Coop/StatusBadge/StatusBadge';
import { roleImage } from '@/constants/coopMission';
import { useSinglePress } from '@/hooks/useSinglePress';
import { roleCardStyles as styles } from './styles';

/**
 * 아코디언 화살표. Penpot의 shape 이름은 chevron-left지만 보드가 90° 돌려 놓았고,
 * 요구사항도 "아래 화살표 아이콘"이다 — 접힌 상태에서 아래, 펼친 상태에서 위를 가리킨다.
 */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d={open ? 'M6 12L10 8L14 12' : 'M6 8L10 12L14 8'} stroke="#2a2621" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface RoleCardProps {
  roleName: string;
  /** 담당자 표기. 나는 "나", 팀원은 이름. 아직 아무도 맡지 않았으면 생략한다 */
  ownerLabel?: string;
  /** 내 역할이면 카드 색과 아바타 테두리가 달라진다(Penpot RoleCard 두 변형) */
  mine?: boolean;
  /** 선택한 카드의 외곽선을 협동 미션 강조색으로 표시한다 */
  selected?: boolean;
  /** 역할 이미지의 원형 테두리를 표시한다. step2에서는 끈다 */
  showAvatarRing?: boolean;
  /** 카드 외곽선을 표시한다. step3 팀원 카드는 끈다 */
  showCardBorder?: boolean;
  status?: { label: string; tone: StatusTone };
  /**
   * 카드 전체 탭. step2의 역할 선택에 쓴다.
   * 생략하고 onToggle만 주면 **카드 전체가 아코디언을 여닫는다**(step3의 "항목을 누르면 바로 아코디언").
   */
  onPress?: () => void;
  /** 화살표 탭(아코디언). 없으면 화살표를 그리지 않는다 */
  onToggle?: () => void;
  expanded?: boolean;
  /** 펼쳐진 내용(설명·칩·인증 영역) */
  children?: ReactNode;
}

/**
 * 협동 미션 역할 카드.
 *
 * Penpot `탐라로그 V2 / RoleCard` 컴포넌트의 세 변형을 하나로 합쳤다 —
 * 접힌 내 카드 / 접힌 팀원 카드 / 펼쳐진 카드(설명 또는 인증 영역).
 * 세 변형의 차이는 배경·테두리와 펼침 여부뿐이어서 prop으로 가른다.
 */
export function RoleCard({ roleName, ownerLabel, mine = false, selected = false, showAvatarRing = true, showCardBorder = true, status, onPress, onToggle, expanded = false, children }: RoleCardProps) {
  const handleToggle = useSinglePress(onToggle);
  // 카드 전체 탭의 동작. 선택 동작이 없으면 아코디언 여닫기가 그 자리를 대신한다.
  // 화살표는 자기 Pressable을 갖고 있어 더 깊은 responder가 되므로 두 번 호출되지 않는다.
  const handleCardPress = useSinglePress(onPress ?? onToggle);

  // 구분선과 아코디언 패널은 "실제로 내용이 펼쳐졌을 때"만 그린다.
  // 펼침 상태여도 children이 없으면 헤더 아래에 선만 남아 카드가 잘린 것처럼 보인다.
  const showContents = expanded && children !== undefined;

  const header = (
    <View style={[styles.headerRow, showContents && styles.headerRowDivided]}>
      <Image source={roleImage(roleName)} style={[styles.avatar, mine ? styles.avatarMine : styles.avatarOther, !showAvatarRing && styles.avatarPlain]} />

      <View style={styles.titleRow}>
        <Text numberOfLines={1} style={styles.roleName}>
          {roleName}
        </Text>
        {ownerLabel !== undefined && (
          <Text numberOfLines={1} style={styles.owner}>
            {ownerLabel}
          </Text>
        )}
        {/* Penpot은 헤더 오른쪽 끝이었는데 사용자 지시로 담당자("나" 또는 팀원 이름) 옆으로 옮겼다 */}
        {status !== undefined && (
          <View style={styles.statusSlot}>
            <StatusBadge label={status.label} tone={status.tone} />
          </View>
        )}
      </View>

      {onToggle !== undefined && (
        // 카드 전체 탭과 화살표 탭이 겹치므로 화살표를 따로 눌러야 아코디언만 열린다
        <Pressable onPress={handleToggle} hitSlop={8} style={styles.toggle} accessibilityLabel={expanded ? '역할 설명 접기' : '역할 설명 보기'}>
          <ChevronIcon open={expanded} />
        </Pressable>
      )}
    </View>
  );

  const body = (
    <View style={[styles.card, mine ? styles.cardMine : styles.cardOther, !showCardBorder && styles.cardBorderless, selected && styles.cardSelected]}>
      {header}
      {showContents && <View style={styles.contents}>{children}</View>}
    </View>
  );

  if (onPress === undefined && onToggle === undefined) return body;

  return <Pressable onPress={handleCardPress}>{body}</Pressable>;
}
