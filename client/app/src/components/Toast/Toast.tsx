import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_BOTTOM_INSET } from '@/styles/safeArea';
import { TOAST_CTA_CLEARANCE, TOAST_GAP, toastStyles as styles } from './styles';
import { clear, dequeue, enqueue, EMPTY_TOAST_QUEUE, type ToastQueue, type ToastVariant } from './toastQueue';

/**
 * 한 메시지가 화면에 머무는 시간.
 *
 * 2400에서 줄였다(사용자 지시). 토스트는 겹치지 않고 줄을 서므로 이 값이 길수록 **뒤에 선
 * 안내가 늦게 뜬다** — 방장이 여러 명을 빠르게 거절하면 마지막 안내가 몇 초 뒤에 나왔다.
 * 짧은 한 줄을 읽는 데는 충분하고, 대기줄 상한(MAX_PENDING_TOASTS)과 함께 지연을 잡는다.
 */
const VISIBLE_MS = 1000;
const FADE_MS = 200;

export interface ToastOptions {
  /** 기본 'dark'. 'guide'는 보물찾기 step0의 흰 반투명 안내 토스트 */
  variant?: ToastVariant;
  /**
   * 화면 아래에서 비켜 갈 높이(px). 기본값은 하단 CTA 버튼 높이다.
   *
   * 토스트를 쓰는 화면마다 아래에 깔린 것이 달라서 호출부가 정한다 —
   * 협동 미션은 "다음" 버튼, 보물찾기 step0은 장소 한 줄 소개 카드다.
   */
  bottomClearance?: number;
}

interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
  /**
   * 떠 있는 토스트를 즉시 내린다.
   *
   * show만 있으면 한 번 띄운 토스트는 2.4초를 다 채운다. 같은 자리에 시트·모달이 올라오는
   * 화면에서는 그 사이에 둘이 겹쳐 보이므로, 올리는 쪽이 직접 내릴 수 있어야 한다.
   */
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * 토스트 표시 지점.
 *
 * 루트 레이아웃의 SafeAreaProvider 안, Stack 밖에 둔다 —
 * 화면이 바뀌어도 살아 있어야 하고 모든 화면 위에 떠야 한다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastQueue>(EMPTY_TOAST_QUEUE);
  const insets = useSafeAreaInsets();
  // useRef(...).current를 렌더 중에 읽으면 react-hooks/refs가 잡는다.
  // 지연 초기화 useState는 값을 한 번만 만들면서 렌더 중 ref 접근을 피한다.
  const [opacity] = useState(() => new Animated.Value(0));

  const show = useCallback((message: string, options?: ToastOptions) => {
    setQueue((prev) => enqueue(prev, { message, variant: options?.variant ?? 'dark', bottomClearance: options?.bottomClearance }));
  }, []);

  const hide = useCallback(() => {
    setQueue(clear());
    // 다음 show가 페이드 인으로 시작하도록 되돌린다 — 1로 남겨 두면 새 토스트가 튀어나온다
    opacity.setValue(0);
  }, [opacity]);

  // exhaustive-deps는 '.current' 접근을 ref로 오인해 의존성으로 인정하지 않는다.
  // 여기선 평범한 객체 필드이므로 지역 변수로 뽑아 넘긴다.
  const current = queue.current;
  // 애니메이션은 "표시할 메시지가 바뀌었을 때"만 다시 돌아야 한다. current 객체는 매 enqueue마다
  // 새로 만들어지므로 문자열을 의존성으로 쓴다.
  const currentMessage = current?.message ?? null;

  // 메시지가 채워지면 페이드 인 → 유지 → 페이드 아웃 후 다음 메시지로 넘긴다.
  useEffect(() => {
    if (currentMessage === null) return;

    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.delay(VISIBLE_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]);

    animation.start(({ finished }) => {
      // 언마운트나 중단으로 끝난 경우엔 큐를 건드리지 않는다
      if (finished) setQueue((prev) => dequeue(prev));
    });

    return () => animation.stop();
  }, [currentMessage, opacity]);

  // 두 함수 모두 useCallback으로 고정돼 있어 Provider 리렌더가 소비자로 번지지 않는다
  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current !== null && (
        <View
          // 토스트가 떠 있어도 아래 화면을 계속 조작할 수 있어야 한다
          pointerEvents="none"
          style={[
            styles.layer,
            {
              // 하단 inset + 아래에 깔린 요소 높이 + 간격 → 그 요소 위로 16이 남는다
              paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) + (current.bottomClearance ?? TOAST_CTA_CLEARANCE) + TOAST_GAP,
            },
          ]}
        >
          {current.variant === 'guide' ? (
            <Animated.View style={[styles.guideToast, { opacity }]}>
              <Text style={styles.guideText}>{current.message}</Text>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.toast, { opacity }]}>
              <Text style={styles.text}>{current.message}</Text>
            </Animated.View>
          )}
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있어요.');
  }
  return context;
}
