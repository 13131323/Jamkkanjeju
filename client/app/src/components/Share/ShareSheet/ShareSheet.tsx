import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Platform, Pressable, Share, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastBubble } from '@/components/Toast/ToastBubble';
import { shouldCloseOnDragRelease, shouldStartSheetDrag } from '@/constants/bottomSheetDrag';
import { coopTrace } from '@/utils/coopTrace';
import { useSinglePress } from '@/hooks/useSinglePress';
import { buildLineShareUrl, buildMailShareUrl, buildShareMessage, buildSmsShareUrl, type ShareContent } from '@packages/shared';
import { CloseGlyph, LineGlyph, LinkGlyph, MailGlyph, MessageGlyph, MoreGlyph } from './icons';
import { SHARE_ACTIONS, type ShareActionId } from './shareActions';
import { CLOSE_HIT_SLOP, SHARE_ICON_COLORS, shareSheetStyles as styles } from './styles';

/**
 * 시트가 자기 높이만큼 움직이는 데 걸리는 시간. PhotoGuideSheet와 같은 값·같은 곡선을 쓴다 —
 * 같은 흐름(협동 미션 초대)에서 올라오는 시트 둘이 다른 속도로 움직이면 손에 어긋나게 잡힌다.
 */
const SHEET_TRAVEL_MS = 220;
const SHEET_EASING = Easing.out(Easing.cubic);

/** 시트 아래 여백. PhotoGuideSheet의 `Math.max(insets.bottom, 16) + 18`을 그대로 쓴다 */
const SHEET_BOTTOM_INSET_MIN = 16;
const SHEET_BOTTOM_EXTRA = 18;

/** 복사 안내가 시트 안에 머무는 시간. 전역 토스트(Toast.tsx)와 같은 값을 쓴다 */
const NOTICE_VISIBLE_MS = 1000;

const COPY = {
  title: '공유하기',
  close: '공유하기 닫기',
  copy: '링크 복사하기',
  copyFailed: '링크를 복사하지 못했어요.',
  copied: '링크가 복사되었어요',
} as const;

/** 원 하나를 그릴 때 쓰는 글리프. 색은 styles의 SHARE_ICON_COLORS가 정한다 */
const ACTION_GLYPHS: Record<ShareActionId, (props: { color: string }) => React.ReactElement> = {
  line: LineGlyph,
  sms: MessageGlyph,
  mail: MailGlyph,
  more: MoreGlyph,
};

interface ShareSheetProps {
  visible: boolean;
  /**
   * 무엇을 공유할지 — 안내 문구·주소·(메일 제목). **이 시트는 URL을 만들지 않는다.**
   *
   * 초대 링크인지 엽서 이미지인지 시트는 모른 채 받은 것을 그대로 넘긴다. 화면마다 다른 말을 해야 해서
   * (초대는 "함께 귤나무를 키워요!", 엽서는 엽서다운 문구) 문구도 상수가 아니라 값으로 받는다.
   */
  content: ShareContent;
  onClose: () => void;
  /** 공유가 실패했을 때. 화면마다 알리는 방법(토스트·배너)이 달라 시트가 직접 띄우지 않는다 */
  onShareError?: (message: string) => void;
  /**
   * 링크를 클립보드에 담았을 때. 시트는 토스트를 띄울 수단이 없어서(화면마다 알리는 방법이 다르다)
   * 알리는 일을 화면(together.tsx 등)에 넘긴다. 시트 자신은 아무 표시도 바꾸지 않는다.
   */
  onCopied?: () => void;
}

/**
 * 링크 하나를 다른 앱으로 넘기는 공용 바텀시트.
 *
 * OS 공유 시트를 곧바로 띄우면 무엇이 공유되는지 보이지 않는다. 이 시트는 그 사이에 들어가
 * **공유할 링크를 눈으로 확인**하게 하고, 거기서 공유 방법을 고르게 한다.
 *
 * **원래는 협동 미션 초대 전용이었다**(`Coop/InviteShareSheet/InviteShareSheet.tsx`). AI 엽서 결과
 * 화면도 같은 공유가 필요해지면서 — 그쪽은 web이 그리는 화면이라 앱이 브릿지(`SHARE_SHEET`)를 받고
 * 이 시트를 WebView 위에 올린다 — 무엇을 공유하는지 모르게 고쳐 여기로 옮겼다. 초대 쪽은 문구만 채워
 * 넣는 얇은 래퍼로 남아 있어 그 화면의 동작은 그대로다. **치수·색·애니메이션·드래그 문턱은 옮기면서
 * 하나도 바꾸지 않았다.**
 *
 * 내용·치수는 시안(`app/assets/images/ShareBottomSheetContainer.png`) 기준이고, 등장·드래그·스크림
 * 동작만 PhotoGuideSheet를 본떴다(같은 흐름의 선례). 다른 점은 높이뿐이다 — 가이드 시트는 화면 위까지
 * 차지하지만 이 시트는 내용만큼만 차지하므로, 내려가야 할 거리를 미리 알 수 없어 `onLayout`으로 잰다.
 * 재기 전에는 화면 아래 밖에 세워 두어 깜빡이지 않게 한다.
 *
 * **원 4개가 실제로 무엇을 하는가.**
 * - 라인: `https://line.me/R/msg/text/?…`로 본문까지 실어 곧장 연다. 라인의 공식 텍스트 공유 링크라
 *   진짜로 대화 선택 화면까지 간다(근거는 `@packages/shared`의 `share/shareMessage.ts` 주석).
 * - 문자·메일: 각각 `sms:` / `mailto:` URL을 만들어 곧장 연다. 실제로 그 앱이 열린다.
 * - 더보기: OS 공유 시트. 설치된 공유 앱 목록을 아는 주체가 OS뿐이라(React Native에도 Expo 56에도
 *   조회 API가 없다) "다른 앱들을 보여 주는" 일을 그대로 넘긴다.
 *
 * `Linking.openURL`은 그 주소를 받을 앱이 없으면 실패한다. 그래서 라인·문자·메일 셋 다 실패하면 OS
 * 공유 시트로 되돌린다 — **눌러도 아무 일이 일어나지 않는 버튼은 이 시트에 없다.**
 *
 * **`Pressable`의 style은 반드시 객체로 준다 — 함수형(`({ pressed }) => …`)을 쓰면 스타일이 통째로
 * 사라진다.** 이 앱은 NativeWind를 쓰고 그 JSX 런타임이 `Pressable`에 넘긴 함수형 style을 흘린다.
 * 실제로 그렇게 두었을 때 기기에서 링크 카드의 배경·테두리·높이(46)와 CTA 높이(52), 아이콘 칸 폭(64)이
 * 하나도 적용되지 않아 CTA가 화면에서 사라졌다(uiautomator 실측: 카드 26.7dp, CTA 32dp = 글자 높이만).
 * 그래서 눌린 순간의 투명도 표시는 포기했다 — 저장소의 다른 `Pressable`(RoleVerify의 업로드 박스,
 * together-materials의 촬영 가이드 칩)도 모두 객체 style이고 눌림 표시를 쓰지 않는다.
 * **되돌리지 마라. 함수형으로 바꾸는 순간 이 시트의 레이아웃이 다시 무너진다.**
 *
 * **무엇을 눌러도 이 시트는 스스로 닫히지 않는다 — 네 원도, 링크 카드도, 하단 CTA도.** 다른 앱이 떴다
 * 사라진 것과 사용자가 공유를 마친 것은 다른 일인데, 밖으로 나갔다 돌아온 사이에 시트까지 없어지면
 * "보냈는지" 확인할 수도, 다른 방법으로 다시 보낼 수도 없다. 복사도 마찬가지다 — 링크를 복사한 뒤
 * 라인이나 문자로 한 번 더 보내는 것이 흔한 다음 동작이라, 복사 경로(`copyUrl`)는 성공을
 * `onCopied`로 알리기만 하고 시트에는 손대지 않는다.
 * 닫는 것은 ✕·스크림·아래로 끌기, 그리고 **안드로이드 하드웨어 뒤로가기**다 — 뒤로가기는 RN `Modal`이
 * 자기 윈도우에서 받아 `onRequestClose`로 넘겨 주므로 화면 쪽에서 따로 잡을 것이 없다.
 */
export function ShareSheet({ visible, content, onClose, onShareError, onCopied }: ShareSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // useRef(...).current를 렌더 중에 읽으면 react-hooks/refs가 잡는다.
  // 지연 초기화 useState는 값을 한 번만 만들면서 렌더 중 ref 접근을 피한다(PhotoGuideSheet와 같은 방식).
  const [translateY] = useState(() => new Animated.Value(windowHeight));
  /** 잰 시트 높이. 0이면 아직 못 쟀다는 뜻이라 화면 높이만큼 내려 둔다(=보이지 않는다) */
  const [sheetHeight, setSheetHeight] = useState(0);
  /**
   * 시트 안에 잠깐 뜨는 안내(복사 완료).
   *
   * 화면의 전역 토스트를 쓸 수 없어서 여기서 직접 띄운다 — 이 시트는 `Modal` 안이고,
   * Android에서 Modal은 별도 윈도우라 앱 트리의 토스트가 그 뒤에 가린다.
   */
  const [notice, setNotice] = useState<string | null>(null);
  // 타이머 핸들은 ref에 담는다. useState 값을 고쳐 쓰면 react-compiler가 "바꿀 수 없는 값"으로
  // 막고, 렌더 중에 ref를 읽으면 react-hooks/refs가 막는다 — 이벤트 핸들러와 정리 함수 안에서만
  // 만지면 두 규칙을 모두 지킨다.
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (message: string) => {
    coopTrace('복사:안내 표시', { message });
    if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_VISIBLE_MS);
  };

  // 시트가 사라진 뒤 타이머가 살아 있으면 언마운트된 컴포넌트를 건드린다
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const travel = sheetHeight > 0 ? sheetHeight : windowHeight;

  // 높이를 잰 뒤에 올라온다. 재기 전(sheetHeight 0)에는 아무것도 하지 않으므로
  // 시트는 초기값 그대로 화면 밖에 있다 — 제자리에서 한 번 보였다가 다시 올라오는 깜빡임이 없다.
  useEffect(() => {
    if (!visible || sheetHeight === 0) return;

    translateY.setValue(sheetHeight);
    const animation = Animated.timing(translateY, {
      toValue: 0,
      duration: SHEET_TRAVEL_MS,
      easing: SHEET_EASING,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [visible, sheetHeight, translateY]);

  /**
   * 아래로 빠지며 닫는다. 스크림 탭·하드웨어 백·드래그가 모두 이 경로를 쓴다.
   * 남은 거리에 비례해 시간을 줄여야 어디서 놓아도 같은 속도로 빠진다(PhotoGuideSheet와 같은 규칙).
   */
  const slideOut = (fromY = 0) => {
    const remaining = Math.max(0, travel - fromY);

    Animated.timing(translateY, {
      toValue: travel,
      duration: (remaining / travel) * SHEET_TRAVEL_MS,
      easing: SHEET_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      // 애니메이션이 끝난 뒤에 알린다. 부모가 먼저 visible을 내리면
      // Modal이 그 자리에서 사라져 내려가는 모습이 보이지 않는다.
      onClose();
    });
  };

  /** 문턱을 못 넘겼을 때 제자리로. 되돌아가는 것도 같은 속도로 맞춘다 */
  const settleBack = (fromY = 0) => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: (Math.max(0, fromY) / travel) * SHEET_TRAVEL_MS,
      easing: SHEET_EASING,
      useNativeDriver: true,
    }).start();
  };

  // 시트 상단(잡이·제목행)만 끌어 내릴 수 있다. 아래쪽에는 누를 것들이 있어서
  // 시트 전체를 responder로 잡으면 그 탭이 삼켜진다. 제목행의 닫기 버튼은 이 View보다 깊어서
  // 터치 시작 시 responder 경합에서 먼저 잡는다(부모에 Capture 핸들러를 두지 않았다).
  const drag = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => shouldStartSheetDrag(gesture.dy, gesture.dx),
    onPanResponderTerminationRequest: () => false,
    // 위로는 끌리지 않게 0에서 자른다 — 시트가 제자리보다 올라갈 자리가 없다
    onPanResponderMove: (_event, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      const draggedTo = Math.max(0, gesture.dy);
      if (shouldCloseOnDragRelease(gesture.dy, gesture.vy)) {
        slideOut(draggedTo);
        return;
      }
      settleBack(draggedTo);
    },
    onPanResponderTerminate: (_event, gesture) => settleBack(Math.max(0, gesture.dy)),
  });

  // 스크림은 시트가 제자리에 있을 때 가장 진하고, 아래로 내려간 만큼 함께 옅어진다
  const scrimOpacity = translateY.interpolate({
    inputRange: [0, travel],
    outputRange: [1, 0],
  });

  /**
   * OS 공유 시트를 띄운다. 더보기의 동작이자, 라인·문자·메일이 열리지 않을 때의 폴백이다.
   *
   * **결과(`sharedAction`/`dismissedAction`)를 보지 않는다.** 보냈든 취소했든 이 시트는 그대로 열려
   * 있어야 한다 — 한 명에게 보낸 뒤 다른 사람에게 또 보내는 것이 이 화면의 흔한 다음 동작이고,
   * `sharedAction`은 "공유 앱을 골랐다"까지만 뜻해서 실제로 보냈다는 보장도 아니다.
   *
   * OS 공유 시트의 **크기·위치는 OS가 정한다. 앱이 지정할 수 없다** — Android는 시스템 chooser,
   * iOS는 UIActivityViewController를 각자의 규격으로 띄우며 React Native의 `Share`에는 그 모양을
   * 넘길 인자가 없다. 이 시트와 같은 높이로 맞춰 달라는 요청은 그래서 들어줄 수 없다.
   */
  const openOsShareSheet = async (message: string) => {
    try {
      await Share.share({ message });
    } catch (error) {
      onShareError?.(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * 라인·문자·메일 앱을 연다. 그 주소를 받을 앱이 없으면 `openURL`이 실패하는데, 그때 아무 일도 하지 않으면
   * 고장난 버튼이 되므로 OS 공유 시트로 되돌린다.
   *
   * 성공했을 때 시트를 닫지 않는 건 `openURL`이 "앱이 떴다"까지만 알려 주고 실제로 보냈는지는 모르기
   * 때문이다. 보내지 않고 돌아온 사용자에게는 시트가 남아 있어야 다시 고를 수 있다.
   */
  const openExternal = async (url: string, message: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // 원본 예외(ActivityNotFoundException 등)를 그대로 올리면 사용자가 읽을 수 없다.
      // 메시지를 보여 주는 대신 확실히 되는 경로로 잇는다.
      await openOsShareSheet(message);
    }
  };

  const runAction = (id: ShareActionId) => {
    const message = buildShareMessage(content);
    // 링크가 없으면 보낼 것이 없다. 안내 문구만 담긴 글은 받는 사람이 들어올 방법이 없다.
    if (message === '') return;

    if (id === 'line') {
      // https 주소라 라인이 없는 기기에서도 브라우저가 받는다. 그래도 열 앱이 하나도 없을 수 있어
      // 폴백은 문자·메일과 같은 헬퍼를 그대로 쓴다.
      void openExternal(buildLineShareUrl(content), message);
      return;
    }

    if (id === 'sms') {
      // Platform.OS는 web도 될 수 있는데 그 경우 Android 규칙(`?body=`)이 표준에 맞다
      void openExternal(buildSmsShareUrl(content, Platform.OS === 'ios' ? 'ios' : 'android'), message);
      return;
    }

    if (id === 'mail') {
      void openExternal(buildMailShareUrl(content), message);
      return;
    }

    // more — 곧장 넘길 공개 경로가 없어 OS 공유 시트가 유일한 실제 동작이다
    void openOsShareSheet(message);
  };

  /**
   * 링크만 클립보드에 담는다 — 안내 문구를 빼는 건 붙여 넣을 곳이 주소창일 수도 있어서다.
   *
   * 링크 카드와 하단 CTA가 **같은 이 함수**를 부른다. 복사 경로가 둘이어도 동작이 갈라지면 안 된다.
   *
   * **복사해도 시트를 닫지 않는다.** 여기서 `slideOut()`도 `onClose()`도 부르지 않는 건 일부러다 —
   * 링크를 복사한 것과 공유를 마친 것은 다른 일이고, 복사한 김에 라인·문자로 한 번 더 보내는 것이
   * 이 화면의 흔한 다음 동작이다. 닫는 것은 ✕·스크림·아래로 끌기뿐이다(위 컴포넌트 설명 참고).
   *
   * 안내는 **시트가 직접** 띄운다. 화면(together.tsx 등)의 토스트는 앱 트리에 그려지는데 이 시트는
   * RN `Modal`(Android에서 별도 윈도우) 안이라 그 뒤에 가려져 보이지 않았다.
   * `onCopied`는 화면이 다른 일을 덧붙일 수 있게 계속 부른다.
   *
   * **실패했으면 `onCopied`를 부르지 않는다.** 안 됐는데 "복사했어요"가 뜨면 사용자는 빈 클립보드를
   * 붙여 넣게 된다. 실패는 두 가지로 온다 — 예외(catch)와, 예외 없이 `false`를 돌려주는 경우다.
   * `setStringAsync`는 iOS·Android에서는 항상 `true`지만 web에서는 실제 성공 여부를 담아 준다.
   *
   * `coopTrace`는 협동 미션 흐름을 좇으려고 넣은 개발 빌드 전용 로그다. 시트가 공용이 된 뒤에도
   * 그대로 두는 건 이 경로에서 실제로 진단에 쓰였기 때문이고(복사가 `false`로 돌아오던 건),
   * 배포 빌드에서는 호출 자체가 아무 일도 하지 않는다.
   */
  const copyUrl = async () => {
    const url = content.url.trim();
    coopTrace('복사:시도', { length: url.length });
    if (url === '') return;

    try {
      const copied = await Clipboard.setStringAsync(url);
      coopTrace('복사:결과', { copied, type: typeof copied });
      // **`=== false`로만 실패로 본다.** 타입 선언은 boolean이지만 플랫폼·버전에 따라
      // `undefined`로 resolve되는 경우가 있고, `!copied`로 막으면 성공한 복사가 실패로 뒤집혀
      // 안내가 아예 뜨지 않는다(기기에서 그 증상으로 확인했다).
      if (copied === false) {
        onShareError?.(COPY.copyFailed);
        return;
      }
      showNotice(COPY.copied);
      onCopied?.();
    } catch (error) {
      onShareError?.(error instanceof Error ? error.message : COPY.copyFailed);
    }
  };

  // 연타를 한 번으로 접는다. 공용 Button이 안에서 하던 일을 직접 그리게 되면서 여기로 옮겨 왔다
  const handleCopy = useSinglePress(() => void copyUrl());

  return (
    // slideOut은 fromY를 받으므로 이벤트 핸들러에 그대로 넘기지 않는다 —
    // 넘기면 네이티브 이벤트 객체가 fromY 자리에 들어간다
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => slideOut()} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: scrimOpacity }]}>
        {/* 라벨이 ✕ 버튼(COPY.close)과 다른 건 일부러다 — 같은 말이 두 번 읽히면 어느 쪽을 누른 건지 알 수 없다 */}
        <Pressable style={styles.overlayPress} onPress={() => slideOut()} accessibilityRole="button" accessibilityLabel="공유 닫기" />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SHEET_BOTTOM_INSET_MIN) + SHEET_BOTTOM_EXTRA, transform: [{ translateY }] }]}
        onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
        accessibilityViewIsModal
      >
        {/* 이 영역만 끌어내려 닫을 수 있다 */}
        <View style={styles.dragArea} {...drag.panHandlers} accessibilityLabel="아래로 끌어 닫기">
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{COPY.title}</Text>

            {/* style을 함수형으로 주면 NativeWind가 흘린다(위 설명 참고). 이 버튼은 아이콘만 있어 style 자체가 필요 없다 */}
            <Pressable onPress={() => slideOut()} hitSlop={CLOSE_HIT_SLOP} accessibilityRole="button" accessibilityLabel={COPY.close}>
              <CloseGlyph />
            </Pressable>
          </View>
        </View>

        {/* 카드 전체가 복사 버튼이다 — 링크를 보고 바로 누르는 손을 아래 CTA까지 내려보내지 않는다 */}
        <Pressable onPress={handleCopy} style={styles.linkCard} accessibilityRole="button" accessibilityLabel={`${COPY.copy} ${content.url}`}>
          <LinkGlyph />
          {/*
            한 줄로 자르고 꼬리를 말줄임한다(시안도 `.../invite/ab...`). 가운데를 줄이면 주소가 두 토막으로
            읽혀 링크처럼 보이지 않는데, 토큰을 눈으로 확인할 일은 없다 — 누르면 주소 전체가 복사된다.
          */}
          <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
            {content.url}
          </Text>
        </Pressable>

        <View style={styles.iconRow}>
          {SHARE_ACTIONS.map((action) => {
            const Glyph = ACTION_GLYPHS[action.id];
            const { background, glyph } = SHARE_ICON_COLORS[action.id];

            return (
              <Pressable key={action.id} onPress={() => runAction(action.id)} style={styles.iconItem} accessibilityRole="button" accessibilityLabel={`${action.label}(으)로 공유하기`}>
                <View style={[styles.iconCircle, { backgroundColor: background }]}>
                  <Glyph color={glyph} />
                </View>
                <Text style={styles.iconLabel} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 안내는 CTA를 기준으로 그 위 16에 뜬다. 흐름에 넣지 않는 이유(시트 높이 출렁임)와
            시트가 아니라 이 칸을 기준으로 삼는 이유는 styles.ts의 ctaBlock 주석 참고 */}
        <View style={styles.ctaBlock}>
          {notice !== null && (
            <View style={styles.noticeLayer} pointerEvents="none">
              <ToastBubble message={notice} />
            </View>
          )}

          <Pressable onPress={handleCopy} style={styles.cta} accessibilityRole="button" accessibilityLabel={COPY.copy}>
            <Text style={styles.ctaLabel}>{COPY.copy}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}
