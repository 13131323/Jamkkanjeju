import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button/Button';
import { TreasureHeader } from '@/components/Treasure/TreasureHeader/TreasureHeader';
import { TreasureProgressCard } from '@/components/Treasure/TreasureProgressCard/TreasureProgressCard';
import { Treasure, TREASURE_DEV_ALWAYS_VISIBLE, TREASURE_DISCOVERY_RADIUS_METERS, TREASURE_PLACE_GUIDE_ICON } from '@/constants/treasureHunt';
import { MIN_BOTTOM_INSET } from '@/styles/safeArea';
import { isValidHeading, type Coords } from '@/utils/geo';
import { CAMERA_GUIDE_DEFAULT, resolveCameraGuide } from './cameraGuide';
import { computeDevTreasurePlacement, computeTreasurePlacement, TreasurePlacement } from './geoPlacement';
import { separateTreasurePlacements } from './separatePlacements';
import { CAMERA_HEADER_HEIGHT, CAMERA_PROGRESS_TOP_GAP, treasureHuntCameraStyles as styles } from './styles';

interface TreasureHuntCameraProps {
  /**
   * 이 장소의 보물 전체. 이미 찾은 보물도 빼지 않고 넘긴다 —
   * prompt §9 "이미 클릭했던 보물은 찾았으므로 '열린 에셋'으로 바뀜(또 누를 때 모달 띄우나 다른 메시지 제공)"
   */
  treasures: Treasure[];
  /** 이미 찾은 보물 번호(서버 treasureIndex) */
  foundTreasureIndexes: number[];
  /** 찾아야 하는 전체 개수. 서버가 준 treasureCount다 */
  totalCount: number;
  /** 현재 위치. useTreasureLocation이 상위에서 구독한 값을 그대로 받는다 */
  coords: Coords | null;
  /** 스무딩된 trueHeading. 무효값은 INVALID_HEADING */
  heading: number;
  /** 위치 권한이 거부됐는지 */
  locationDenied: boolean;
  /** 두 번째 인자는 "이미 찾은 보물을 다시 눌렀는지" */
  onSelectTreasure: (treasure: Treasure, alreadyFound: boolean) => void;
  onBack: () => void;
}

/**
 * 카메라/위치 권한이 없을 때의 대체 화면. 디자인이 없어(작업 지시 §미확인 항목)
 * 앱 톤에 맞춘 최소 UI만 둔다 — 빈 검은 화면으로 남기지 않는 것이 목적이다.
 */
function PermissionFallback({ message, onRequestPermission, onBack }: { message: string; onRequestPermission?: () => void; onBack: () => void }) {
  return (
    <View style={styles.permissionFallback}>
      <Text style={styles.permissionFallbackTitle}>카메라를 사용할 수 없어요</Text>
      <Text style={styles.permissionFallbackDescription}>{message}</Text>
      {onRequestPermission && (
        <View style={styles.permissionFallbackButton}>
          <Button text="카메라 권한 허용하기" onPress={onRequestPermission} />
        </View>
      )}
      <View style={styles.permissionFallbackButton}>
        <Button type="outline" color="warm-neutral" text="뒤로 가기" onPress={onBack} />
      </View>
    </View>
  );
}

/**
 * 보물 하나. 디자인 Frame 566(가까운 보물) / Frame 567(먼 보물) —
 * 보물 이미지 아래에 순번 라벨이 붙고, 거리에 따라 이미지 크기·라벨 간격·라벨 타이포가 함께 달라진다.
 */
function TreasurePin({ treasure, placement, found, onPress }: { treasure: Treasure; placement: TreasurePlacement; found: boolean; onPress: () => void }) {
  return (
    <View
      // 아이콘 좌우 중앙이 screenX에 오도록 절반만큼 왼쪽으로 당긴다
      style={{
        position: 'absolute',
        left: placement.screenX - placement.iconSize / 2,
        top: placement.iconTop,
        alignItems: 'center',
      }}
    >
      {/* 이미 찾은 보물도 눌러야 한다(다른 메시지의 모달을 띄우는 것이 §9 요구사항).
          한 번 드러난 보물은 방위각이 어긋나도 흐려지거나 탭이 막히지 않는다 — clickable은
          아직 한 번도 못 본 보물(=화면에 그려지지도 않는다)에만 false로 남는 안전장치다 */}
      <Pressable disabled={!placement.clickable} onPress={onPress} hitSlop={8} accessibilityLabel={found ? `${treasure.treasureIndex}번째 보물(이미 찾음)` : `${treasure.treasureIndex}번째 보물`}>
        {/* 기본은 닫힌 에셋, 이미 찾은 보물은 열린 에셋 (prompt §9) */}
        <Image source={found ? treasure.openIcon : treasure.closedIcon} style={{ width: placement.iconSize, height: placement.iconSize }} resizeMode="contain" />
      </Pressable>
      <View style={[styles.pinLabel, { marginTop: placement.labelGap }]}>
        <Text style={placement.labelSize === 'near' ? styles.pinLabelTextNear : styles.pinLabelTextFar}>{`${treasure.treasureIndex}번째 보물`}</Text>
      </View>
    </View>
  );
}

export function TreasureHuntCamera({ treasures, foundTreasureIndexes, totalCount, coords, heading, locationDenied, onSelectTreasure, onBack }: TreasureHuntCameraProps) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  // 아이콘을 화면 세로 중앙에 세우므로 높이도 함께 읽는다(geoPlacement의 centeredIconTop)
  const { width: screenWidthPx, height: screenHeightPx } = useWindowDimensions();

  /**
   * 이 화면에 들어온 뒤 한 번이라도 화면에 드러난 보물 번호.
   *
   * 보물은 한 번 보이면 카메라를 떠날 때까지 계속 보이고, 계속 누를 수 있다 — 기기를 조금만
   * 돌려도 사라지면 방금 본 보물을 잃어버린 것으로 읽히기 때문이다. 방위각을 벗어났다고 흐리게
   * 하거나 탭을 막지 않는다. 거리 규칙은 그대로다: 보물에서 1km를 벗어나면 화면(app/mission/
   * treasure.tsx의 shouldLeaveCamera)이 카메라 자체를 닫고 step1로 되돌린다.
   *
   * 상태로 두는 이유: 보물이 처음 드러나는 순간에만 바뀐다(장소당 최대 3번). 아래 배치 계산과
   * 달리 나침반 갱신을 따라다니지 않으므로 리렌더를 만들지 않는다.
   */
  const [seenTreasureIndexes, setSeenTreasureIndexes] = useState<number[]>([]);

  /**
   * 보물별 배치.
   *
   * **상태가 아니라 렌더에서 계산한다.** 예전에는 useEffect에서 계산해 setState했는데, 나침반이
   * 초당 수십 번 heading을 밀어 넣으므로 "effect가 상태를 바꾸고 → 다시 렌더되고 → 다시 effect"가
   * 끊임없이 이어졌다. React는 이런 연쇄가 50번 쌓이면 "Maximum update depth exceeded"로 끊는다.
   * 배치는 (보물, 좌표, heading, 화면 크기, 본 적 있는 보물)에서 나오는 순수한 파생값이라
   * 애초에 상태일 이유가 없다 — useMemo로 옮기면 그 연쇄 자체가 없어진다.
   *
   * 히스테리시스(resolveVisibilityWithHysteresis)의 "직전 프레임 값"으로는 seen 여부를 넘긴다.
   * 한 번 본 보물은 어차피 반경 안에서 계속 보이므로, 경계 깜빡임은 **처음 드러나기 전**에만
   * 문제가 되고 그 구간에서는 진입 임계값(FOV/2 - 12°)이 그대로 지켜진다.
   */
  const placements = useMemo(() => {
    const result: Record<number, TreasurePlacement> = {};

    // [테스트용] 위치·방위각을 무시하고 보물을 그대로 세운다(constants/treasureSpots.ts 주석 참고)
    if (TREASURE_DEV_ALWAYS_VISIBLE) {
      treasures.forEach((treasure, index) => {
        result[treasure.treasureIndex] = computeDevTreasurePlacement(index, treasures.length, screenWidthPx, screenHeightPx, treasure.treasureIndex);
      });
      return result;
    }

    if (!coords || !isValidHeading(heading)) return result;

    const computed = treasures.map((treasure) => {
      const hasBeenSeen = seenTreasureIndexes.includes(treasure.treasureIndex);
      const placement = computeTreasurePlacement({
        currentCoords: coords,
        treasureCoords: treasure.coords,
        deviceHeading: heading,
        wasVisible: hasBeenSeen,
        screenWidthPx,
        screenHeightPx,
        radiusMeters: TREASURE_DISCOVERY_RADIUS_METERS,
        // 보물마다 고정된 값이어야 세로 지터가 프레임마다 흔들리지 않는다(verticalJitter.ts)
        jitterSeed: treasure.treasureIndex,
      });
      if (!hasBeenSeen) return placement;

      // 한 번 드러난 보물은 **방위각을 보지 않는다**. 기기를 어디로 돌리든 계속 떠 있고,
      // 사라지는 조건은 반경을 벗어나는 것뿐이다 — 조준을 다시 맞추라고 요구하면 이미 찾은
      // 보물이 화면에서 깜빡이는 것처럼 보인다. 화면 밖으로 밀린 좌표는
      // separateTreasurePlacements가 화면 안으로 가둔다.
      return { ...placement, visible: placement.withinRadius, clickable: placement.withinRadius };
    });

    // 배치 계산은 보물 하나만 보므로 방위·거리가 비슷한 보물끼리 같은 자리에 겹친다.
    // 그리기 직전에 서로를 함께 보고 벌린다 — 시야를 벗어난 sticky 보물은 여기서 화면 안으로 가둔다.
    const separated = separateTreasurePlacements(computed, screenWidthPx);

    treasures.forEach((treasure, index) => {
      result[treasure.treasureIndex] = separated[index];
    });
    return result;
  }, [treasures, coords, heading, screenWidthPx, screenHeightPx, seenTreasureIndexes]);

  // 처음 드러난 보물을 기억한다. 여기서만 상태가 바뀌고, 한 보물당 한 번뿐이라 연쇄가 생기지 않는다.
  useEffect(() => {
    const newlySeen = treasures.map((treasure) => treasure.treasureIndex).filter((index) => placements[index]?.visible && !seenTreasureIndexes.includes(index));
    if (newlySeen.length === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenTreasureIndexes((previous) => [...previous, ...newlySeen.filter((index) => !previous.includes(index))]);
  }, [placements, treasures, seenTreasureIndexes]);

  // 화면에 실제로 그려진 보물 수. 배치가 없거나 visible=false면 세지 않는다
  const visibleTreasureCount = treasures.filter((treasure) => placements[treasure.treasureIndex]?.visible).length;
  // dev 배치는 좌표·나침반을 아예 쓰지 않으므로 결핍 안내를 띄우면 거짓말이 된다
  const guideMessage = TREASURE_DEV_ALWAYS_VISIBLE ? CAMERA_GUIDE_DEFAULT : resolveCameraGuide({ hasCoords: coords !== null, hasValidHeading: isValidHeading(heading), visibleTreasureCount });

  // 테스트 플래그가 켜져 있으면 위치를 아예 쓰지 않으므로 위치 권한 거부로 막지 않는다
  if (locationDenied && !TREASURE_DEV_ALWAYS_VISIBLE) {
    return <PermissionFallback message={'위치 권한을 허용해야 보물을 찾을 수 있어요.\n설정에서 위치 권한을 켜주세요.'} onBack={onBack} />;
  }

  if (!cameraPermission || !cameraPermission.granted) {
    // permission이 null이면 아직 확인 중이라 요청 버튼 없이 안내만 보여준다(빈 검은 화면 방지)
    return (
      <PermissionFallback
        message={cameraPermission ? '카메라 권한을 허용해야 보물찾기 화면을 사용할 수 있어요.' : '카메라 권한을 확인하고 있어요.'}
        onRequestPermission={cameraPermission ? requestCameraPermission : undefined}
        onBack={onBack}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {/* 카메라가 화면 전체를 채우고 그 위에 #000000@0.35 딤이 깔린다(확정 시안) */}
      <View style={styles.cameraArea}>
        <CameraView style={{ flex: 1 }} facing="back" />
        <View pointerEvents="none" style={styles.cameraDim} />
      </View>

      {treasures.map((treasure) => {
        const placement = placements[treasure.treasureIndex];
        if (!placement || !placement.visible) return null;
        const found = foundTreasureIndexes.includes(treasure.treasureIndex);
        return <TreasurePin key={treasure.treasureIndex} treasure={treasure} placement={placement} found={found} onPress={() => onSelectTreasure(treasure, found)} />;
      })}

      {/* BottomArea — 안내. 디자인 y=709(화면 아래에서 33).
          문구는 상태에 따라 달라진다 — 보물이 안 보이는 이유(좌표/나침반/방향)를 말해 주지 않으면
          카메라 영상만 남은 화면이 고장처럼 보인다(cameraGuide.ts) */}
      <View style={[styles.guidePillWrapper, { bottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) + 17 }]} pointerEvents="none">
        <View style={styles.guidePill}>
          <Image source={TREASURE_PLACE_GUIDE_ICON} style={styles.guidePillIcon} resizeMode="contain" />
          <Text style={styles.guidePillText}>{guideMessage}</Text>
        </View>
      </View>

      {/* Frame 530 — 진행도 카드. 카메라 위라 배경은 #000000@0.7 */}
      <View style={[styles.progressWrapper, { top: insets.top + CAMERA_HEADER_HEIGHT + CAMERA_PROGRESS_TOP_GAP }]}>
        <TreasureProgressCard foundCount={foundTreasureIndexes.length} totalCount={totalCount} backgroundColor="rgba(0, 0, 0, 0.7)" />
      </View>

      <View style={styles.headerWrapper}>
        <TreasureHeader onBack={onBack} />
      </View>
    </View>
  );
}
