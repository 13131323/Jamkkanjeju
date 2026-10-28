import { Modal, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/Button/Button';
import { missionCancelModalStyles as styles } from './styles';

/** Penpot Icon_Alert_Circle 안의 alert-triangle. 채움 #77be36 */
function AlertTriangleIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5L22 20.5H2L12 3.5z" stroke="#77be36" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 10v4" stroke="#77be36" strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 17.2v.1" stroke="#77be36" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export interface MissionCancelModalProps {
  visible: boolean;
  /**
   * "잠깐 쉴게요" — 진행도를 마지막으로 한 번 더 보낸 뒤 intro로 돌아간다.
   * 전송은 호출부가 한다(화면마다 저장할 데이터가 다르다).
   */
  onPause: () => void;
  /** "포기 할래요" — 진행도 없이 미션을 중단하고 intro로 돌아간다 */
  onAbandon: () => void;
  /** 스크림 탭·하드웨어 백 — 모달만 닫고 미션을 계속한다 */
  onClose: () => void;
}

/**
 * 미션 이탈 확인 모달. Penpot `Cancel_Confirmation_Modal`.
 *
 * 문화·보물찾기·협동 **모든 미션 진행 화면**의 뒤로가기가 이 모달을 띄운다(intro는 제외 —
 * 아직 시작 전이라 잃을 데이터가 없다). 그래서 공통 컴포넌트다.
 *
 * 모달은 데이터를 직접 보내지 않는다. 화면마다 저장할 것이 다르므로
 * (퀴즈 답안 / 보물 획득 목록 / 협동 진행도) 선택 결과만 알리고 전송은 각 화면이 한다.
 * 전송 로직을 여기 넣으면 모달이 미션 종류를 알아야 하고, 미션이 늘 때마다 모달이 커진다.
 */
export function MissionCancelModal({ visible, onPause, onAbandon, onClose }: MissionCancelModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* 스크림 탭이 "계속하기"다 — 닫기 버튼은 두지 않는다(사용자 지시). 하드웨어 백도 같은 경로다 */}
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* no-op onPress로 감싸 내용 영역 탭이 스크림으로 전파되지 않게 막는다 */}
        <Pressable style={styles.container} onPress={() => undefined}>
          <View style={styles.alertCircle}>
            <AlertTriangleIcon />
          </View>

          <Text style={styles.title}>미션을 그만하시겠습니까?</Text>
          <Text style={styles.subtitle}>{'쉬면 진행 내용이 저장되지만,\n포기하면 지금까지의 기록이 사라져요.'}</Text>

          {/* 디자인이 두 버튼의 폭을 내용에 맞춰 121 / 135로 다르게 잡았다.
              Button은 폭을 받지 않으므로 감싼 View가 폭을 정하고 Button이 그 안을 채운다.
              size="sm"(높이 48·radius 999)과 bold(700)가 디자인과 일치한다.
              연타 차단은 Button 내부 useSinglePress가 처리한다 */}
          <View style={styles.actions}>
            <View style={styles.pauseSlot}>
              <Button type="outline" size="sm" color="cool-neutral" bold text="잠깐 쉴게요" onPress={onPause} />
            </View>
            <View style={styles.abandonSlot}>
              <Button size="sm" color="cool-neutral" bold text="포기 할래요" onPress={onAbandon} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
