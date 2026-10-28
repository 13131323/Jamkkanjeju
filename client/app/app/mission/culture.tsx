import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button/Button';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { MissionCancelModal } from '@/components/Mission/MissionCancelModal/MissionCancelModal';
import { NavigationHeader } from '@/components/NavigationHeader/NavigationHeader';
import { QuizIllustrationCard } from '@/components/Quiz/QuizIllustrationCard/QuizIllustrationCard';
import { QuizOption, QuizOptionState } from '@/components/Quiz/QuizOption/QuizOption';
import { QuizProgressBar } from '@/components/Quiz/QuizProgressBar/QuizProgressBar';
import { QuizSkeleton } from '@/components/Quiz/QuizSkeleton/QuizSkeleton';
import { QuizResultModal, QuizResultVariant } from '@/components/Quiz/QuizResultModal/QuizResultModal';
import { isCorrectAnswer, resolveCurrentQuizIndex, resolveQuizAdvance, toPlayableQuizzes } from '@/constants/cultureQuiz';
import { MISSION_TYPE_INPUT, resolveMissionId } from '@/constants/missionHome';
import { useMissionCancelGuard } from '@/hooks/useMissionCancelGuard';
import { isJudgeModeEnabled, judgeModePosition } from '@/store/judgeMode';
import { useMissionCompleteStore } from '@/store/missionComplete';
import {
  useSaveCultureMissionProgressApiV1CultureMissionsCultureMissionProgressIdProgressPatch,
  useStartCultureMissionApiV1CultureMissionsCultureMissionIdProgressPost,
  useStopCultureMissionProgressApiV1CultureMissionsCultureMissionProgressIdProgressStopPatch,
} from '@/services/api/culture-mission/culture-mission';
import { useGetMissionHomeApiV1MissionsMissionTypeMissionIdGet } from '@/services/api/mission/mission';
import { navigate } from '@/utils/navigate';
import { resolveStopCoordinates } from '@/utils/missionStopCoords';
import { CTA_BOTTOM_GAP, ctaBottomPadding } from '@/styles/safeArea';

/** 한 문제에 허용되는 오답 횟수. 2회 실패하면 정답을 보여주고 넘어간다 */
const MAX_WRONG_ATTEMPTS = 2;

/**
 * 서버에 보낼 현재 좌표. 측위하지 못했으면 `null`이다.
 *
 * **고정 좌표 폴백을 두지 않는다.** 예전에는 측위가 비면 제주 중심(33.3614, 126.5294)을
 * 대신 보냈다. 그런데 `getLastKnownPositionAsync()`는 OS 캐시가 비어 있으면(앱을 막 켠 직후,
 * 위치를 방금 켠 직후) 예외가 아니라 **정상적으로 null을 돌려준다** — 드문 갈래가 아니라 흔한
 * 갈래로 그 고정 좌표가 심사위원용 모드와 무관하게 서버로 나갔다.
 * 현장 답사에서는 기기의 실제 좌표가 그대로 남아야 하므로(보물찾기 treasure.tsx와 같은 이유)
 * 캐시가 비면 실제로 측위하고, 그마저 실패하면 지어낸 좌표를 보내는 대신 null을 돌려
 * 호출부가 판단하게 한다.
 *
 * 진행도 API의 latitude/longitude는 **필수 파라미터**라(orval 생성 params 타입) 좌표 없이
 * 요청을 보낼 수는 없다. 그래서 호출부의 선택지는 "지어내서 보낸다"가 아니라
 * "보내지 않고 사용자에게 알린다"뿐이다.
 *
 * 예외는 **"포기 할래요" 한 곳뿐**이다(finishByStopping의 isAbandon). 거기서는 요청을 못 보내면
 * 미션이 서버에 영영 진행중으로 남아 홈에 계속 뜨므로, 호출부가 resolveStopCoordinates로
 * 폴백을 씌운다 — 이 함수는 그대로 null을 돌려준다.
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

    // 캐시가 없을 때만 실제로 측위한다. 거리 표시는 수십 m 오차로 뒤집히지 않으므로 Balanced면 충분하다
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: current.coords.latitude, longitude: current.coords.longitude };
  } catch {
    // 권한 거부·측위 실패. 호출부가 좌표 없는 상태를 처리한다
    return null;
  }
}

export default function CultureMissionScreen() {
  const insets = useSafeAreaInsets();
  const { missionId: rawMissionId } = useLocalSearchParams<{ missionId?: string }>();
  const cancelGuard = useMissionCancelGuard();
  const cultureMissionId = resolveMissionId(rawMissionId, 'culture');
  // 완료 화면은 보상·다음 장소를 조회할 API가 없다. 미션을 끝내는 응답을 그대로 넘겨준다
  const saveCompleteResult = useMissionCompleteStore((state) => state.save);
  const clearCompleteResult = useMissionCompleteStore((state) => state.clear);

  /**
   * 사용자가 실제로 넘긴 문제 위치. 아직 한 문제도 넘기지 않았으면 `null`이고,
   * 그 동안은 서버가 준 이어하기 위치가 곧 현재 위치다(아래 `currentIndex`).
   */
  const [visitedIndex, setVisitedIndex] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  /** 현재 문제에서 틀린 횟수 */
  const [wrongAttempts, setWrongAttempts] = useState(0);
  /** 2회 실패 후 정답 공개 상태. 이때 "다음"이 다시 활성화된다 */
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [modal, setModal] = useState<QuizResultVariant | null>(null);
  /**
   * 좌표를 못 얻어 저장을 보내지 못한 상태.
   *
   * 진행도 API가 위경도를 필수로 받으므로 측위가 실패하면 요청 자체를 만들 수 없다.
   * 지어낸 좌표로 채우지 않는 대신(readCoordinates 주석) 사용자에게 알리고,
   * "다음"을 다시 누르면 측위부터 재시도가 된다.
   */
  const [hasLocationFailed, setHasLocationFailed] = useState(false);

  // 진입 시 1회만 진행도를 만든다(이미 진행 중이면 서버가 기존 것을 돌려준다).
  const { mutate: startMission, mutateAsync: startMissionAsync, data: started, isPending: isStarting, isError: hasStartFailed } = useStartCultureMissionApiV1CultureMissionsCultureMissionIdProgressPost();
  const saveProgress = useSaveCultureMissionProgressApiV1CultureMissionsCultureMissionProgressIdProgressPatch();
  const stopProgress = useStopCultureMissionProgressApiV1CultureMissionsCultureMissionProgressIdProgressStopPatch();

  // 헤더 제목은 서버의 missionTitle이다. 인트로(app/mission/intro.tsx)가 같은 키로 이미 조회해 둬서
  // 정상 진입에서는 react-query 캐시가 그대로 맞고 추가 요청이 나가지 않는다.
  const { data: missionHome } = useGetMissionHomeApiV1MissionsMissionTypeMissionIdGet(MISSION_TYPE_INPUT.culture, cultureMissionId);

  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    startMission({ cultureMissionId });
  }, [cultureMissionId, startMission]);

  const quizzes = started ? toPlayableQuizzes(started.quizDetails) : [];

  /**
   * 지금 그릴 문제의 위치. 이어하기 위치는 **파생 값**이다(constants/cultureQuiz.ts).
   *
   * 예전에는 응답이 온 뒤 effect가 `setCurrentIndex`로 옮겼는데, 그러면 응답이 도착한 프레임에
   * 1번 문제가 먼저 그려지고 다음 프레임에 이어할 문제로 바뀌었다 — 홈의 "진행중인 미션"으로
   * 들어온 사용자에게 이미 푼 문제가 한 번 스쳐 지나갔다(사용자 지시: 바로 해당 단계로 가야 한다).
   *
   * `started`는 진입 시 한 번만 보내는 요청의 응답이라 이후 바뀌지 않는다. 그래서 사용자가
   * 한 문제라도 넘기면(`visitedIndex`) 그 값이 계속 이긴다.
   */
  const currentIndex = resolveCurrentQuizIndex(visitedIndex, quizzes, started?.currentQuizNumber ?? 1);

  const currentQuestion = quizzes[currentIndex];
  const total = quizzes.length;

  /**
   * 시작 응답을 기다리는 중인지.
   *
   * 요청은 아래 effect에서 나가므로 **첫 렌더에서는 아직 `isPending`이 false다.** 그 한 프레임을
   * 로딩으로 덮지 않으면 문제 목록이 비어 있어 "풀 수 있는 문제가 없어요"가 스쳐 지나간다.
   */
  const isPreparing = isStarting || (!started && !hasStartFailed);

  const goToNextQuestion = () => {
    setVisitedIndex(currentIndex + 1);
    setSelectedOption(null);
    setWrongAttempts(0);
    setAnswerRevealed(false);
  };

  /**
   * 푼 결과를 서버에 저장한다.
   *
   * isCorrect는 "2회 안에 맞혔는가"다. 정답을 공개받고 넘어간 경우만 오답으로 보낸다 —
   * 화면이 재시도를 허용하는 이상 사용자 체감과 맞춘다.
   */
  const submitQuiz = async (isCorrect: boolean) => {
    if (!started || !currentQuestion) return;

    const coords = await readCoordinates();
    // 좌표가 없으면 요청을 만들 수 없다. 안내만 띄우고 답은 화면에 그대로 둔다 —
    // 사용자가 위치를 켜고 "다음"을 다시 누르는 것이 곧 재시도다.
    if (!coords) {
      setHasLocationFailed(true);
      return;
    }
    setHasLocationFailed(false);

    const result = await saveProgress.mutateAsync({
      cultureMissionProgressId: started.cultureMissionProgressId,
      data: { quizIndex: currentQuestion.quizIndex, isCorrect },
      params: coords,
    });

    // 세 갈래("완료 화면으로" / "중단으로 끝내기" / "다음 문제")의 판단은 순수 함수에 있다.
    // 마지막 문제에서 멈춰 버리던 버그가 이 판단에 있었어서, 기기 없이도 확인할 수 있게 떼 놨다.
    switch (resolveQuizAdvance(result.missionProgressStatus, currentIndex, total)) {
      case 'complete':
        // 완료 응답에서만 nextLocation/reward가 채워져 온다(진행 중에는 둘 다 null)
        // 문화 미션은 장소에 묶이지 않아 완료 장소 id가 없다(방명록은 좌표만으로 열린다)
        saveCompleteResult('culture', { reward: result.reward ?? null, nextLocation: result.nextLocation ?? null, completedLocationId: null });
        navigate.replace({ pathname: '/mission/complete', params: { mission: 'culture' } });
        return;
      case 'stop':
        await finishByStopping();
        return;
      case 'next':
        goToNextQuestion();
        return;
    }
  };

  /**
   * 중단 요청으로 미션을 끝내고 완료 화면으로 간다.
   *
   * 서버는 **중단을 완료로 처리한다** — 맞힌 개수만큼 보상이 지급되고 다음 장소도 내려온다.
   * 그래서 인트로로 되돌리지 않고 완료 화면으로 보낸다.
   * 진행도가 없거나 이미 끝난 경우(404)에도 화면은 빠져나가야 한다.
   *
   * 두 곳이 부른다: "포기 할래요"(`isAbandon`)와, 객관식을 다 풀었는데 서버가 아직 완료가 아닌
   * 경우(`submitQuiz`).
   *
   * **포기일 때는 어떤 이유로도 요청을 거르지 않는다.** 요청이 안 나가면 서버는 미션을 계속
   * 진행중으로 들고 있어 홈의 "진행중인 미션"에 남는다(사용자 확인). 그래서 포기 경로에서만
   * 좌표 폴백(missionStopCoords.ts)과 진행도 id 확보를 켠다 — 정상 완료 경로는 지어낸 좌표로
   * '다음 장소'가 뽑히면 안 되므로 기존 동작 그대로 둔다.
   */
  const finishByStopping = async ({ isAbandon = false }: { isAbandon?: boolean } = {}) => {
    // 중단 응답을 받지 못하면 완료 화면이 직전 미션의 값을 보여주지 않도록 비워 둔다
    clearCompleteResult();

    // 진입 직후 시작 POST가 끝나기 전에 포기하면 서버엔 진행도가 생겼는데 앱은 id를 모른다.
    // 시작 엔드포인트는 이미 진행 중이면 기존 진행도를 그대로 돌려주므로, 한 번 더 불러 id를 얻는다.
    let progressId = started?.cultureMissionProgressId ?? null;
    if (progressId === null && isAbandon) {
      try {
        progressId = (await startMissionAsync({ cultureMissionId })).cultureMissionProgressId;
      } catch (error) {
        console.error('[culture] 포기: 진행도 id 확보 실패', error);
      }
    }

    if (progressId !== null) {
      const measured = await readCoordinates();
      // 정상 완료 경로는 좌표가 없으면 예전처럼 요청을 보내지 않는다
      const coords = isAbandon ? resolveStopCoordinates(measured) : measured;

      if (coords) {
        try {
          const stopped = await stopProgress.mutateAsync({ cultureMissionProgressId: progressId, params: coords });
          // 중단은 완료 처리라 nextLocation/reward가 항상 온다(맞힌 게 없으면 reward의 항목이 모두 null)
          saveCompleteResult('culture', { reward: stopped.reward, nextLocation: stopped.nextLocation, completedLocationId: null });
        } catch (error) {
          // 포기는 한 번 더 시도한다 — 여기서 놓치면 미션이 영영 진행중으로 남는다
          if (isAbandon) {
            try {
              const stopped = await stopProgress.mutateAsync({ cultureMissionProgressId: progressId, params: coords });
              saveCompleteResult('culture', { reward: stopped.reward, nextLocation: stopped.nextLocation, completedLocationId: null });
            } catch (retryError) {
              console.error('[culture] 포기 중단 요청 실패', retryError);
            }
          }
        }
      }
    }
    navigate.replace({ pathname: '/mission/complete', params: { mission: 'culture' } });
  };

  const handleNext = () => {
    // 정답 공개 상태에서는 채점 없이 오답으로 제출하고 다음 문제로
    if (answerRevealed) {
      void submitQuiz(false);
      return;
    }
    if (selectedOption === null || !currentQuestion) return;

    if (isCorrectAnswer(currentQuestion.options[selectedOption], currentQuestion.answer)) {
      setModal('success');
      return;
    }

    const attempts = wrongAttempts + 1;
    setWrongAttempts(attempts);
    if (attempts >= MAX_WRONG_ATTEMPTS) {
      // 2회 실패: 모달 없이 정답을 표시하고 "다음"을 활성화
      setAnswerRevealed(true);
    } else {
      setModal('fail');
    }
  };

  /** 실패/힌트 모달을 닫을 때는 선택을 지운다(힌트 보기 전 선택을 다시 보여주지 않는다) */
  const handleRetry = () => {
    setModal(null);
    setSelectedOption(null);
  };

  const handleSuccessConfirm = () => {
    setModal(null);
    void submitQuiz(true);
  };

  const optionState = (index: number): QuizOptionState => {
    if (!currentQuestion) return 'default';
    if (answerRevealed) {
      if (isCorrectAnswer(currentQuestion.options[index], currentQuestion.answer)) return 'selected';
      if (index === selectedOption) return 'wrong';
      return 'default';
    }
    return selectedOption === index ? 'selected' : 'default';
  };

  // 성공 모달에는 배지를 두지 않는다(undefined면 모달이 배지 자체를 그리지 않는다)
  const badgeText = modal === 'hint' ? currentQuestion?.hint : modal === 'fail' ? `남은 기회 ${MAX_WRONG_ATTEMPTS - wrongAttempts}회` : undefined;

  // 그라디언트와 하단 버튼 바 배경이 네비게이션바 뒤까지 이어져야 해서 루트 padding을 취소한다
  return (
    <FullBleed>
      <LinearGradient colors={['#ffffff', '#f6f6f6']} style={{ flex: 1, paddingTop: insets.top }}>
        {/* 캐시가 아직 없는 첫 프레임과 인트로를 건너뛴 딥링크 진입에서는 제목이 비지 않게 디자인 문구로 받친다 */}
        <NavigationHeader title={missionHome?.missionTitle ?? '오늘의 제주 퀴즈'} onBack={cancelGuard.requestExit} />

        {/* 시작 응답을 기다리는 동안에는 **곧 나타날 화면의 모양**을 그대로 그린다(QuizSkeleton).
            예전에는 가운데 스피너 하나여서, 응답이 오는 순간 진행바·이미지·문제·보기가 한꺼번에 나타났다 */}
        {isPreparing ? (
          <QuizSkeleton ctaBottomPadding={ctaBottomPadding(insets.bottom)} />
        ) : !currentQuestion ? (
          // 기다려도 바뀌지 않는 상태(시작 실패 · 풀 수 있는 문제 없음)는 자리표시가 아니라 문구로 말한다 —
          // 기다리면 채워지는 자리에만 스켈레톤을 둔다(together-materials.tsx의 같은 구분).
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center font-pretendard-regular text-body-md text-cool-neutral-500">
              {hasStartFailed ? '퀴즈를 불러오지 못했어요.\n잠시 후 다시 시도해주세요.' : '풀 수 있는 문제가 없어요.'}
            </Text>
          </View>
        ) : (
          <>
            {/* paddingTop 10 = 디자인상 헤더 끝(100)과 진행바(110)의 간격 */}
            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 }}>
              {/* 라벨은 서버의 quizIndex가 아니라 **화면에 보이는 순서**를 쓴다 — 주관식을 걸러 내면 서버
                  번호가 건너뛰어서 "Q3."인데 진행도는 "2 / 2"가 되는 어긋남이 생긴다(사용자 확인) */}
              <QuizProgressBar current={currentIndex + 1} total={total} label={`Q${currentIndex + 1}.`} />

              {/* 서버는 카테고리 없이 문제별 이미지만 준다. 이미지가 없는 문제는 카드를 그리지 않는다 */}
              {currentQuestion.imgUrl ? (
                <View className="mt-5">
                  <QuizIllustrationCard imageUri={currentQuestion.imgUrl} />
                </View>
              ) : null}

              <View className="mt-5">
                <Text className="font-pretendard-bold text-heading-h4 text-cool-neutral-950">{currentQuestion.question}</Text>
              </View>

              <View className="mt-5 gap-2.5">
                {/* 서버 보기에는 번호가 없다. 디자인처럼 "1. 하르방" 형태로 앞에 붙인다 */}
                {currentQuestion.options.map((option, index) => (
                  <QuizOption
                    key={`${currentQuestion.quizIndex}-${index}`}
                    label={`${index + 1}. ${option}`}
                    state={optionState(index)}
                    disabled={answerRevealed}
                    onPress={() => setSelectedOption(index)}
                  />
                ))}
              </View>
            </ScrollView>

            {/* 디자인 CTA 영역 699~800: 위 16 + 버튼 52 + 아래 33(홈 인디케이터 영역).
                디자인의 33은 iOS 홈 인디케이터 자리라 그대로 못 쓴다 — 위아래를 같은 값으로 두고
                시스템 바는 ctaBottomPadding이 따로 비켜 준다(사용자 지시: 상단 여백과 동일하게) */}
            {/* 측위 실패 안내. 저장을 보내지 못했으므로 답은 그대로 두고 이 자리에만 상태를 띄운다 */}
            {hasLocationFailed && (
              <View className="bg-[#fcfcfd] px-4 pt-3">
                <Text className="text-center font-pretendard-regular text-body-md text-cool-neutral-500">{'현재 위치를 확인하지 못했어요.\n위치를 켠 뒤 다시 시도해주세요.'}</Text>
              </View>
            )}

            <View className="flex-row gap-3 bg-[#fcfcfd] px-4" style={{ paddingTop: CTA_BOTTOM_GAP, paddingBottom: ctaBottomPadding(insets.bottom) }}>
              <View className="flex-1">
                <Button type="outline" color="primary" text="힌트" onPress={() => setModal('hint')} />
              </View>
              <View className="flex-1">
                {/* 보기를 고르기 전에는 비활성. 2회 실패로 정답이 공개된 뒤에는 다시 활성화된다 */}
                <Button color="primary" text="다음" disabled={(selectedOption === null && !answerRevealed) || saveProgress.isPending} onPress={handleNext} />
              </View>
            </View>
          </>
        )}

        {/* 닫힐 때 variant가 기본값으로 되돌아가며 내용이 깜빡이지 않도록 열려 있을 때만 마운트한다 */}
        {modal !== null && <QuizResultModal visible variant={modal} badgeText={badgeText} onConfirm={modal === 'success' ? handleSuccessConfirm : handleRetry} />}

        <MissionCancelModal
          visible={cancelGuard.visible}
          // "잠깐 쉴게요" — 서버가 문제마다 진행도를 이미 저장해 두므로 그대로 나가면 이어서 할 수 있다
          onPause={() => navigate.replace({ pathname: '/mission/intro', params: { mission: 'culture', missionId: String(cultureMissionId) } })}
          // "포기 할래요" — 서버는 중단도 완료로 처리해 맞힌 개수만큼 보상을 준다
          onAbandon={() => void finishByStopping({ isAbandon: true })}
          onClose={cancelGuard.dismiss}
        />
      </LinearGradient>
    </FullBleed>
  );
}
