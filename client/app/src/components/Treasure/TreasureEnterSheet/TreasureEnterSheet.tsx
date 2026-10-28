import { useEffect, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Text, View } from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button/Button';
import { shouldCloseOnDragRelease, shouldStartSheetDrag } from '@/constants/bottomSheetDrag';
import { TREASURE_SHEET_HEIGHT, treasureEnterSheetStyles as styles } from './styles';
import { ctaBottomPadding } from '@/styles/safeArea';

/** 시트가 올라오고 내려가는 시간(ms) */
const SLIDE_MS = 260;

/**
 * 제목 아래 고정 문구. 장소 설명은 이 시트에 넣지 않는다 —
 * 전문은 지도 하단의 장소 소개 카드(TreasurePlaceSummaryCard)에서 눌러 펼쳐 본다.
 */
const SHEET_DESCRIPTION = '보물을 열어 보상을 확인해보세요.';

interface TreasureEnterSheetProps {
  /** 반경 안에 들어와 있으면 true. false가 되면 아래로 내려가며 사라진다 */
  visible: boolean;
  /** 가장 가까운 보물의 순번. 제목 "N번째 장소 반경에 들어왔어요!"에 쓰인다 */
  treasureOrder: number;
  /** 닫힌 보물 에셋 */
  image: ImageSourcePropType;
  onOpenCamera: () => void;
  /**
   * 손으로 끌어내려 닫았을 때. 반경 안에 있어도 닫힌 상태를 유지해야 하므로 상위 화면이 기억한다
   * (다시 열려면 지도의 보물 아이콘을 누른다 — app/mission/treasure.tsx).
   */
  onDismiss: () => void;
}

/**
 * 보물 반경 진입 시 올라오는 하단 시트. Penpot TreasureHunt_step1.
 *
 * prompt §9 '보물 좌표 기준 반경 500m 안에 들어오면 step1의 모달 뜸 / 반경 1km까진 모달 open 유지'
 * — 열림/닫힘 판정(500m 진입, 1km 이탈)은 상위 화면이 하고, 이 컴포넌트는 visible만 따른다.
 *
 * Modal이 아니라 화면 안 absolute 시트인 이유: 디자인에 스크림이 없고 시트 위쪽으로 지도가
 * 그대로 보인다. Modal로 띄우면 그 아래 지도(WebView)가 터치를 받지 못한다.
 *
 * 숨어 있는 동안에도 트리에 남겨 두고 pointerEvents로만 끊는다 —
 * 언마운트 여부를 상태로 들면 애니메이션 콜백에서 setState를 해야 하고,
 * 화면 밖으로 밀려난 시트는 어차피 보이지 않는다.
 */
export function TreasureEnterSheet({ visible, treasureOrder, image, onOpenCamera, onDismiss }: TreasureEnterSheetProps) {
  const insets = useSafeAreaInsets();
  // 렌더 중 ref 접근을 피하려고 지연 초기화 useState로 Animated.Value를 만든다(Toast.tsx와 같은 이유)
  const [translateY] = useState(() => new Animated.Value(visible ? 0 : TREASURE_SHEET_HEIGHT));
  /**
   * 실측 높이. 높이를 디자인 값(332)으로 고정하면 하단 inset이 큰 기기(3버튼 네비게이션바)에서
   * CTA가 잘리므로 콘텐츠 높이대로 두고, 숨길 때 밀어낼 거리만 여기서 읽는다.
   */
  const [measuredHeight, setMeasuredHeight] = useState(TREASURE_SHEET_HEIGHT);

  function handleLayout(event: LayoutChangeEvent) {
    const { height } = event.nativeEvent.layout;
    // 같은 값으로 setState를 반복하면 레이아웃 → 렌더 루프가 생긴다
    if (height > 0 && Math.round(height) !== Math.round(measuredHeight)) setMeasuredHeight(height);
  }

  useEffect(() => {
    const animation = Animated.timing(translateY, {
      toValue: visible ? 0 : measuredHeight,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, translateY, measuredHeight]);

  /** 놓았을 때 닫히지 않을 만큼만 끌린 경우 제자리로 되돌린다 */
  function settleBack() {
    Animated.timing(translateY, { toValue: 0, duration: SLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  // 잡이·문구 영역을 끌어내려 닫는다. 문턱값과 판정은 협동 미션 시트와 공유한다(constants/bottomSheetDrag.ts).
  // 닫을 때 여기서 애니메이션을 돌리지 않고 onDismiss만 부르는 이유: visible이 false가 되면
  // 위 effect가 지금 끌려온 위치에서 이어서 내려보내므로 애니메이션이 두 번 겹치지 않는다.
  const drag = PanResponder.create({
    // 터치가 내려앉는 순간 responder를 잡는다 — 이게 없으면 첫 움직임이 아래 지도로 새는 경우가 있다
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => shouldStartSheetDrag(gesture.dy, gesture.dx),
    // 드래그 중에는 아래 WebView가 제스처를 가져가지 못하게 한다
    onPanResponderTerminationRequest: () => false,
    // 위로는 끌리지 않게 0에서 자른다
    onPanResponderMove: (_event, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (shouldCloseOnDragRelease(gesture.dy, gesture.vy)) {
        onDismiss();
        return;
      }
      settleBack();
    },
    // 다른 곳이 제스처를 가져가면(시스템 뒤로가기 스와이프 등) 제자리로 되돌린다
    onPanResponderTerminate: () => settleBack(),
  });

  return (
    <Animated.View
      onLayout={handleLayout}
      // 내려가 있는 동안 보이지 않는 시트가 지도 터치를 가로채지 않게 한다
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.sheet, { minHeight: TREASURE_SHEET_HEIGHT, transform: [{ translateY }] }]}
    >
      {/* 잡이와 문구까지가 드래그 영역이다. CTA는 제외한다 — 버튼을 누르려다 시트가 내려가면 안 된다 */}
      <View {...drag.panHandlers}>
        <View style={styles.handle} />

        <View style={styles.body}>
          <View style={styles.textGroup}>
            <Text style={styles.title}>{`${treasureOrder}번째 장소 반경에 들어왔어요!`}</Text>
            <Text style={styles.description}>{SHEET_DESCRIPTION}</Text>
          </View>

          <Image source={image} style={styles.image} resizeMode="contain" />
        </View>
      </View>

      <View style={[styles.ctaWrapper, { paddingBottom: ctaBottomPadding(insets.bottom) }]}>
        {/* cool-neutral solid = #333333 / radius 999 / 라벨 16·Bold·#ffffff — 디자인 Button 그대로 */}
        <Button color="cool-neutral" bold text="카메라 켜기" onPress={onOpenCamera} />
      </View>
    </Animated.View>
  );
}
