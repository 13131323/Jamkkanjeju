import { useEffect, useRef } from 'react';
import type { Participant } from '@packages/shared';
import { useCoopSimulationEnabled } from '@/config/coopSimulation';
import { becameHost, removedParticipants, shouldSkipPartyChangeCheck, wasRemoved } from '@/utils/party';

/**
 * 폴링 응답 사이의 **참여자 변화**를 화면에 알린다.
 *
 * 상태 조회(`GET .../progress`)는 1~3단계에서 `participants`를 통째로 준다(계약의 단계별 표).
 * 그 목록에는 `participantRole: HOST | MEMBER`가 들어 있어서, **누가 방에서 빠졌는지와 방장이
 * 누구로 바뀌었는지를 폴링만으로 알 수 있다.** 서버가 따로 알려 주는 이벤트는 없고 이것이
 * 유일한 근거다.
 *
 * 판정을 이 한 곳에 모으는 이유: 예전에는 초대 화면에만 이 effect가 있었고 재료 찾기 화면에는
 * 없었다. 그래서 미션이 진행되는 동안(2·3단계) 방장이 나가 승계가 일어나도 **아무도 그것을
 * 알지 못했다** — 폴링 응답에는 이미 새 방장이 들어 있는데 읽는 코드가 없었을 뿐이다.
 * 같은 규칙을 두 화면에 옮겨 적으면 다음에 또 한쪽만 고쳐진다.
 *
 * 알림 순서가 규칙의 일부다. 내가 빠진 경우를 **먼저** 처리하고 곧바로 빠져나온다 —
 * 이미 방에 없는 사람에게 "방장이 되었어요"나 "누가 나갔어요"를 띄우는 것은 앞뒤가 맞지 않고,
 * 그 화면은 어차피 떠나는 중이다.
 *
 * 마지막에 스냅샷을 갱신하므로 같은 변화가 다음 폴링에서 다시 잡히지 않는다. 폴링은 값이
 * 그대로여도 2초마다 도는데, 스냅샷을 남기지 않으면 토스트가 매 주기 반복된다.
 */
export interface CoopPartyChangeHandlers {
  /** 이번 폴링이 준 참여자 목록 */
  participants: Participant[];
  /** 직전 폴링 스냅샷. null이면 비교할 것이 없는 첫 응답이다 */
  previousParticipants: Participant[] | null;
  myParticipantId: number | null;
  /** 스냅샷 갱신. `useCoopMissionRoom`이 스토어 액션을 그대로 넘겨 준다 */
  rememberParticipants: (participants: Participant[]) => void;
  /**
   * 내가 목록에서 사라졌다.
   *
   * 화면마다 떠나는 방식이 달라 콜백으로 받는다 — 초대 화면에서는 방장이 나를 거절한 것이고,
   * 재료 찾기에서는 방이 나를 더 이상 참여자로 보지 않는다는 뜻이다.
   */
  onRemoved: () => void;
  /** 내가 새 방장이 됐다 */
  onBecameHost: () => void;
  /** 남이 목록에서 사라졌다. 단계에 따라 거절이기도, 본인의 이탈이기도 하다 */
  onDeparted: (participant: Participant) => void;
}

export function useCoopPartyChanges({ participants, previousParticipants, myParticipantId, rememberParticipants, onRemoved, onBecameHost, onDeparted }: CoopPartyChangeHandlers): void {
  /**
   * 심사위원용 모드가 **실행 중에 켜지거나 꺼지면** 이번 회차의 변화 판정을 건너뛴다.
   *
   * 이 훅이 받는 목록에는 가짜 팀원이 섞여 있다(useCoopMission.ts의 `simulateParticipants`).
   * 그래서 모드를 끄는 순간 다음 목록에서 세 명이 통째로 사라지는데, 그것을 그대로 비교하면
   * **아무도 나가지 않았는데 "○○님의 참여를 거절했어요"가 세 번 뜬다.** 켜는 쪽도 대칭으로
   * 목록이 부풀지만 그쪽은 알릴 것이 없어 조용하다.
   *
   * 가짜를 빼고 비교하는 방법도 있었지만 그러면 **가짜 팀원을 거절했을 때의 안내가 사라진다** —
   * 그 안내는 이 변화 감지가 유일한 출처다(together.tsx의 `handleReject` 주석). 모드가 바뀌는
   * 순간은 폴링 두 회차 사이의 사건이 아니므로, 그 한 회차만 **스냅샷만 갈아 끼우고 넘어간다.**
   * 없던 일을 알리는 것보다 한 회차 알리지 않는 쪽이 낫다.
   */
  const simulationEnabled = useCoopSimulationEnabled();
  const previousSimulationRef = useRef(simulationEnabled);

  useEffect(() => {
    if (shouldSkipPartyChangeCheck(previousSimulationRef.current, simulationEnabled)) {
      previousSimulationRef.current = simulationEnabled;
      // 새 기준으로 스냅샷만 다시 잡는다. 다음 회차부터는 같은 기준끼리 비교된다.
      rememberParticipants(participants);
      return;
    }

    // 내가 빠졌으면 이 화면에 남을 이유가 없다. 다른 알림보다 먼저 처리한다.
    if (wasRemoved(previousParticipants, participants, myParticipantId)) {
      onRemoved();
      return;
    }

    if (becameHost(previousParticipants, participants, myParticipantId)) {
      onBecameHost();
    }

    removedParticipants(previousParticipants, participants).forEach(onDeparted);

    rememberParticipants(participants);
  }, [previousParticipants, participants, myParticipantId, simulationEnabled, rememberParticipants, onRemoved, onBecameHost, onDeparted]);
}
