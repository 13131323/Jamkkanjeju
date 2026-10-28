import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useToast } from '@/components/Toast/Toast';
import { useStartCoopMission } from '@/hooks/useCoopMission';
import { useCoopPartyStore } from '@/store/coopParty';
import { describeApiError } from '@/utils/apiError';
import { COOP_FAILURE_MESSAGE, resolveCoopFailure } from '@/utils/coopFailure';
import { coopEntryOutcome, coopHrefForScreen, coopIntroRoute, coopScreenForStep } from '@/utils/coopStep';
import { navigate } from '@/utils/navigate';

/**
 * 방 열기의 결과. 호출부가 이어서 무엇을 할지 정하는 데 쓴다.
 *
 * `'already-completed'`는 실패가 아니다 — 요청은 성공했고 서버가 **이미 끝난 진행도**를
 * 돌려준 것이다. 이 훅이 안내와 이동까지 끝내므로 호출부는 아무것도 하지 않으면 된다.
 */
export type CoopEnterResult = 'entered' | 'already-completed' | 'failed';

/**
 * 협동 미션 방을 열고, 서버가 알려 준 단계의 화면으로 넘어간다.
 *
 * `POST /api/v1/cooperative-missions/{cooperativeMissionId}/progress` 하나가
 * **새로 시작(201)과 이어하기(200)를 모두** 담당한다 — 응답 구조가 같아 클라이언트는 둘을 구분하지 않고,
 * 어디로 갈지는 응답의 `currentStep`이 정한다("프론트는 currentStep을 기준으로 화면을 구성한다").
 * 그래서 3단계 방으로 이어하면 초대 화면을 거치지 않고 곧장 재료 찾기로 간다.
 *
 * **2단계 방은 초대 화면으로 돌아간다**(coopStep.ts의 `coopScreenForStep`). 배정이 중간에 끊긴
 * 방이라 역할이 없거나 일부만 있고, 재료 찾기로 보내면 "나의 역할"이 빈 화면에 갇힌다.
 * 그 화면이 방장에게 **"다시 역할 나누기"**를 열어 끊긴 배정을 이어받는다(together.tsx의
 * `coopAssignPhase`) — 이미 배정된 사람과 쓰인 카드는 건드리지 않고 남은 것만 채우므로
 * 여러 번 눌러도 덮어써지지 않는다(useCoopMission.ts의 `assignRolesAndAdvance`).
 * 그 재시도도 **전원이 준비 완료여야** 열린다 — 처음 배정과 같은 규칙이다(party.ts).
 *
 * **단, 끝난 진행도를 돌려받는 경우가 있다.** 그때는 단계가 아니라 `missionProgressStatus`를
 * 본다(아래 `coopEntryOutcome`). 자세한 근거는 그 함수의 주석에 있다.
 *
 * 두 곳이 이걸 부른다: 인트로의 "시작하기"(`push`)와 진행중인 미션의 이어하기(`replace`).
 * 같은 요청·같은 라우팅 규칙이라 한 곳에 둔다 — 나뉘어 있으면 한쪽만 고쳐져 단계가 어긋난다.
 *
 * 실패를 던지지 않고 값으로 돌려준다. 방 열기는 화면을 넘기기 **전에** 오는 유일한 요청이라,
 * 잡지 않으면 처리되지 않은 rejection이 되어 개발 빌드에서 곧바로 에러 화면이 뜬다 —
 * 사용자에게는 "눌렀더니 앱이 깨졌다"로 보인다.
 */
export function useEnterCoopRoom(): (cooperativeMissionId: number, mode: 'push' | 'replace') => Promise<CoopEnterResult> {
  const { show } = useToast();
  const { start } = useStartCoopMission();
  const reset = useCoopPartyStore((state) => state.reset);
  const forgetPausedRoom = useCoopPartyStore((state) => state.forgetPausedRoom);

  return useCallback(
    async (cooperativeMissionId, mode) => {
      try {
        const started = await start(cooperativeMissionId);

        /**
         * 이미 끝난 진행도를 그대로 돌려받았다.
         *
         * **에러로 받았을 때와 같은 곳으로 보낸다.** 폴링이 `COOPERATIVE_MISSION_ALREADY_COMPLETED`를
         * 받으면 화면들은 "이미 끝난 미션이에요." 토스트와 함께 인트로로 되돌린다
         * (together.tsx · together-materials.tsx의 `statusFailure === 'already-completed'` 갈래).
         * 같은 상황을 서버가 에러 대신 200으로 알려 줄 뿐인데 다른 화면으로 가면 안 된다.
         *
         * 예전에는 여기서 `currentStep: 4`를 그대로 읽어 완료 화면으로 갔다. 그 화면은 보상을
         * `missionComplete` 스토어에서 꺼내는데(app/mission/complete.tsx) 이 경로에서는 아무도
         * 그 값을 넣지 않는다 — 재료 찾기 화면이 미션을 **방금** 끝낼 때만 넣는다
         * (together-materials.tsx의 `saveCompleteResult`). 그래서 보상 행이 통째로 비고
         * 부제가 "받은 보상이 없어요" 쪽으로 바뀐 완료 화면이 떴고, 같은 앱 세션에서 협동 미션을
         * 한 번 끝낸 적이 있으면 **그때 받은 보상**이 남아 있어 다시 받은 것처럼 보였다.
         *
         * 스토어를 비우는 것이 함께 필요하다: `start()`가 이미 이 끝난 방을 스토어에 넣어 둬서,
         * 남겨 두면 다음 협동 진입이 그 방을 폴링해 곧장 완료 화면으로 되돌아온다
         * (shouldOpenCoopRoom 주석의 그 경로다). 쉬기 메모도 버린다 — 돌아갈 방이 없다.
         */
        if (coopEntryOutcome(started.missionProgressStatus) === 'already-completed') {
          reset();
          forgetPausedRoom();
          show(COOP_FAILURE_MESSAGE['already-completed']);
          // 인트로가 필요한 미션 id는 인자로 이미 갖고 있다(응답에는 `missionId`가 없다).
          // 인트로에서 눌러 들어온 경우에는 제자리로 돌아오는 셈이고, 홈의 "이어서 진행"으로
          // 들어온 경우에는 이 화면 대신 인트로가 남는다.
          navigate.replaceProgrammatic(coopIntroRoute(cooperativeMissionId));
          return 'already-completed';
        }

        // 경로만이 아니라 파라미터까지 받는다 — 완료 단계(4)로 이어했을 때 `mission: 'coop'`이
        // 빠지면 완료 화면이 문화 미션으로 떨어진다(coopStep.ts의 coopHrefForScreen).
        const route = coopHrefForScreen(coopScreenForStep(started.currentStep));
        // **연타 게이트를 지나지 않는 전환을 쓴다(navigate.ts).** 이 전환은 사람이 누른 것이
        // 아니라 응답이 정한 것인데, 바로 앞에 사람이 만든 전환이 있다 — 홈의 "이어서 진행"이
        // `/mission/together`로 들어온 그 전환이다. 둘 사이는 요청 한 번(수백 ms)뿐이라
        // 400ms 게이트에 걸려 이 전환이 조용히 버려졌고, 그러면 3단계 방을 이어했는데도
        // 1단계 화면에 남았다("방장이 변경되었어요" 토스트만 뜨고 단계는 그대로).
        if (mode === 'replace') navigate.replaceProgrammatic(route);
        else navigate.pushProgrammatic(route);
        return 'entered';
      } catch (error) {
        // 서버가 무엇을 거절했는지 화면에 남긴다. 협동 미션의 에러 코드는 OpenAPI에 열거돼 있지 않고
        // (`ErrorResponse`가 `{ code: string }`이다) `code`가 아예 없는 응답도 있어서,
        // 코드가 없으면 status와 응답 바디라도 보여 줘야 원인을 좁힐 수 있다.
        Alert.alert('협동 미션을 시작하지 못했어요', `${COOP_FAILURE_MESSAGE[resolveCoopFailure(error)]}\n\n${describeApiError(error)}`);
        return 'failed';
      }
    },
    [start, show, reset, forgetPausedRoom],
  );
}
