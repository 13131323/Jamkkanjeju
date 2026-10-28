import { Text, View } from 'react-native';
import { toastStyles as styles } from './styles';
import type { ToastVariant } from './toastQueue';

/**
 * 토스트 말풍선 **모양만** 담당한다. 큐·타이머·표시 위치는 갖지 않는다.
 *
 * `ToastProvider`는 화면 트리에 그려지는데, RN의 `Modal`은 Android에서 **별도 윈도우**라
 * 그 위에 뜨지 못한다 — 시트를 열어 둔 채 복사하면 안내가 시트 뒤에 가려져 보이지 않았다.
 * 토스트 자체를 Modal로 감싸면 그 Modal이 하드웨어 백을 삼켜 버려서(1.4초 동안 뒤로가기가
 * 먹히지 않는다) 그 방법은 쓰지 않았다.
 *
 * 대신 Modal 안에 있는 화면이 **같은 생김새의 말풍선을 직접** 띄울 수 있게 모양을 떼어 놓는다.
 * 두 곳이 각자 스타일을 그리면 같은 안내가 화면마다 다르게 보인다.
 */
export function ToastBubble({ message, variant = 'dark' }: { message: string; variant?: ToastVariant }) {
  if (variant === 'guide') {
    return (
      <View style={styles.guideToast}>
        <Text style={styles.guideText}>{message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.toast}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}
