import { StyleSheet, Text, View } from 'react-native';

/**
 * 역할 설명 + "이런 장소를 찾아보세요" 칩.
 *
 * Penpot RoleCard의 두 자리에 같은 내용이 서로 다른 크기로 들어간다 —
 * 아코디언(팀원 카드를 펼친 상태)은 설명 박스가 #fdf2bb·14/400이고,
 * 내 역할 카드 안(step3)은 카드 배경과 같은 #fef9e1·12/400이다.
 *
 * 설명 박스의 fill은 두 변형 모두 지웠다 — 사용자 지시로 아코디언 영역 전체가 한 색
 * (내 역할 #FEF9E1 / 팀원 #FFFFFF, RoleCard의 contents)이 되면서 그 위에 또 박스를 깔면
 * 색이 겹쳐 보인다. 여백은 패널의 패딩이 대신한다.
 */
export type RoleDetailVariant = 'accordion' | 'inline';

interface RoleDetailProps {
  description: string;
  /** utils/coopRole.ts roleChips()로 쪼갠 장소 목록. 비어 있으면 칩 섹션을 그리지 않는다 */
  chips: string[];
  variant?: RoleDetailVariant;
}

export function RoleDetail({ description, chips, variant = 'accordion' }: RoleDetailProps) {
  const accordion = variant === 'accordion';

  return (
    <View style={accordion ? styles.rootAccordion : styles.rootInline}>
      <View style={accordion ? undefined : styles.descBoxInline}>
        <Text style={accordion ? styles.descAccordion : styles.descInline}>{description}</Text>
      </View>

      {chips.length > 0 && (
        <View style={accordion ? styles.chipSectionAccordion : styles.chipSectionInline}>
          <Text style={styles.chipTitle}>이런 장소를 찾아보세요</Text>
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 설명 박스 → 칩 섹션 간격. Frame 652(내 역할) 20 / contents(아코디언) 18
  rootAccordion: { gap: 18 },
  rootInline: { gap: 20 },

  /**
   * 설명 박스에는 자체 배경을 두지 않는다.
   *
   * 아코디언 패널 전체가 한 가지 색이어야 한다는 사용자 지시 때문이다 — 패널 위에 다른 노랑
   * 박스를 또 깔면 색이 두 겹으로 겹쳐 보인다. 강조가 필요한 것은 아래 칩(#FBE884)뿐이다.
   */
  descBoxInline: { borderRadius: 8 },
  descAccordion: {
    color: '#685210',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  descInline: {
    color: '#685210',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
  },

  // Frame 650: 라벨 → 칩 간격 4(아코디언) / 8(내 역할)
  chipSectionAccordion: { gap: 4 },
  chipSectionInline: { gap: 8 },
  chipTitle: {
    color: '#231903',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  // Frame 651: 칩 간격 4. 칩이 네 개를 넘으면 줄바꿈한다(디자인은 한 줄이지만 서버 값이 길 수 있다)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    height: 24,
    borderRadius: 30,
    backgroundColor: '#fbe884',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  chipText: {
    color: '#4a390f',
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
});
