import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TREASURE_PLACE_SUMMARY_MAX_LENGTH, TREASURE_TARGET_COUNT } from '@packages/shared';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { MissionCancelModal } from '@/components/Mission/MissionCancelModal/MissionCancelModal';
import { TreasureEnterSheet } from '@/components/Treasure/TreasureEnterSheet/TreasureEnterSheet';
import { TreasureHuntCamera } from '@/components/Treasure/TreasureHuntCamera/TreasureHuntCamera';
import { TreasureHuntMap } from '@/components/Treasure/TreasureHuntMap/TreasureHuntMap';
import { TreasureHuntPhoto } from '@/components/Treasure/TreasureHuntPhoto/TreasureHuntPhoto';
import { TreasureHeader } from '@/components/Treasure/TreasureHeader/TreasureHeader';
import { TreasurePlaceHeader } from '@/components/Treasure/TreasurePlaceHeader/TreasurePlaceHeader';
import { TreasurePlaceSummaryCard, TREASURE_PLACE_SUMMARY_BOTTOM_GAP, TREASURE_PLACE_SUMMARY_CARD_HEIGHT } from '@/components/Treasure/TreasurePlaceSummaryCard/TreasurePlaceSummaryCard';
import { TreasureProgressCard } from '@/components/Treasure/TreasureProgressCard/TreasureProgressCard';
import { TreasureRewardModal } from '@/components/Treasure/TreasureRewardModal/TreasureRewardModal';
import { MISSION_TYPE_INPUT, resolveMissionId } from '@/constants/missionHome';
import { useGetMissionHomeApiV1MissionsMissionTypeMissionIdGet } from '@/services/api/mission/mission';
import { Treasure, TREASURE_DEV_APPROACH_BEARING_DEG, TREASURE_DEV_APPROACH_DISTANCES, TREASURE_PLACE_FALLBACK, TREASURE_TYPE, toTreasures } from '@/constants/treasureHunt';
import type { TreasureRewardModalVariant } from '@/components/Treasure/TreasureRewardModal/rewardModalText';
import {
  mergeGrantedRewards,
  resolveTreasureLocationId,
  resolveTreasureProgressFailure,
  resolveTreasureRewardLabel,
  resolveTreasureStartOutcome,
  toFoundTreasureIndexes,
  toPlaceSummary,
  toTreasureSpots,
} from '@/constants/treasureMission';
import { useMissionCancelGuard } from '@/hooks/useMissionCancelGuard';
import { useTreasureDistanceToast } from '@/hooks/useTreasureDistanceToast';
import { useTreasureLocation } from '@/hooks/useTreasureLocation';
import {
  useSaveTreasureMissionProgressApiV1TreasureMissionsTreasureMissionProgressIdProgressPatch,
  useStartTreasureMissionApiV1TreasureMissionsTreasureMissionIdProgressPost,
  useStopTreasureMissionApiV1TreasureMissionsTreasureMissionProgressIdProgressStopPatch,
} from '@/services/api/treasure-mission/treasure-mission';
import { isJudgeModeEnabled, judgeModePosition, useJudgeModeStore } from '@/store/judgeMode';
import { useMissionCompleteStore } from '@/store/missionComplete';
import { useTreasureProgressStore } from '@/store/treasureProgress';
import { MIN_BOTTOM_INSET } from '@/styles/safeArea';
import { navigate } from '@/utils/navigate';
import { resolveApproachTarget } from '@/utils/treasureApproachSimulation';
import { resolveNearestTreasure, resolveSheetVisibility, shouldLeaveCamera } from '@/utils/treasureProximity';

/**
 * 보물찾기 플로우.
 *
 * step0(지도) / step2(카메라) / step3(촬영)를 라우트로 쪼개지 않고 한 라우트의 phase로 둔다.
 * 근거: docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §5
 * - 찾은 보물 목록이 한 곳의 상태로 살아 있어 params 직렬화가 필요 없다
 * - step2↔step3가 같은 카메라 세션을 유지해 프리뷰 암전·권한 재확인이 생기지 않는다
 *
 * 서버 연동(진행도 API):
 * - 진입 시 POST .../{treasureMissionId}/progress — 새로 만들면 201, 진행 중이면 200으로 같은 진행도를
 *   돌려준다. 상태 코드로는 둘을 구분하지 않지만 응답의 `missionProgressStatus`는 본다 —
 *   돌려받은 진행도가 이미 COMPLETED면 사냥 화면을 그리지 않고 인트로로 되돌린다(아래 effect).
 *   장소·보물 좌표·보물 개수·이미 찾은 보물이 전부 이 응답에서 온다.
 * - 보물을 하나 획득할 때마다 PATCH .../{progressId}/progress — 보상이 **한 개씩** 지급되고,
 *   마지막 보물에서 COMPLETED + 다음 장소가 온다.
 * - "포기 할래요"는 PATCH .../progress/stop — 중단도 완료 처리라 다음 장소가 온다.
 */
type TreasureHuntPhase = 'map' | 'camera' | 'photo';

/** NavigationHeader 높이. Penpot TreasureHunt_step0/1/2 공통(상태바 아래 56) */
const HEADER_HEIGHT = 56;

/**
 * Penpot TreasureHunt_step0의 헤더 스크림(Rectangle 64)이 상태바 아래로 덮는 높이.
 * 디자인 값 175는 iOS 상태바 44를 포함한 화면 기준이라, 실기기에서는 실제 inset에 이 값을 더한다.
 */
const HEADER_SCRIM_BELOW_STATUS_BAR = 175 - 44;

/**
 * 서버에 보낼 현재 좌표. 측위하지 못했으면 `null`이다.
 *
 * useTreasureLocation의 좌표를 쓰지 않는 이유: 그쪽은 심사위원용 모드에서 접근 시뮬레이션이 돌아
 * 보물 주변의 가짜 좌표를 흘려보낸다. 서버에 보내는 값은 보물 좌표를 뽑는 **기준점**이라,
 * 시뮬레이션이 다가가는 대상 자체가 그 좌표에서 나온다 — 섞으면 기준점이 매번 움직인다.
 *
 * **고정 좌표 폴백을 두지 않는다.** 예전에는 측위가 비면 제주 중심(33.3614, 126.5294)을
 * 대신 보냈는데, `getLastKnownPositionAsync()`는 캐시가 비어 있으면(앱을 막 켠 직후, 위치를
 * 방금 켠 직후) 곧바로 null을 준다 — 심사위원용 모드가 꺼져 있어도 그 고정 좌표가 그대로
 * 서버로 나갔다. 진행도 API의 latitude/longitude는 (1) 보물 좌표를 뽑는 기준점과 (2) 완료 후
 * 다음 장소까지의 거리라, 서귀포에 있는 사람의 보물이 제주 중심에 뿌려져 **걸어서 닿을 수 없는
 * 미션**이 된다. 캐시가 비면 실제로 측위하고(useCurrentCoordsOnce와 같은 순서·정확도),
 * 그마저 실패하면 지어낸 좌표를 보내는 대신 null을 돌려 호출부가 판단하게 한다.
 */
async function readCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  // 심사위원용 모드면 측위하지 않고 제주시청을 보낸다. 서버는 이 좌표로 완료 후 '근처 장소'를
  // 고르므로, 제주 밖 실제 좌표를 보내면 추천이 비거나 거리가 수백 km로 찍힌다.
  // 이 분기 하나가 고정 좌표를 쓰는 **유일한** 경로다.
  if (isJudgeModeEnabled()) return judgeModePosition();

  try {
    // 캐시가 있으면 그대로 쓴다 — GPS 측위는 실외에서도 몇 초가 걸린다
    const last = await Location.getLastKnownPositionAsync();
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };

    // 캐시가 없을 때만 실제로 측위한다. 기준점은 수십 m 오차로 뒤집히지 않으므로 Balanced면 충분하다
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: current.coords.latitude, longitude: current.coords.longitude };
  } catch {
    // 권한 거부·측위 실패. 호출부가 좌표 없는 상태를 처리한다
    return null;
  }
}

export default function TreasureHuntScreen() {
  const insets = useSafeAreaInsets();
  const { missionId: rawMissionId, start } = useLocalSearchParams<{ missionId?: string; start?: string }>();
  const treasureMissionId = resolveMissionId(rawMissionId, 'treasure');

  /**
   * 사진만 찍으러 들어왔는지(`?start=photo`).
   *
   * 이미 미션을 끝낸 뒤의 "보물이랑 사진찍기"가 이 경로로 들어온다 — 다시 찾을 보물이 없으니
   * 지도부터 보여 줄 이유가 없고, 사용자 지시도 **누르면 곧바로 촬영 화면**이다.
   * 이 모드에서는 촬영을 마치거나 뒤로 나가면 카메라 단계로 가지 않고 화면을 떠난다 —
   * 여기서 카메라(step2)는 "보물을 찾는 화면"이라 사진만 찍으러 온 사람에게는 갈 곳이 아니다.
   */
  const photoOnly = start === 'photo';

  const [phase, setPhase] = useState<TreasureHuntPhase>('map');
  /** 획득 모달에 띄운 보물. null이면 모달이 닫힌 상태 */
  const [selectedTreasure, setSelectedTreasure] = useState<Treasure | null>(null);
  /** 선택한 보물이 이미 찾은 것인지 — 모달 문구가 갈린다(prompt §9) */
  const [isSelectedFound, setIsSelectedFound] = useState(false);
  /** 촬영 화면이 다루는 캐릭터 보물 */
  const [photoTreasure, setPhotoTreasure] = useState<Treasure | null>(null);

  /**
   * 사진만 찍으러 들어온 경우의 퇴장. 왔던 화면(미션 인트로)으로 그대로 돌아간다.
   *
   * `cancelGuard`가 아래에서 참조하므로 상태 선언 바로 뒤에 둔다.
   */
  const leavePhotoOnly = useCallback(() => {
    setPhotoTreasure(null);
    navigate.back();
  }, []);

  /**
   * 촬영 화면에 쓸 AR 캐릭터(이름·이미지).
   *
   * 지급 응답(grantedReward)에서 먼저 찾고, 없으면 미션 홈의 "남은 보상"에서 읽는다 —
   * 캐릭터는 촬영을 마쳐야 획득이라 촬영 시점에는 아직 지급 전이고, 그때 이름과 이미지를
   * 알 수 있는 곳은 미션 홈뿐이다. intro가 같은 쿼리를 이미 불러 뒀으므로 대개 캐시에서 온다.
   */
  const { data: missionHome } = useGetMissionHomeApiV1MissionsMissionTypeMissionIdGet(MISSION_TYPE_INPUT.treasure, treasureMissionId);
  const grantedArCharacter = useTreasureProgressStore((state) => state.grantedReward?.arCharacter ?? null);
  const arCharacter = grantedArCharacter ?? missionHome?.remainingReward?.arCharacter ?? null;
  /**
   * 장소 소개 카드가 실제로 차지한 높이(px). 거리 안내 토스트가 이 카드 바로 위에 서는 데 쓴다.
   * 카드가 onLayout으로 알려 준다 — 문구가 두 줄이 되면 상수(minHeight 74)보다 높아진다.
   */
  const [summaryCardHeight, setSummaryCardHeight] = useState(TREASURE_PLACE_SUMMARY_CARD_HEIGHT);
  /** step1 시트가 열려 있는지. 500m 진입 / 1km 이탈로 갈린다 */
  const [isEnterSheetVisible, setIsEnterSheetVisible] = useState(false);
  /**
   * 시트를 손으로 끌어내려 닫았는지.
   *
   * 반경 판정과 따로 두는 이유: 반경 안에서 닫으면 거리 조건은 여전히 참이라, 이 값이 없으면
   * 다음 위치 갱신에 시트가 곧바로 다시 올라온다. 다시 열려면 지도의 보물 마커를 누른다.
   */
  const [isSheetDismissed, setIsSheetDismissed] = useState(false);

  const progressId = useTreasureProgressStore((state) => state.progressId);
  const treasureCount = useTreasureProgressStore((state) => state.treasureCount);
  const foundTreasureIndexes = useTreasureProgressStore((state) => state.foundTreasureIndexes);
  const syncStarted = useTreasureProgressStore((state) => state.syncStarted);
  const syncSaved = useTreasureProgressStore((state) => state.syncSaved);
  const markFoundLocally = useTreasureProgressStore((state) => state.markFoundLocally);
  const markComplete = useTreasureProgressStore((state) => state.markComplete);

  // 완료 화면은 보상·다음 장소를 조회할 API가 없다. 미션을 끝내는 응답을 그대로 넘겨준다
  const saveCompleteResult = useMissionCompleteStore((state) => state.save);
  const clearCompleteResult = useMissionCompleteStore((state) => state.clear);

  // 진입 시 1회만 진행도를 만든다(이미 진행 중이면 서버가 기존 것을 돌려준다).
  const { mutate: startMission, data: started, isPending: isStarting, isError: hasStartFailed } = useStartTreasureMissionApiV1TreasureMissionsTreasureMissionIdProgressPost();
  const saveProgress = useSaveTreasureMissionProgressApiV1TreasureMissionsTreasureMissionProgressIdProgressPatch();
  const stopProgress = useStopTreasureMissionApiV1TreasureMissionsTreasureMissionProgressIdProgressStopPatch();

  /**
   * 측위에 실패해 시작 요청을 보내지 못했는지.
   *
   * 보물 좌표는 이 좌표를 기준으로 뽑히므로 아무 값이나 넣어 보내면 **닿을 수 없는 곳에**
   * 보물이 생긴다. 요청을 보내지 않고 시작 실패와 같은 자리에 안내만 띄운다.
   */
  const [hasLocationFailed, setHasLocationFailed] = useState(false);

  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void (async () => {
      // 보물 좌표는 이 좌표를 기준으로 서버가 뽑는다 — 시작 요청 전에 측위를 한 번 기다린다
      const coords = await readCoordinates();
      if (!coords) {
        setHasLocationFailed(true);
        return;
      }
      startMission({ treasureMissionId, params: coords });
    })();
  }, [treasureMissionId, startMission]);

  // 시작 응답이 오면 스토어를 서버 값으로 맞춘다. 이어하기면 isFound가 켜진 보물이 섞여 온다.
  // 응답이 온 순간 한 번만 반영한다 — 이후 진행(진행도 저장 응답)을 덮어쓰면 안 된다.
  const syncedProgressId = useRef<number | null>(null);
  useEffect(() => {
    if (!started || syncedProgressId.current === started.treasureMissionProgressId) return;
    syncedProgressId.current = started.treasureMissionProgressId;
    syncStarted(started.treasureMissionProgressId, started.treasureCount, toFoundTreasureIndexes(started.treasureItems));
  }, [started, syncStarted]);

  /**
   * 서버가 **이미 끝난 진행도**를 돌려줬으면 사냥 화면을 그리지 않고 인트로로 되돌린다.
   *
   * 시작 응답에는 `missionProgressStatus`가 들어 있는데(TreasureMissionStartResponse) 예전에는
   * 이 값을 한 번도 읽지 않고 `treasureItems`의 `isFound`만 복원했다. 그래서 끝난 진행도로
   * 들어오면 — 홈의 "진행중인 미션" 카드는 인트로의 완료 판정(isRewardExhausted)을 거치지 않고
   * 이 화면으로 바로 온다 — 진행 중인 것처럼 보이는 화면이 그려졌다.
   * - 셋 다 찾은 진행도: 남은 보물이 없어 진입 시트가 뜨지 않는다. 3/3 지도에 갇힌다.
   * - 중단("포기 할래요")으로 끝난 진행도: 찾은 보물이 3개가 아니라 시트가 뜬다. 실제로 그 보물까지
   *   걸어가 눌러야 PATCH가 404로 떨어지고, 그제야 보상 없는 완료 화면으로 밀려난다.
   *
   * 인트로로 보내는 이유: 완료 화면(`/mission/complete`)은 이 회차에 방금 받은 보상과 다음 장소를
   * 보여주는 자리인데 시작 응답에는 둘 다 없다. 인트로는 서버(미션 홈의 남은 보상)로 완료를 다시
   * 판정해 완료 시각·쿠폰·근처 미션이 있는 "이미 완료한 미션" 화면을 그린다 —
   * 이탈 모달의 "잠깐 쉴게요"가 가는 곳과 같다.
   *
   * `?start=photo`는 예외다. 그 경로 자체가 끝낸 미션에 사진만 찍으러 들어오는 길이라
   * COMPLETED가 정상이다(판정은 constants/treasureMission.ts의 resolveTreasureStartOutcome).
   */
  useEffect(() => {
    if (!started || resolveTreasureStartOutcome(started.missionProgressStatus, photoOnly) !== 'already-complete') return;

    navigate.replace({ pathname: '/mission/intro', params: { mission: 'treasure', missionId: String(treasureMissionId) } });
  }, [started, photoOnly, treasureMissionId]);

  /** 서버가 준 보물 목록 + 화면 에셋 */
  const treasures = useMemo(() => toTreasures(toTreasureSpots(started?.treasureItems ?? [])), [started]);

  /**
   * 접근 시뮬레이션이 다가갈 보물.
   *
   * 좌표가 진행도마다 새로 뽑히므로 상수로 못 박을 수 없다 — 응답을 받은 뒤에 "끝까지 가장 가까운
   * 보물로 남는" 후보를 골라 위치 훅에 넘긴다(utils/treasureApproachSimulation.ts).
   * 심사위원용 모드가 꺼져 있으면 시뮬레이션 자체가 돌지 않으므로 계산할 이유가 없어 null이다.
   */
  const isApproachSimulated = useJudgeModeStore((state) => state.enabled);
  const approachTarget = useMemo(() => {
    if (!isApproachSimulated) return null;
    return resolveApproachTarget(treasures, TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_BEARING_DEG)?.coords ?? null;
  }, [isApproachSimulated, treasures]);

  const { coords, heading, permissionDenied } = useTreasureLocation(approachTarget);

  // 헤더·진행도 분모는 서버 값이다. 시작 응답 전에는 목표 개수(3)로 받쳐 "0/0"이 보이지 않게 한다
  const totalCount = treasureCount > 0 ? treasureCount : TREASURE_TARGET_COUNT;
  const placeName = started?.location.locationTitle ?? TREASURE_PLACE_FALLBACK.name;

  /**
   * 장소 id. 장소 한 줄 소개와 "장소 상세보기"가 둘 다 이 값을 필요로 한다
   * (없는 서버에서는 null이고, 그때는 둘 다 감춘다 — constants/treasureMission.ts 주석 참고).
   */
  const locationId = started ? resolveTreasureLocationId(started.location) : null;

  /**
   * 장소 한 줄 소개. 시작 응답의 location.locationDescription을 그대로 쓴다.
   *
   * 예전에는 /map/locations/{id}를 한 번 더 불러 설명만 꺼내 썼다. 그 조회는 좌표를 요구해서
   * GPS를 기다리거나 제주 중심을 대신 넣어야 했고, 소개 한 줄을 위해 왕복이 하나 더 늘었다.
   * 이제 시작 응답이 설명을 함께 내려주므로(TreasureMissionLocationResponse) 그걸 읽는다.
   *
   * 설명이 없으면 null이고 카드를 그리지 않는다 — 예전 폴백 문구 "보물 세 개가 숨어 있어요"는
   * 장소 설명이 아니라 보물 개수 얘기라 진행도 카드(n/3)와 중복이었다. 없는 소개를 지어내지 않는다.
   */
  const placeSummary = toPlaceSummary(started?.location.locationDescription, TREASURE_PLACE_SUMMARY_MAX_LENGTH);

  // 매 렌더 새 객체로 만들면 TreasureHuntMap의 마커 전송 effect가 매 렌더 다시 돈다 —
  // heading이 초당 수십 번 갱신되는 화면이라 그만큼 WebView로 postMessage가 쏟아졌다.
  const mapCenter = useMemo(() => (started ? { latitude: started.location.lat, longitude: started.location.lng } : null), [started]);

  // step0(지도)에서의 뒤로가기만 미션을 떠나는 것이다. 카메라·촬영에서의 백은 이전 단계로 돌아가므로
  // 확인 모달을 띄우지 않고 화면이 직접 처리한다.
  const cancelGuard = useMissionCancelGuard({
    onHardwareBack: () => {
      // 사진만 찍으러 들어왔으면 이 화면에 단계가 하나뿐이다 — 뒤로가기가 곧 퇴장이고,
      // 미션을 중단하는 것이 아니므로 이탈 확인 모달도 띄우지 않는다
      if (photoOnly) {
        leavePhotoOnly();
        return true;
      }

      if (phase === 'photo') {
        setPhotoTreasure(null);
        setPhase('camera');
        return true;
      }
      if (phase === 'camera') {
        setPhase('map');
        return true;
      }
      return false;
    },
  });

  /** 아직 못 찾은 보물 — 반경 판정은 "다음에 찾을 보물"만 대상으로 한다 */
  const remainingTreasures = useMemo(() => treasures.filter((treasure) => !foundTreasureIndexes.includes(treasure.treasureIndex)), [treasures, foundTreasureIndexes]);

  const nearest = useMemo(() => resolveNearestTreasure(coords, remainingTreasures), [coords, remainingTreasures]);
  const nearestDistance = nearest?.distanceMeters ?? null;

  // 시트가 실제로 떠 있는지. 반경 조건과 "닫아 뒀는지"를 함께 본다.
  // 같은 자리를 쓰는 거리 안내 토스트를 이 값으로 끈다(장소 한 줄 소개 카드는 시트가 덮는다).
  const isSheetOpen = isEnterSheetVisible && !isSheetDismissed;

  // 지도에 그릴 마커. 이미 찾은 보물도 열린 에셋으로 계속 보여준다
  const mapMarkers = useMemo(
    () =>
      treasures.map((treasure) => ({
        treasureIndex: treasure.treasureIndex,
        coords: treasure.coords,
        found: foundTreasureIndexes.includes(treasure.treasureIndex),
      })),
    [treasures, foundTreasureIndexes],
  );

  // 거리 안내 토스트는 지도 화면에서만 띄운다 — 카메라·촬영 중에 화면을 가리지 않는다
  // 시트가 떠 있는 동안에는 토스트를 띄우지 않는다.
  //
  // "반경 밖에서만 토스트"만으로는 부족하다 — resolveSheetVisibility가 진입 500m / 유지 1km
  // 히스테리시스를 쓰기 때문에, 500m로 들어가 시트를 띄운 뒤 700m로 물러나면 시트는 열린 채
  // 거리 조건은 "밖"이 되어 둘이 같은 화면에 겹친다. 시트가 곧 그 안내를 대신하므로 끈다.
  useTreasureDistanceToast(nearestDistance, !photoOnly && phase === 'map' && !isSheetOpen, placeSummary === null ? null : summaryCardHeight);

  // 500m 진입 시 열고, 1km를 벗어나면 닫는다(prompt §9).
  // 이 setState는 위치 구독(외부 시스템)이 밀어주는 값을 화면 상태로 편입하는 동작이라
  // "effect가 effect를 유발하는 연쇄"가 아니다 — TreasureHuntCamera의 배치 계산과 같은 구조다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsEnterSheetVisible((wasVisible) => resolveSheetVisibility(nearestDistance, wasVisible));
  }, [nearestDistance]);

  // 반경을 벗어나면 "닫아 둔" 기억을 지운다 — 다시 들어오면 시트가 새로 올라와야 한다
  useEffect(() => {
    if (isEnterSheetVisible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSheetDismissed(false);
  }, [isEnterSheetVisible]);

  // 카메라 화면에서 1km를 벗어나면 지도로 되돌린다(prompt §9)
  useEffect(() => {
    if (phase !== 'camera') return;
    if (!shouldLeaveCamera(nearestDistance)) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase('map');
    setSelectedTreasure(null);
  }, [phase, nearestDistance]);

  /** 지금까지 누적된 보상을 들고 완료 화면으로 넘긴다 */
  const goToComplete = useCallback(
    (reward: Parameters<typeof saveCompleteResult>[1]['reward'], nextLocation: Parameters<typeof saveCompleteResult>[1]['nextLocation']) => {
      markComplete(new Date().toISOString());
      // completedLocationId — 완료 화면의 "방명록 남기기"가 이 장소에 글을 붙인다.
      // 서버 완료 응답에는 없는 값이고, 진행도 생성 응답(started.location)을 받은 이 화면만
      // 알고 있어서 여기서 실어 보낸다. 없으면 방명록이 좌표만 가진 형태로 열린다.
      saveCompleteResult('treasure', { reward, nextLocation, completedLocationId: locationId });
      // replace — 완료 화면에서 뒤로가기로 플로우에 되돌아오면 이미 다 찾은 상태라 갈 곳이 없다
      navigate.replace({ pathname: '/mission/complete', params: { mission: 'treasure' } });
    },
    [markComplete, saveCompleteResult, locationId],
  );

  /**
   * 마지막 보물까지 저장을 마친 뒤 들고 있는 완료 정보.
   *
   * 값이 차면 촬영 안내 모달("보물을 모두 찾았어요")이 뜨고, 인증샷을 마쳐야 완료 화면으로 넘어간다.
   * 저장 응답을 그대로 흘려보내지 않고 여기 담아 두는 이유가 그것이다 — 예전에는 COMPLETED를 받는
   * 즉시 완료 화면으로 갈아탔다.
   */
  const [completion, setCompletion] = useState<Parameters<typeof goToComplete> | null>(null);

  /**
   * 마지막 인증샷에 쓸 보물. 촬영 화면은 캐릭터 이미지를 서버에서 받지만, 로컬 폴백으로
   * treasure.characterImage를 쓰므로 캐릭터 보물을 우선 고른다.
   */
  const photoTargetTreasure = useMemo(() => treasures.find((treasure) => treasure.treasureType === TREASURE_TYPE.CHARACTER) ?? treasures[0] ?? null, [treasures]);

  /**
   * 지금 그릴 단계와 촬영 대상.
   *
   * `?start=photo`로 들어왔으면 지도를 거치지 않고 곧바로 촬영 화면이다(사용자 지시).
   * 이걸 effect의 `setPhase`가 아니라 **파생 값**으로 두는 이유: effect에서 동기적으로 setState하면
   * 렌더가 한 번 더 돌고(react-compiler가 오류로 잡는다), 그 한 프레임 동안 지도가 스쳐 지나간다.
   *
   * 보물이 정해지기 전까지는 평소 단계를 그대로 쓴다 — 촬영 화면은 캐릭터 폴백 이미지를 보물에서
   * 읽으므로 대상이 없으면 열 수 없고, 그 목록은 진행도 생성 응답이 와야 채워진다.
   *
   * 이 모드에서는 촬영을 마치거나 뒤로 나가면 화면 자체를 떠나므로(`leavePhotoOnly`)
   * 여기서 다른 단계로 돌아올 일이 없다.
   */
  const activePhase: TreasureHuntPhase = photoOnly && photoTargetTreasure !== null ? 'photo' : phase;
  const activePhotoTreasure = photoOnly ? photoTargetTreasure : photoTreasure;

  /**
   * 획득 확정 — 서버에 보물 번호를 저장한다.
   *
   * 보상은 이 응답들에 **하나씩 나뉘어** 온다(AR 캐릭터 → 포인트 → 쿠폰). 그래서 마지막 응답의
   * reward만 완료 화면에 넘기면 보상이 한 줄만 보인다. 스토어가 회차 내내 누적한 값을 넘긴다
   * (constants/treasureMission.ts의 mergeGrantedRewards).
   */
  const collectTreasure = useCallback(
    async (treasure: Treasure) => {
      // 시작 응답을 못 받았으면 저장할 진행도가 없다. 화면에는 이미 안내가 떠 있다.
      if (progressId === null) return;

      const coords = await readCoordinates();
      // 좌표를 못 읽었으면 저장을 보내지 않는다 — 지어낸 기준점으로 저장하면 완료 후 '다음 장소'
      // 거리가 엉뚱해진다. 반경 500m 안에서만 여기까지 오므로(=이미 fix가 있다) 실제로는
      // 거의 닿지 않는 갈래이고, 못 찾은 상태로 두면 다시 탭하는 것이 곧 재시도다.
      if (!coords) {
        console.error('[treasure] 좌표를 읽지 못해 진행도 저장을 보내지 않았다');
        return;
      }

      try {
        const result = await saveProgress.mutateAsync({
          treasureMissionProgressId: progressId,
          data: { treasureIndex: treasure.treasureIndex },
          params: coords,
        });

        const accumulatedReward = syncSaved(result.foundTreasureIndexes, result.reward);

        if (result.missionProgressStatus === 'COMPLETED') {
          // 완료 응답에서만 nextLocation이 채워져 온다(진행 중에는 null).
          // 바로 완료 화면으로 보내지 않는다 — 마지막 보물의 "보상 확인" 다음에 촬영 안내 모달이
          // 한 번 더 뜨고(Penpot `Container` 보드), 그 인증샷까지 마쳐야 완료 화면으로 넘어간다.
          setCompletion([accumulatedReward, result.nextLocation ?? null]);
        }
      } catch (error) {
        const failure = resolveTreasureProgressFailure(error);

        // 서버는 이미 찾은 것으로 알고 있다(409). 목록만 맞추고 남은 보물을 계속 찾게 둔다.
        if (failure === 'already-found') {
          markFoundLocally(treasure.treasureIndex);
          return;
        }

        // 이어갈 진행도가 없다(404) — 다른 기기에서 끝났거나 이미 완료된 진행도다.
        // 보상은 보물을 찾을 때마다 이미 지급됐으니 누적값을 들고 완료 화면으로 내보낸다.
        // (culture.tsx의 abandonMission이 중단 실패를 삼키고 나가는 것과 같은 태도 —
        //  어떤 실패에도 사용자를 이 화면에 붙잡아 두지 않는다)
        if (failure === 'progress-gone') {
          goToComplete(mergeGrantedRewards(useTreasureProgressStore.getState().grantedReward, null), null);
          return;
        }

        // 원인 불명(네트워크 등)은 그 보물을 못 찾은 상태로 남긴다 — 다시 탭하면 재시도가 된다
        console.error('[treasure] 진행도 저장 실패', error);
      }
    },
    [progressId, saveProgress, syncSaved, markFoundLocally, goToComplete],
  );

  /**
   * "포기 할래요" — 서버는 중단을 완료로 처리한다.
   *
   * 지금까지 찾은 보물의 보상은 이미 지급된 상태이고 다음 장소도 내려오므로, 인트로로 되돌리지 않고
   * 완료 화면으로 보낸다. 중단 응답에는 reward가 없다 — 보상은 보물별로 이미 지급됐기 때문이라
   * 스토어의 누적값을 그대로 쓴다. 진행도가 없는 경우(404)에도 화면은 빠져나가야 한다.
   */
  const abandonMission = useCallback(async () => {
    // 중단 응답을 받지 못하면 완료 화면이 직전 미션의 값을 보여주지 않도록 비워 둔다
    clearCompleteResult();

    // 하나도 못 찾았으면 누적값이 null이다. 그대로 넘기면 완료 화면이 "아직 모른다"로 보고
    // 디자인 폴백 보상 행을 그리므로, 받지 않은 보상을 받은 것처럼 보여주게 된다.
    // 병합 결과는 항상 객체라서 "아무것도 못 받았다"가 그대로 전달된다.
    const accumulatedReward = mergeGrantedRewards(useTreasureProgressStore.getState().grantedReward, null);

    const coords = progressId === null ? null : await readCoordinates();
    // 좌표가 없으면 중단 요청도 보내지 않는다. 지어낸 좌표로 보내면 완료 화면의 '다음 장소'가
    // 있지도 않은 곳 기준으로 뽑힌다 — 요청 실패와 같은 취급으로 화면만 빠져나간다.
    if (progressId !== null && coords) {
      try {
        const stopped = await stopProgress.mutateAsync({ treasureMissionProgressId: progressId, params: coords });
        goToComplete(accumulatedReward, stopped.nextLocation);
        return;
      } catch {
        // 중단 요청이 실패해도 사용자를 화면에 붙잡아 둘 이유는 없다
      }
    }
    goToComplete(accumulatedReward, null);
  }, [clearCompleteResult, progressId, stopProgress, goToComplete]);

  const handleSelectTreasure = useCallback((treasure: Treasure, alreadyFound: boolean) => {
    setSelectedTreasure(treasure);
    setIsSelectedFound(alreadyFound);
  }, []);

  /**
   * 보물을 눌렀을 때 뜨는 모달의 상태.
   *
   * 마지막 보물도 여기서는 여느 보물과 똑같이 "N번째 보물을 찾았어요 / 보상 확인"이다.
   * '모두 찾았어요'는 그 확인을 누른 **뒤에** 별도 모달로 뜬다(completion).
   */
  const modalVariant: TreasureRewardModalVariant = isSelectedFound ? 'already-found' : 'found';

  /**
   * 설명 문구에 들어갈 보상 이름.
   *
   * 지급 전이라 grantedReward는 아직 비어 있다. 미션 홈의 remainingReward가 이름·금액을 이미
   * 들고 있어 그쪽을 읽는다(촬영 화면이 캐릭터 이름을 얻는 경로와 같다).
   */
  const selectedRewardLabel = resolveTreasureRewardLabel(selectedTreasure?.treasureType ?? null, missionHome?.remainingReward ?? null);

  const handleModalConfirm = useCallback(() => {
    const treasure = selectedTreasure;
    if (!treasure) return;

    setSelectedTreasure(null);
    void collectTreasure(treasure);
  }, [selectedTreasure, collectTreasure]);

  /** "보물이와 사진 찍기" — 마지막 인증샷을 찍으러 step3로 간다 */
  const handleStartFinalPhoto = useCallback(() => {
    if (photoTargetTreasure === null) return;
    setPhotoTreasure(photoTargetTreasure);
    setPhase('photo');
  }, [photoTargetTreasure]);

  /**
   * 촬영 안내 모달을 닫았다 — 인증샷 없이 완료로 보낸다.
   *
   * 보물 저장은 이미 끝났고 보상도 지급됐다. 여기서 모달만 닫으면 다 찾은 카메라 화면에
   * 할 일 없이 남게 되므로, 닫기도 완료 화면으로 나가는 길로 둔다.
   */
  const handleSkipFinalPhoto = useCallback(() => {
    if (completion === null) return;
    goToComplete(...completion);
  }, [completion, goToComplete]);

  const handleCaptured = useCallback(() => {
    if (photoOnly) {
      leavePhotoOnly();
      return;
    }

    setPhotoTreasure(null);

    // 보물 저장은 "보상 확인"에서 이미 끝났다. 촬영은 그 뒤에 붙는 마지막 인증샷이라
    // 여기서는 저장을 다시 보내지 않고 들고 있던 완료 정보로 완료 화면에 넘긴다.
    if (completion !== null) {
      goToComplete(...completion);
      return;
    }
    setPhase('camera');
  }, [photoOnly, leavePhotoOnly, completion, goToComplete]);

  if (activePhase === 'photo' && activePhotoTreasure) {
    return (
      <FullBleed>
        <TreasureHuntPhoto
          treasure={activePhotoTreasure}
          characterId={arCharacter?.id ?? null}
          characterName={arCharacter?.name ?? null}
          characterImageUrl={arCharacter?.imageUrl ?? null}
          foundCount={foundTreasureIndexes.length}
          totalCount={totalCount}
          // 완료 후 사진만 찍으러 들어온 경우에는 진행할 단계가 없다 — 진행도 카드를 숨긴다(사용자 지시)
          showProgress={!photoOnly}
          onCaptured={handleCaptured}
          onBack={
            photoOnly
              ? leavePhotoOnly
              : () => {
                  setPhotoTreasure(null);
                  setPhase('camera');
                }
          }
        />
      </FullBleed>
    );
  }

  if (activePhase === 'camera') {
    return (
      <FullBleed>
        <TreasureHuntCamera
          treasures={treasures}
          foundTreasureIndexes={foundTreasureIndexes}
          totalCount={totalCount}
          coords={coords}
          heading={heading}
          locationDenied={permissionDenied}
          onSelectTreasure={handleSelectTreasure}
          onBack={() => setPhase('map')}
        />
        <TreasureRewardModal treasure={selectedTreasure} variant={modalVariant} rewardLabel={selectedRewardLabel} onConfirm={handleModalConfirm} onClose={() => setSelectedTreasure(null)} />

        {/* 마지막 보물의 "보상 확인" 다음에 뜨는 촬영 안내. 'all-found' 문구는 보상 이름을 쓰지 않는다 */}
        <TreasureRewardModal treasure={completion === null ? null : photoTargetTreasure} variant="all-found" rewardLabel="" onConfirm={handleStartFinalPhoto} onClose={handleSkipFinalPhoto} />
      </FullBleed>
    );
  }

  // step0 — 지도는 web을 WebView로 재사용하고 헤더·카드·시트만 네이티브로 얹는다(문서 §4).
  //
  // Penpot TreasureHunt_step0은 MapBackground가 360x800 전체를 채우고 그 위에 헤더 스크림
  // (Rectangle 64)과 카드들이 떠 있는 구조다. 그래서 지도를 헤더/카드 사이에 끼워 넣지 않고
  // 화면 전체에 깔고, 나머지를 absolute로 얹는다.
  return (
    <FullBleed style={{ backgroundColor: '#ffffff' }}>
      {/* 마커를 누르면 끌어내려 닫은 시트가 다시 올라온다. 반경 밖이면 거리 조건이 거짓이라
          이 탭만으로는 열리지 않는다 — "해당 반경에 들어왔으면"이라는 조건이 그대로 유지된다 */}
      <TreasureHuntMap coords={coords} heading={heading} markers={mapMarkers} center={mapCenter} onTreasurePress={() => setIsSheetDismissed(false)} />

      {/* Rectangle 64 — 상태바·헤더·장소명 뒤에 깔리는 스크림.
          #a0d2e6 0.94가 위쪽을 채우고 44% 지점부터 아래로 투명해진다(디자인 그라디언트 그대로) */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(160, 210, 230, 0.94)', 'rgba(160, 210, 230, 0.94)', 'rgba(160, 210, 230, 0)']}
        locations={[0, 0.44, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + HEADER_SCRIM_BELOW_STATUS_BAR }}
      />

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
        {/* 지도 화면은 뒤로가기에 원 배경이 없다(카메라·촬영과 다르다) */}
        <TreasureHeader onBack={cancelGuard.requestExit} backVariant="plain" />
      </View>

      {/* Frame 538(장소명 + 장소 상세보기) → Frame 530(진행도). 디자인 y=100 / y=155 */}
      <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + HEADER_HEIGHT, gap: 25 }}>
        {/* "장소 상세보기" 배지는 장소 id가 있을 때만 그린다(onDetailPress를 넘기지 않으면 헤더가 뺀다).
            배포 서버는 locationId를 required로 주므로 배포 API를 보면 켜진다. 로컬 서버가
            뒤처져 있으면 id가 없어 안 보인다 — 읽는 쪽은 constants/treasureMission.ts의
            resolveTreasureLocationId */}
        <TreasurePlaceHeader
          placeName={placeName}
          // 장소 상세는 web에 있고 앱은 /place가 WebView로 띄운다(완료 화면 장소 카드와 같은 경로)
          onDetailPress={locationId === null ? undefined : () => navigate.push({ pathname: '/place', params: { placeId: String(locationId) } })}
        />
        <TreasureProgressCard foundCount={foundTreasureIndexes.length} totalCount={totalCount} backgroundColor="#111111" />
      </View>

      {/* 진행도를 만드는 동안·실패했을 때의 안내. 지도와 헤더는 그대로 보여주고 이 자리에만 상태를 띄운다 —
          보물 마커가 없는 지도만 남겨 두면 "미션이 비어 있다"로 읽힌다 */}
      {(isStarting || ((hasStartFailed || hasLocationFailed) && treasures.length === 0)) && (
        <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + HEADER_HEIGHT + 150, alignItems: 'center' }}>
          {isStarting ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: '#ffffff', fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 22, textAlign: 'center' }}>
              {/* 측위 실패는 "잠시 후"가 아니라 위치를 켜야 풀리는 문제라 문구를 따로 둔다 */}
              {hasLocationFailed ? '현재 위치를 확인하지 못했어요.\n위치를 켠 뒤 다시 들어와주세요.' : '보물 정보를 불러오지 못했어요.\n잠시 후 다시 시도해주세요.'}
            </Text>
          )}
        </View>
      )}

      {/* Frame 539 — 장소 한 줄 소개. 디자인 y=703(화면 아래에서 97).
          시트가 올라와도 계속 그린다. 예전에는 시트가 뜨는 동안 언마운트했는데, 시트가 500m 경계에서
          열리고 닫히기를 반복하면 카드가 함께 사라졌다 나타나 깜빡였다 — 시트는 이 카드 위를 덮는
          레이어이므로 겹침은 순서로 해결하면 된다(시트를 아래 JSX에서 뒤에 그린다).
          거리 안내 토스트만 시트가 떠 있는 동안 끈다(useTreasureDistanceToast의 enabled).
          아래 여백은 거리 토스트가 이 카드를 비켜 가는 계산과 같은 상수를 쓴다(useTreasureDistanceToast) */}
      {placeSummary !== null && (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) + TREASURE_PLACE_SUMMARY_BOTTOM_GAP,
          }}
        >
          <TreasurePlaceSummaryCard summary={placeSummary} onHeightChange={setSummaryCardHeight} />
        </View>
      )}

      {/* step1 시트 — 반경 500m 진입 시 올라온다. 남은 보물이 없으면 띄울 것도 없다 */}
      {nearest && (
        <TreasureEnterSheet
          visible={isSheetOpen}
          treasureOrder={nearest.treasure.treasureIndex}
          image={nearest.treasure.closedIcon}
          // 아래 장소 소개 카드는 이 시트가 덮으므로 같은 문구를 시트 안에서 이어 보여 준다
          placeSummary={placeSummary}
          onOpenCamera={() => setPhase('camera')}
          onDismiss={() => setIsSheetDismissed(true)}
        />
      )}

      {/* 지도(step0)에서만 마운트한다 — 카메라·촬영의 백은 단계 되돌리기라 모달이 뜨지 않는다 */}
      <MissionCancelModal
        visible={cancelGuard.visible}
        // "잠깐 쉴게요" — 서버가 보물마다 진행도를 이미 저장해 뒀고, 다시 들어오면 시작 요청이
        // 같은 진행도(isFound 포함)를 돌려주므로 그대로 나가면 이어서 할 수 있다
        onPause={() => navigate.replace({ pathname: '/mission/intro', params: { mission: 'treasure', missionId: String(treasureMissionId) } })}
        // "포기 할래요" — 서버는 중단도 완료로 처리하고 다음 장소를 내려준다
        onAbandon={() => void abandonMission()}
        onClose={cancelGuard.dismiss}
      />
    </FullBleed>
  );
}
