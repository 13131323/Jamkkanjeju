import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CharacterPhotoCapture } from '@/components/CharacterPhotoCapture/CharacterPhotoCapture';
import { toReactNativeFilePart } from '@/components/CharacterPhotoCapture/reactNativeFilePart';
import { CoopStepLayout } from '@/components/Coop/CoopStepLayout/CoopStepLayout';
import { PhotoGuideSheet } from '@/components/Coop/PhotoGuideSheet/PhotoGuideSheet';
import { RoleCard } from '@/components/Coop/RoleCard/RoleCard';
import { RoleDetail } from '@/components/Coop/RoleDetail/RoleDetail';
import { RoleVerify } from '@/components/Coop/RoleVerify/RoleVerify';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { SkeletonBlock } from '@/components/SkeletonBlock/SkeletonBlock';
import { MissionCancelModal } from '@/components/Mission/MissionCancelModal/MissionCancelModal';
import { NavigationHeader } from '@/components/NavigationHeader/NavigationHeader';
import { useToast } from '@/components/Toast/Toast';
import { COOP_HOST_CHANGED_MESSAGE, COOP_STEP_COPY, coopLeftMessage } from '@/constants/coopMission';
import { rolePhotoGuide, roleVerifyHint } from '@/constants/coopRoleCopy';
import { useCoopMissionRoom } from '@/hooks/useCoopMission';
import { useCoopPartyChanges } from '@/hooks/useCoopPartyChanges';
import { useMissionCancelGuard } from '@/hooks/useMissionCancelGuard';
import { useCoopPartyStore } from '@/store/coopParty';
import { useMissionCompleteStore } from '@/store/missionComplete';
import { coopRolesStyles as styles } from '@/styles/coopRoles';
import { canCompleteCoopMission, findRoleCard, isRoleVerified, myRoleProgress, myRoleView, otherRoleProgresses, roleChips, toggleExpandedRoleCardId } from '@/utils/coopRole';
import { COOP_FAILURE_MESSAGE, coopFailureMessage } from '@/utils/coopFailure';
import { coopIntroRoute, coopScreenAdvance } from '@/utils/coopStep';
import { coopTrace } from '@/utils/coopTrace';
import { navigate } from '@/utils/navigate';
import { findHost } from '@/utils/party';

/**
 * 인증 성공 문구는 **남은 사람이 있는지에 따라 갈린다.**
 *
 * 마지막 한 명이 인증을 마쳤는데도 "팀원의 인증을 기다려요"가 뜨면, 이미 끝난 일을 더 기다리라는
 * 말이 되어 다음 버튼이 열린 이유와 어긋난다.
 */
const VERIFY_SUCCESS_WAITING_MESSAGE = '인증 성공! 팀원의 인증을 기다려요';
const VERIFY_SUCCESS_ALL_DONE_MESSAGE = '인증 성공! 모두 인증을 마쳤어요';
const VERIFY_FAILED_MESSAGE = '인증에 실패했어요. 다시 촬영해주세요';

/**
 * "나의 역할" 자리에 역할 대신 들어가는 안내.
 *
 * **문구는 하나뿐이다.** 예전에는 둘이었다 — 기다리면 채워지는 상태("역할 정보를 불러오는
 * 중이에요.")와 기다려도 바뀌지 않는 상태("아직 역할이 배정되지 않았어요.")를 갈랐다.
 * 앞의 것은 이제 **스켈레톤이 대신 말한다**(아래 `MyRoleSkeleton`) — 로딩을 문구와 자리표시
 * 두 방식으로 알리면 같은 상태가 두 번 보이고, 스켈레톤은 값이 왔을 때 레이아웃도 튀지 않는다.
 *
 * 남은 이 문구는 **배정이 끝났는데 그 안에 내가 없는** 경우만 가리킨다. 세 상태를 가르는 판정은
 * `myRoleView`에 있다(coopRole.ts) — 화면은 그 결과만 그린다.
 */
const MY_ROLE_MISSING_MESSAGE = '아직 역할이 배정되지 않았어요.';

/**
 * "나의 역할" 카드가 들어올 자리.
 *
 * **이 저장소의 자리표시 기제는 `SkeletonBlock` 하나뿐이다**(미션 인트로·완료·재진입 레이아웃과
 * RoleVerify의 사진 자리가 모두 이걸 쓴다). 새 애니메이션을 만들지 않고 그대로 따른다 —
 * 흰 시트 위라 색은 회색 계열이어야 보이고(#f6f5f4), 값이 오는 자리이므로 pulse는 기본값 그대로다.
 *
 * 크기는 접힌 역할 카드와 같다: 아바타 38 + 위아래 padding 12씩 = 62, radius 14
 * (components/Coop/RoleCard/styles.ts). 그래야 역할이 도착했을 때 목록이 튀지 않는다.
 */
const ROLE_CARD_SKELETON = { height: 62, radius: 14, color: '#f6f5f4' } as const;

function MyRoleSkeleton() {
  return <SkeletonBlock width="100%" height={ROLE_CARD_SKELETON.height} radius={ROLE_CARD_SKELETON.radius} color={ROLE_CARD_SKELETON.color} />;
}

/**
 * 협동 미션 재료 찾기(서버 3단계).
 *
 * Penpot `TogetherMission_step2` 보드. 내 역할과 팀원 역할은 모두 아코디언이며,
 * 내 역할만 사진을 업로드할 수 있고 팀원 역할의 인증 사진은 조회만 한다.
 * 팀원 전원이 인증을 마치면 "다음"이 열리고 완료 화면으로 넘어간다.
 *
 * 팀원 인증 상황은 방 상태 폴링(2초)이 알려준다 — 이 화면에는 폴링 코드가 없고
 * `useCoopMissionRoom`이 단계와 무관하게 한 곳에서 돌린다.
 */
export default function TogetherMaterialsScreen() {
  const { show } = useToast();
  const insets = useSafeAreaInsets();

  const {
    status,
    participants,
    previousParticipants,
    roleCards,
    roleProgresses,
    currentStep,
    myParticipantId,
    statusFailure,
    rememberParticipants,
    verifyMyRole,
    advanceToComplete,
    leaveRoom,
    isAdvancing,
    isVerifying,
  } = useCoopMissionRoom();

  const reset = useCoopPartyStore((state) => state.reset);
  const pauseRoom = useCoopPartyStore((state) => state.pauseRoom);
  const forgetPausedRoom = useCoopPartyStore((state) => state.forgetPausedRoom);
  const hostChangedWhilePaused = useCoopPartyStore((state) => state.hostChangedWhilePaused);
  const consumeHostChangeNotice = useCoopPartyStore((state) => state.consumeHostChangeNotice);
  const saveCompleteResult = useMissionCompleteStore((state) => state.save);

  const [expandedRoleCardId, setExpandedRoleCardId] = useState<number | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  /** 카메라 화면은 라우트를 새로 쌓지 않고 이 화면 안에서 갈아 끼운다(보물찾기 phase와 같은 방식) */
  const [capturing, setCapturing] = useState(false);

  const cancelGuard = useMissionCancelGuard({
    // 촬영 중 하드웨어 백은 미션 이탈이 아니라 촬영 취소다
    onHardwareBack: () => {
      if (!capturing) return false;
      setCapturing(false);
      return true;
    },
  });

  const mine = myRoleProgress(roleProgresses, myParticipantId);
  const myCard = mine === null ? null : findRoleCard(roleCards, mine.roleCardId);
  const others = otherRoleProgresses(roleProgresses, myParticipantId);
  /**
   * "나의 역할" 자리에 무엇을 그릴지 — 스켈레톤 / 안내 문구 / 역할 카드. 판정은 `coopRole.ts`에 있다.
   *
   * **이 화면은 역할보다 먼저 열릴 수 있다.** 단계가 3이 되어야 여기로 오지만(coopStep.ts),
   * 화면이 새로 마운트되면서 좌표를 다시 읽는 동안 상태 캐시가 비어 첫 응답 전까지는 역할이 없다.
   * 그 구간을 비워 두면 "역할이 없는 화면"으로 보이므로 자리표시로 덮는다.
   */
  const myRole = myRoleView(roleProgresses, roleCards, myParticipantId);
  /**
   * "다음"(= 완료 단계로 올리기)을 누를 수 있는지. 판정은 `coopRole.ts`에 있다.
   *
   * 전원이 인증을 마치면 **방장이 아니어도 누구든** 누를 수 있다(사용자 지시). 다만
   * **내 역할을 모르는 동안에는 열리지 않는다** — 예전 조건(`allRolesVerified` 하나)은
   * 목록에 내가 없어도 참이 될 수 있어서, 심사위원용 모드의 완료된 가짜 팀원만 남은 순간에
   * "나의 역할: 아직 배정되지 않았어요"인 채로 버튼이 열렸다.
   */
  const canFinish = canCompleteCoopMission(roleProgresses, myParticipantId);

  // 단계 이동은 서버가 정한다. 방장이 "다음"을 눌러 4단계가 되면 팀원도 폴링으로 그 변화를 받아
  // 같은 경로로 완료 화면에 도착한다 — 두 사람이 다른 코드로 움직이면 화면이 갈라진다.
  useEffect(() => {
    // 어디로 갈지는 `coopScreenAdvance`가 정한다. null이면 **제자리**다 — 그 안에 두 규칙이 있다.
    //
    //   1. **단계를 모르는 동안에는 아무 데도 가지 않는다.** 이 화면에 막 들어온 순간에는 상태
    //      조회가 아직 한 번도 응답하지 않아 `currentStep`이 null이다(조회 키에 좌표가 들어가는데,
    //      새로 마운트된 이 화면은 좌표를 다시 읽는 동안 캐시가 비어 있다).
    //   2. **뒤로는 가지 않는다.** 예전에는 초대 화면으로 되돌리는 갈래가 있었는데, 초대 화면은
    //      폴링으로 3단계를 읽고 다시 이리로 보낸다 — 두 화면이 서로를 밀어내며 앱이 그대로
    //      죽었다(기기에서 확인). 2단계가 초대 화면으로 옮겨 가면서(coopStep.ts) 배정 도중에
    //      나간 응답이 뒤늦게 도착하면 그 왕복이 다시 만들어질 수 있어, 규칙을 그 함수에 못박았다.
    const screen = coopScreenAdvance('materials', currentStep);
    coopTrace('재료:단계 확인', { currentStep, screen });
    // 재료 찾기에서 앞으로 갈 수 있는 화면은 완료뿐이다. 그 외에는 머문다.
    if (screen !== 'complete') return;

    // 이 전환은 **연타 게이트를 지나지 않는다(navigate.ts).** 사람이 누른 것이 아니라
    // 폴링 응답이 정한 이동이라, 화면에 막 들어온 직후(홈의 "이어서 진행" → 이어하기 응답)
    // 400ms 게이트에 걸려 조용히 버려지면 이 effect는 `currentStep`이 더 바뀌지 않는 한
    // 다시 시도하지 않는다 — 단계와 화면이 어긋난 채 굳는다.
    //
    // 완료 화면에는 조회 API가 없어 폴링 응답의 보상과 다음 장소를 넘겨 준다.
    // 다음 장소는 상태 조회가 좌표를 받게 되면서 거리(distanceMeter)까지 담겨 오므로
    // 완료 화면의 거리 배지가 채워진다(예전 계약에는 거리가 없어 넘기지 못했다).
    // 협동 API는 진행 중인 장소 id는 주지 않아 방명록은 좌표만 가진 형태로 열린다.
    saveCompleteResult('coop', { reward: status?.reward ?? null, nextLocation: status?.nextLocation ?? null, completedLocationId: null });
    navigate.replaceProgrammatic({ pathname: '/mission/complete', params: { mission: 'coop' } });
    // **끝난 방은 여기서 버린다.** 완료 화면은 이 스토어를 읽지 않아서(app/mission/complete.tsx)
    // 남겨 두면 앱을 켜 둔 내내 끝난 방이 스토어에 남고, 그 뒤의 협동 미션 진입이 그 방을 폴링해
    // 곧바로 완료 화면으로 되돌아온다. 이동한 **뒤에** 비워 이 화면이 빈 상태로 다시 그려지지 않게 한다
    // (비운 직후에는 `currentStep`이 null이라 이 effect도 곧바로 되돌아 나간다).
    reset();
  }, [currentStep, status, saveCompleteResult, reset]);

  const toggle = useCallback((roleCardId: number) => {
    setExpandedRoleCardId((current) => toggleExpandedRoleCardId(current, roleCardId));
  }, []);

  /**
   * 촬영한 사진으로 내 역할을 인증한다. 촬영·미리보기·갤러리 저장은 `CharacterPhotoCapture`가
   * 맡고, 여기로는 "이 파일을 어디로 보낼지"만 위임된다.
   *
   * **"완료"를 누른 뒤에** 불린다(사용자 지시) — 셔터를 누른 시점이 아니다. 그래서 미리보기에서
   * "다시 찍기"로 버린 사진은 서버에 올라가지 않는다.
   *
   * **여기서는 throw하지 않는다.** 공통 컴포넌트의 reject 경로는 올릴 곳을 아는 화면이 달리 할 말이
   * 없을 때를 위한 것이라 문구가 '사진을 서버에 올리지 못했어요' 하나뿐인데, 협동은 `verifyMyRole`이
   * 전송 실패를 이미 `CoopFailure`로 좁혀 두어 실패마다 다른 안내가 있다(coopFailureMessage).
   * throw하면 그 문구가 일반 문구로 덮이거나, 여기서도 띄우면 토스트가 두 번 뜬다.
   *
   * `isVerified:false`는 애초에 업로드 실패가 아니다 — **사진은 올라갔고**, 서버가 역할과 맞지
   * 않다고 판정한 200 응답이다. 전송 오류와 섞으면 "다시 찍으면 되는 상황"이 통신 장애처럼 보인다.
   *
   * useCallback을 두지 않는다 — 의존성에 파생 객체(mine)가 들어가면 react-compiler가
   * 기존 메모이제이션을 보존할 수 없다고 판단해 컴파일을 건너뛴다. 컴파일러가 알아서 메모한다.
   */
  const handleVerifyUpload = async (uri: string) => {
    if (mine === null) return;

    // 서버는 multipart로 파일 하나만 받는다. 참가자·역할은 roleProgressId로 조회한다.
    // RN에는 file:// URI로 Blob을 만드는 경로가 없어 캐스팅이 필요하다 —
    // 이유는 reactNativeFilePart.ts 주석 참고(캐스팅은 호출부에 남겨 둔다).
    const result = await verifyMyRole(mine.roleProgressId, toReactNativeFilePart(uri) as unknown as Blob);

    if (!result.ok) {
      show(coopFailureMessage(result.failure, result.detail));
      return;
    }

    // 사진이 역할과 맞지 않으면 서버가 200 + isVerified:false를 준다. 오류가 아니라 판정 결과다.
    // 인증이 남지 않았으므로 업로드 박스가 그대로 남고 같은 자리에서 다시 촬영할 수 있다.
    if (!result.verified) {
      show(VERIFY_FAILED_MESSAGE);
      return;
    }

    // 내 것 말고 아직 인증하지 않은 사람이 남았는지로 문구를 고른다.
    // `roleProgresses`는 방금 인증한 결과를 아직 반영하지 않았을 수 있어(재조회 직후) 내 역할은 빼고 센다.
    const othersPending = otherRoleProgresses(roleProgresses, myParticipantId).some((progress) => !isRoleVerified(progress));
    show(othersPending ? VERIFY_SUCCESS_WAITING_MESSAGE : VERIFY_SUCCESS_ALL_DONE_MESSAGE);
  };

  /**
   * 방 상태를 비우고 미션 인트로로 돌아간다. 아래 두 경로가 공유하는 마지막 동작이다.
   *
   * 미션 id를 함께 넘긴다 — 인트로의 "다시 시작하기"가 그 id로 방을 열기 때문이다(coopIntroRoute).
   * 이 화면에는 라우트 파라미터가 없어 상태 조회 응답의 `missionId`가 유일한 출처다.
   */
  const goToIntro = useCallback(() => {
    reset();
    navigate.replace(coopIntroRoute(status?.missionId));
  }, [reset, status?.missionId]);

  /** 돌아올 방이 **없이** 떠난다 — "포기 할래요", 방이 사라짐. 쉬기 메모를 함께 버린다 */
  const leaveToIntro = useCallback(() => {
    forgetPausedRoom();
    goToIntro();
  }, [forgetPausedRoom, goToIntro]);

  /**
   * "잠깐 쉴게요" — 인증한 사진은 이미 서버에 있으므로 보낼 것이 없다.
   *
   * 나가던 순간의 **방장 신원**만 남긴다. 쉬는 동안 방장이 나가 승계가 일어나도 폴링이 꺼져
   * 있어 알 수 없고, 다시 시작하는 순간 이어하기 응답의 방장과 대조해서 알아낸다(coopParty.ts).
   * 초대 화면과 같은 값을 같은 방식으로 남긴다 — 어느 단계에서 쉬었는지에 따라 판정이
   * 달라지면 안 된다.
   */
  const pauseMission = useCallback(() => {
    pauseRoom(findHost(participants)?.participantId ?? null);
    goToIntro();
  }, [pauseRoom, participants, goToIntro]);

  /**
   * 쉬는 동안 방장이 바뀌었다는 안내.
   *
   * 이어하기가 3단계 방으로 돌려보내면 초대 화면을 거치지 않고 곧장 여기로 오므로,
   * 같은 안내가 이 화면에도 있어야 한다 — 한쪽에만 두면 어느 단계에서 쉬었는지에 따라
   * 안내가 있기도 없기도 한다. 띄운 즉시 플래그를 내려 한 번만 보이게 한다.
   */
  useEffect(() => {
    if (!hostChangedWhilePaused) return;
    show(COOP_HOST_CHANGED_MESSAGE);
    consumeHostChangeNotice();
  }, [hostChangedWhilePaused, show, consumeHostChangeNotice]);

  /**
   * 미션이 진행되는 동안의 참여자 변화.
   *
   * **폴링 응답만으로 알 수 있다** — 상태 조회는 2·3단계에서도 `participants`를 그대로 주고
   * 거기에 `participantRole: HOST | MEMBER`가 들어 있다(계약의 단계별 표). 예전에는 이 판정이
   * 초대 화면에만 있어서, 재료 찾기 중에 방장이 나가 승계가 일어나도 아무 안내가 없었다.
   * 응답에는 이미 새 방장이 담겨 있었는데 읽는 코드가 이 화면에 없었을 뿐이다.
   *
   * 쉬기 메모(`hostChangedWhilePaused`)와 역할이 다르다. 그쪽은 **폴링이 꺼져 있던 구간**의
   * 승계를 이어하기 응답으로 뒤늦게 알아내는 장치이고, 이쪽은 화면에 머무는 동안의 승계를
   * 실시간으로 잡는다. 둘은 서로를 대체하지 못한다.
   */
  useCoopPartyChanges({
    participants,
    previousParticipants,
    myParticipantId,
    rememberParticipants,
    // 이 단계에는 거절이 없다. 내가 목록에서 사라졌다면 방이 나를 더 이상 참여자로 보지 않는 것이라
    // 폴링도 곧 404로 떨어진다 — 아래 statusFailure 경로와 같은 문구·같은 처리를 쓴다.
    onRemoved: useCallback(() => {
      show(COOP_FAILURE_MESSAGE.gone);
      leaveToIntro();
    }, [show, leaveToIntro]),
    onBecameHost: useCallback(() => show(COOP_HOST_CHANGED_MESSAGE), [show]),
    // 수락·거절 UI가 없는 단계이므로 목록이 줄어드는 것은 그 사람의 "포기 할래요"다
    onDeparted: useCallback((departed) => show(coopLeftMessage(departed.name)), [show]),
  });

  // 방이 사라졌으면 남아 있어 봐야 역할 목록이 비어 있을 뿐이다.
  // 3단계에서 누가 나가도 미션은 계속되므로(서버가 재배정하지 않는다) 그건 여기 해당하지 않는다.
  useEffect(() => {
    if (statusFailure !== 'gone' && statusFailure !== 'already-completed') return;
    show(COOP_FAILURE_MESSAGE[statusFailure]);
    leaveToIntro();
  }, [statusFailure, show, leaveToIntro]);

  /** "다음" — 완료 단계로 올린다. 이동은 currentStep 변화를 보고 위의 effect가 한다 */
  const finishMission = useCallback(() => {
    void (async () => {
      const result = await advanceToComplete();
      if (!result.ok) show(coopFailureMessage(result.failure, result.detail));
    })();
  }, [advanceToComplete, show]);

  // "포기할래요" — 방에서 빠진다. 보상은 받지 못한다.
  const abandonMission = useCallback(() => {
    void (async () => {
      try {
        await leaveRoom();
      } finally {
        // 나가기 요청이 실패해도 화면은 떠난다 — 여기 붙잡아 두면 나갈 방법이 없다.
        leaveToIntro();
      }
    })();
  }, [leaveRoom, leaveToIntro]);

  // 촬영은 보물찾기와 같은 공용 화면을 쓴다 — 미리보기와 갤러리 저장이 거기 이미 있고,
  // 캐릭터 합성만 빼면 나머지 파이프라인은 재료 찾기에도 그대로 맞는다.
  // 캐릭터를 넘기지 않으므로 딤·캐릭터 레이어 없이 카메라만 그려진다.
  //
  // **FullBleed로 감싼다**(보물찾기 촬영 화면과 같다). 루트 레이아웃이 모든 화면에 하단
  // 안전영역 padding을 걸어 두는데, 촬영 화면의 하단 패널도 같은 값을 스스로 넣는다 —
  // 취소하지 않으면 그 여백이 두 번 들어가 셔터 아래가 그만큼 비었다(사용자 지시로 확인).
  // 카메라가 네비게이션바 뒤까지 이어져야 하는 이유이기도 하다.
  if (capturing && mine !== null && myCard !== null) {
    return (
      <FullBleed>
        <CharacterPhotoCapture
          guideMessage={rolePhotoGuide(myCard.roleName, myCard.locationToFind)}
          accent="coop"
          // 실패를 보물찾기와 갈라 보기 위한 Sentry 태그
          telemetryFeature="coop-role-photo"
          // 보물찾기 촬영 화면과 같은 헤더다 — **배경 없이 동그란 뒤로가기 하나뿐**(사용자 지시).
          // 카메라 위에 얹히는 헤더라 어두운 제목 글자는 피사체에 따라 읽히지 않고, 판을 깔면
          // 그만큼 뷰파인더가 좁아진다. 무엇을 찍는지는 하단 흰 패널의 guideMessage가 역할명과
          // 함께 말한다(예전 화면에서 안내 문구가 있던 그 자리다).
          renderHeader={({ onBack }) => (
            <View style={{ paddingTop: insets.top }}>
              <NavigationHeader title="" onBack={onBack} backVariant="circle" />
            </View>
          )}
          onUpload={handleVerifyUpload}
          // 미리보기의 "완료"가 갤러리 저장과 인증 전송을 **끝낸 뒤** 여기로 온다. 역할 목록으로 돌아간다
          onCaptured={() => setCapturing(false)}
          onBack={() => setCapturing(false)}
        />
      </FullBleed>
    );
  }

  return (
    <CoopStepLayout {...COOP_STEP_COPY.materials} onBack={cancelGuard.requestExit} ctaText="다음" ctaDisabled={!canFinish || isAdvancing} onCtaPress={finishMission} flatTop>
      {/* "나의 역할" 헤더도 함께 스크롤한다(사용자 지시) — 초대 화면과 달리 이 화면은
          내용이 길어 헤더가 고정되면 위쪽 공간을 계속 차지한다 */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.selectionListContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.sectionHeader, styles.selectionSectionHeader]}>
          <Text style={styles.sectionLabel}>나의 역할</Text>
          <Pressable onPress={() => setGuideVisible(true)} hitSlop={8} style={styles.guideChip} accessibilityLabel="촬영 가이드 보기">
            <Text style={styles.guideChipText}>촬영 가이드</Text>
          </Pressable>
        </View>

        {/* 세 상태는 서로 배타적이다(myRoleView) — 한 번에 하나만 그려진다 */}
        {myRole === 'loading' && <MyRoleSkeleton />}
        {myRole === 'missing' && <Text style={styles.emptyNotice}>{MY_ROLE_MISSING_MESSAGE}</Text>}
        {myRole === 'ready' && mine !== null && myCard !== null && (
          <RoleCard
            roleName={myCard.roleName}
            ownerLabel="나"
            mine
            selected
            showAvatarRing={false}
            expanded={expandedRoleCardId === myCard.roleCardId}
            onToggle={() => toggle(myCard.roleCardId)}
            status={isRoleVerified(mine) ? { label: '인증 완료', tone: 'done' } : { label: '인증 대기', tone: 'waiting' }}
          >
            <RoleVerify hint={roleVerifyHint(myCard.roleName)} photoUri={mine.itemImgUrl ?? undefined} onPressUpload={isVerifying ? undefined : () => setCapturing(true)} />
            <View style={styles.verifyDetailGap}>
              <RoleDetail description={myCard.roleDescription} chips={roleChips(myCard.locationToFind)} />
            </View>
          </RoleCard>
        )}

        {others.length > 0 && (
          <View style={styles.blockGapLarge}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>함께하는 역할</Text>
            </View>

            <View style={styles.list}>
              {others.map((progress) => {
                const card = findRoleCard(roleCards, progress.roleCardId);

                return (
                  <RoleCard
                    key={progress.roleProgressId}
                    roleName={progress.roleName}
                    ownerLabel={progress.participantName}
                    showAvatarRing={false}
                    // 디자인의 팀원 카드에는 배지가 없지만, 전원 인증이 "다음"의 조건이라
                    // 누가 남았는지 보이지 않으면 버튼이 왜 잠겼는지 알 수 없다
                    status={isRoleVerified(progress) ? { label: '인증 완료', tone: 'done' } : { label: '인증 대기', tone: 'waiting' }}
                    expanded={expandedRoleCardId === progress.roleCardId}
                    onToggle={card === null ? undefined : () => toggle(progress.roleCardId)}
                  >
                    {card !== null && (
                      <>
                        <RoleVerify hint={roleVerifyHint(card.roleName)} photoUri={progress.itemImgUrl ?? undefined} />
                        <View style={styles.verifyDetailGap}>
                          <RoleDetail description={card.roleDescription} chips={roleChips(card.locationToFind)} />
                        </View>
                      </>
                    )}
                  </RoleCard>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <PhotoGuideSheet visible={guideVisible} onClose={() => setGuideVisible(false)} />

      <MissionCancelModal
        visible={cancelGuard.visible}
        // "잠깐 쉴게요" — 인증한 사진은 이미 서버에 올라가 있으므로 추가 전송이 없다.
        // 방은 IN_PROGRESS로 남아 intro의 "시작하기"(이어하기 200)로 되돌아올 수 있다.
        onPause={pauseMission}
        // "포기할래요" — 방에서 빠진다. 보상을 받지 못한다.
        onAbandon={abandonMission}
        onClose={cancelGuard.dismiss}
      />
    </CoopStepLayout>
  );
}
