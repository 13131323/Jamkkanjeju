import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

interface MissionCancelGuardOptions {
  /**
   * 화면이 하드웨어 백을 먼저 처리할 기회.
   *
   * `true`를 돌려주면 화면이 소비한 것으로 보고 모달을 띄우지 않는다.
   * 보물찾기처럼 한 라우트 안에 단계가 여러 개인 화면이 "이전 단계로" 돌아가는 데 쓴다 —
   * 그 경우는 미션을 떠나는 게 아니므로 확인이 필요 없다.
   */
  onHardwareBack?: () => boolean;
}

interface MissionCancelGuard {
  /** 모달 표시 여부. MissionCancelModal의 visible에 그대로 넘긴다 */
  visible: boolean;
  /** 화면에 그린 뒤로가기 버튼의 onPress에 연결한다 */
  requestExit: () => void;
  /** 모달의 onClose에 연결한다 */
  dismiss: () => void;
}

/**
 * 미션 이탈을 확인 모달로 한 번 막는다.
 *
 * 화면에 그린 뒤로가기 버튼만 가로채면 **시스템 백 제스처·버튼으로 그냥 빠져나간다.**
 * 두 경로가 같은 모달을 띄워야 하므로 BackHandler 구독을 이 훅이 함께 들고 있는다.
 * 화면마다 BackHandler를 직접 붙이면 구독 해제를 빠뜨리기 쉽고,
 * 모달이 떠 있을 때 백을 한 번 더 누르는 경우의 처리가 화면마다 달라진다.
 */
export function useMissionCancelGuard(options: MissionCancelGuardOptions = {}): MissionCancelGuard {
  const { onHardwareBack } = options;
  const [visible, setVisible] = useState(false);

  const requestExit = useCallback(() => setVisible(true), []);
  const dismiss = useCallback(() => setVisible(false), []);

  // 호출부는 이 콜백을 대개 인라인 화살표로 넘긴다(=매 렌더 새 함수). 그대로 의존성에 넣으면
  // 렌더마다 BackHandler를 떼었다 붙였다 하게 되는데, 보물찾기 step2처럼 나침반이 초당 수십 번
  // 리렌더를 만드는 화면에서는 그 빈도로 구독이 갈린다. 최신 콜백만 ref로 받아 둔다.
  const onHardwareBackRef = useRef(onHardwareBack);
  useEffect(() => {
    onHardwareBackRef.current = onHardwareBack;
  }, [onHardwareBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // 모달이 떠 있으면 백은 모달을 닫는다(X와 동일)
      if (visible) {
        setVisible(false);
        return true;
      }

      // 화면이 자체적으로 처리할 수 있으면(예: 보물찾기 단계 되돌리기) 모달을 띄우지 않는다
      if (onHardwareBackRef.current?.() === true) return true;

      // true를 돌려주면 RN이 이벤트를 소비해 기본 뒤로가기가 막힌다
      setVisible(true);
      return true;
    });

    return () => subscription.remove();
  }, [visible]);

  return { visible, requestExit, dismiss };
}
