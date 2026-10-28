import { COOP_STEP, MISSION_PROGRESS_STATUS, type Participant } from '@packages/shared';
import { describe, expect, it } from 'vitest';
import { DEV_SIM_PARTICIPANT_IDS, simulateCoopStatus, simulateParticipants } from './coopDevSimulation';
import { canReviewJoinRequest, canStartCoopMission, coopStartBlock, pendingParticipants } from './party';
import {
  COOP_POLL_BACKOFF_MS,
  COOP_POLL_INTERVAL_MS,
  coopAssignPhase,
  coopEntryOutcome,
  coopHrefForScreen,
  coopIntroRoute,
  coopInviteActionsOpen,
  coopInviteNoticeKind,
  coopPollIntervalMs,
  coopRouteForScreen,
  coopScreenAdvance,
  coopScreenForStep,
  isCoopAssigningRoles,
  shouldPollCoopStatus,
  shouldShowRoleAssignNotice,
} from './coopStep';

/**
 * 이어하기 요청이 **이미 끝난 진행도**를 그대로 돌려주는 경우의 판정.
 *
 * 서버가 그렇게 동작하는 것이 실기기에서 확인됐다 — 새 방을 만들지도, 409를 내지도 않는다.
 * 예전에는 그 응답의 `currentStep: 4`를 그대로 읽어 보상이 빈 완료 화면으로 갔다.
 */
describe('coopEntryOutcome', () => {
  it('COMPLETED면 이미 끝난 미션이다', () => {
    expect(coopEntryOutcome(MISSION_PROGRESS_STATUS.COMPLETED)).toBe('already-completed');
  });

  it('IN_PROGRESS면 이어서 진행한다', () => {
    expect(coopEntryOutcome(MISSION_PROGRESS_STATUS.IN_PROGRESS)).toBe('resume');
  });

  it('값이 없으면 이어서 진행한다 — 모르는 것을 완료로 단정하지 않는다', () => {
    expect(coopEntryOutcome(null)).toBe('resume');
    expect(coopEntryOutcome(undefined)).toBe('resume');
  });
});

describe('coopScreenForStep', () => {
  it('1단계는 일행 초대 화면이다', () => {
    expect(coopScreenForStep(COOP_STEP.INVITE)).toBe('invite');
  });

  /**
   * 배정은 2단계에서 일어난다. 그 사이 폴링이 2단계를 먼저 읽어도 화면이 넘어가면 안 된다 —
   * 그 시점 응답의 `roleProgresses`는 아직 `[]`라 "나의 역할"이 빈 화면에 갇힌다.
   */
  it('2단계(역할 배정 중)는 초대 화면에 머문다 — 배정이 끝나야 넘어간다', () => {
    expect(coopScreenForStep(COOP_STEP.ROLE_ASSIGNMENT)).toBe('invite');
  });

  it('3단계가 재료 찾기 화면이다', () => {
    expect(coopScreenForStep(COOP_STEP.MISSION)).toBe('materials');
  });

  it('4단계는 완료 화면이다', () => {
    expect(coopScreenForStep(COOP_STEP.COMPLETE)).toBe('complete');
  });

  it('계약에 없는 단계는 초대 화면으로 되돌린다 — 흰 화면을 만들지 않는다', () => {
    expect(coopScreenForStep(0)).toBe('invite');
    expect(coopScreenForStep(5)).toBe('invite');
    expect(coopScreenForStep(-1)).toBe('invite');
  });

  it('아직 단계를 모를 때도 초대 화면이다', () => {
    expect(coopScreenForStep(null)).toBe('invite');
    expect(coopScreenForStep(undefined)).toBe('invite');
  });
});

describe('isCoopAssigningRoles', () => {
  it('2단계가 역할을 배정하는 중이다 — 그 구간의 "다음"은 잠긴다(배정이 두 번 돌면 덮어써진다)', () => {
    expect(isCoopAssigningRoles(COOP_STEP.ROLE_ASSIGNMENT)).toBe(true);
  });

  it('나머지 단계는 배정 중이 아니다', () => {
    expect(isCoopAssigningRoles(COOP_STEP.INVITE)).toBe(false);
    expect(isCoopAssigningRoles(COOP_STEP.MISSION)).toBe(false);
    expect(isCoopAssigningRoles(COOP_STEP.COMPLETE)).toBe(false);
  });

  it('단계를 모르면 배정 중으로 보지 않는다 — 모르는 것을 근거로 버튼을 잠그지 않는다', () => {
    expect(isCoopAssigningRoles(null)).toBe(false);
    expect(isCoopAssigningRoles(undefined)).toBe(false);
  });
});

describe('coopScreenAdvance', () => {
  it('초대 화면은 3단계가 되어야 재료 찾기로 간다 — 2단계에서는 제자리다', () => {
    expect(coopScreenAdvance('invite', COOP_STEP.ROLE_ASSIGNMENT)).toBeNull();
    expect(coopScreenAdvance('invite', COOP_STEP.MISSION)).toBe('materials');
    expect(coopScreenAdvance('invite', COOP_STEP.COMPLETE)).toBe('complete');
  });

  it('재료 찾기에서 앞으로 갈 수 있는 곳은 완료 화면뿐이다', () => {
    expect(coopScreenAdvance('materials', COOP_STEP.MISSION)).toBeNull();
    expect(coopScreenAdvance('materials', COOP_STEP.COMPLETE)).toBe('complete');
  });

  /**
   * 뒤로 가지 않는 것이 이 함수의 요점이다. 배정 도중에 나간 요청이 뒤늦게 도착해 재료 찾기
   * 화면이 2단계를 읽는 경우가 있는데, 그걸 보고 초대 화면으로 되돌리면 초대 화면은 곧 3단계를
   * 읽고 다시 보낸다 — 두 화면이 서로를 밀어내며 앱이 죽었다(기기에서 확인).
   */
  it('뒤로는 가지 않는다 — 지난 단계를 읽어도 제자리에 머문다', () => {
    expect(coopScreenAdvance('materials', COOP_STEP.INVITE)).toBeNull();
    expect(coopScreenAdvance('materials', COOP_STEP.ROLE_ASSIGNMENT)).toBeNull();
    expect(coopScreenAdvance('complete', COOP_STEP.MISSION)).toBeNull();
    expect(coopScreenAdvance('complete', COOP_STEP.INVITE)).toBeNull();
  });

  it('단계를 모르는 동안에는 움직이지 않는다 — 기본값(초대)에 기대면 3단계 방이 끌려 나간다', () => {
    expect(coopScreenAdvance('materials', null)).toBeNull();
    expect(coopScreenAdvance('materials', undefined)).toBeNull();
    expect(coopScreenAdvance('invite', null)).toBeNull();
  });

  it('계약에 없는 단계로는 화면을 옮기지 않는다 — 초대로 접히므로 앞으로 가는 일이 없다', () => {
    expect(coopScreenAdvance('invite', 99)).toBeNull();
    expect(coopScreenAdvance('materials', 0)).toBeNull();
  });
});

describe('coopRouteForScreen', () => {
  it('각 화면의 expo-router 경로를 준다', () => {
    expect(coopRouteForScreen('invite')).toBe('/mission/together');
    expect(coopRouteForScreen('materials')).toBe('/mission/together-materials');
    expect(coopRouteForScreen('complete')).toBe('/mission/complete');
  });
});

describe('coopHrefForScreen', () => {
  it('진행 화면은 경로만 있으면 된다 — 미션 종류는 경로 자체가 정한다', () => {
    expect(coopHrefForScreen('invite')).toBe('/mission/together');
    expect(coopHrefForScreen('materials')).toBe('/mission/together-materials');
  });

  it("완료 화면에는 mission: 'coop'을 붙인다", () => {
    // 빠뜨리면 resolveMissionType이 문화로 떨어져(constants/mission.ts) 협동 미션을 끝냈는데도
    // 문화 미션 완료 화면이 뜬다 — useEnterCoopRoom이 실제로 그랬다
    expect(coopHrefForScreen('complete')).toEqual({ pathname: '/mission/complete', params: { mission: 'coop' } });
  });
});

describe('shouldPollCoopStatus', () => {
  it('완료 전 단계에서는 계속 폴링한다', () => {
    expect(shouldPollCoopStatus(COOP_STEP.INVITE)).toBe(true);
    expect(shouldPollCoopStatus(COOP_STEP.ROLE_ASSIGNMENT)).toBe(true);
    expect(shouldPollCoopStatus(COOP_STEP.MISSION)).toBe(true);
  });

  it('완료 단계에 도달하면 멈춘다 — 더 볼 변화가 없다', () => {
    expect(shouldPollCoopStatus(COOP_STEP.COMPLETE)).toBe(false);
  });

  it('아직 단계를 모를 때는 폴링한다 — 여기서 멈추면 첫 응답을 영원히 못 받는다', () => {
    expect(shouldPollCoopStatus(null)).toBe(true);
    expect(shouldPollCoopStatus(undefined)).toBe(true);
  });
});

describe('coopPollIntervalMs', () => {
  const FOREGROUND = { foreground: true, rateLimited: false };

  it('진행 중이고 앱이 떠 있으면 2초 간격', () => {
    expect(coopPollIntervalMs(COOP_STEP.MISSION, FOREGROUND)).toBe(COOP_POLL_INTERVAL_MS);
  });

  it('아직 단계를 모를 때도 돈다 — 여기서 멈추면 첫 응답을 영원히 못 받는다', () => {
    expect(coopPollIntervalMs(null, FOREGROUND)).toBe(COOP_POLL_INTERVAL_MS);
    expect(coopPollIntervalMs(undefined, FOREGROUND)).toBe(COOP_POLL_INTERVAL_MS);
  });

  it('완료 단계에서는 멈춘다', () => {
    expect(coopPollIntervalMs(COOP_STEP.COMPLETE, FOREGROUND)).toBe(false);
  });

  it('앱이 포그라운드가 아니면 멈춘다 — 내려 둔 동안 2초마다 요청을 쌓지 않는다', () => {
    expect(coopPollIntervalMs(COOP_STEP.MISSION, { foreground: false, rateLimited: false })).toBe(false);
  });

  it('백그라운드는 단계를 모를 때도 멈춘다 — 포그라운드 여부가 먼저다', () => {
    expect(coopPollIntervalMs(null, { foreground: false, rateLimited: false })).toBe(false);
  });

  it('429를 받은 뒤에는 간격을 늘린다 — 같은 속도로 계속 두드리면 제한만 길어진다', () => {
    expect(coopPollIntervalMs(COOP_STEP.MISSION, { foreground: true, rateLimited: true })).toBe(COOP_POLL_BACKOFF_MS);
  });

  it('백오프 간격이 평소보다 길다', () => {
    expect(COOP_POLL_BACKOFF_MS).toBeGreaterThan(COOP_POLL_INTERVAL_MS);
  });

  it('429여도 완료 단계면 멈춘다 — 늦춰서라도 물을 이유가 없다', () => {
    expect(coopPollIntervalMs(COOP_STEP.COMPLETE, { foreground: true, rateLimited: true })).toBe(false);
  });
});

describe('coopIntroRoute', () => {
  it('미션 id를 문자열 파라미터로 실어 보낸다 — 인트로의 "다시 시작하기"가 이 id로 방을 연다', () => {
    expect(coopIntroRoute(7)).toEqual({ pathname: '/mission/intro', params: { mission: 'coop', missionId: '7' } });
  });

  it('id를 아직 모르면 파라미터 없이 보낸다 — 인트로가 폴백을 쓴다', () => {
    expect(coopIntroRoute(null)).toEqual({ pathname: '/mission/intro', params: { mission: 'coop' } });
    expect(coopIntroRoute(undefined)).toEqual({ pathname: '/mission/intro', params: { mission: 'coop' } });
  });

  it('언제나 협동 인트로로 간다', () => {
    expect(coopIntroRoute(3).pathname).toBe('/mission/intro');
    expect(coopIntroRoute(3).params.mission).toBe('coop');
  });
});

/**
 * "역할을 랜덤으로 정하고 있어요" 안내가 **한 진입에 한 번만** 뜨는지.
 *
 * 실기기에서 두 번 떴다 — 홈의 "이어서 진행"으로 들어오면 초대 화면이 **한 진입에 두 번
 * 마운트되기 때문이다.** `/mission/together?missionId=N`으로 먼저 들어오고, 이어하기 응답이
 * 2단계를 주면 `useEnterCoopRoom`이 파라미터 없는 같은 경로(`/mission/together`)로 갈아 끼워
 * 새 인스턴스가 또 마운트된다. "이미 띄웠다"를 화면 안의 ref로 들고 있으면 그 두 인스턴스가
 * 서로를 모른다.
 *
 * 그래서 판정이 그 근거를 **인자로** 받는다. 화면은 스토어 값(`roleAssignNoticeShown`)을 넘기고,
 * 여기서는 그 값이 마운트를 건너 이어진다는 사실만 재현해 확인한다.
 */
describe('shouldShowRoleAssignNotice', () => {
  it('배정 구간(2단계)이고 아직 안 띄웠으면 띄운다 — 방장·팀원 모두 이 화면에 붙잡히는 구간이다', () => {
    expect(shouldShowRoleAssignNotice(COOP_STEP.ROLE_ASSIGNMENT, false)).toBe(true);
  });

  it('이미 띄웠으면 폴링이 같은 2단계를 반복해도 다시 띄우지 않는다', () => {
    expect(shouldShowRoleAssignNotice(COOP_STEP.ROLE_ASSIGNMENT, true)).toBe(false);
  });

  it('배정 구간이 아니면 띄우지 않는다 — 단계를 모르는 동안(null)도 마찬가지다', () => {
    expect(shouldShowRoleAssignNotice(COOP_STEP.INVITE, false)).toBe(false);
    expect(shouldShowRoleAssignNotice(COOP_STEP.MISSION, false)).toBe(false);
    expect(shouldShowRoleAssignNotice(COOP_STEP.COMPLETE, false)).toBe(false);
    expect(shouldShowRoleAssignNotice(null, false)).toBe(false);
    expect(shouldShowRoleAssignNotice(undefined, false)).toBe(false);
  });

  it('한 진입에 화면이 두 번 마운트돼도 안내는 한 번뿐이다 — 근거가 마운트 밖에 있기 때문이다', () => {
    // 홈의 "이어서 진행"이 만드는 두 마운트. 스토어 플래그 하나를 두 인스턴스가 함께 본다.
    let alreadyShown = false;
    let shownCount = 0;

    // 파라미터를 달고 한 번, 이어하기 응답이 갈아 끼워 또 한 번 — 같은 진입의 두 마운트다
    for (let mount = 1; mount <= 2; mount += 1) {
      if (shouldShowRoleAssignNotice(COOP_STEP.ROLE_ASSIGNMENT, alreadyShown)) {
        shownCount += 1;
        alreadyShown = true;
      }
    }

    expect(shownCount).toBe(1);
  });

  it('심사위원용 모드를 켜도 같다 — 시뮬레이션은 참여자·역할만 덧씌우고 단계는 손대지 않는다', () => {
    for (const enabled of [false, true]) {
      const simulated = simulateCoopStatus(
        {
          missionProgressId: 1,
          missionId: 2,
          missionTitle: '함께 만드는 제주',
          missionProgressStatus: 'IN_PROGRESS',
          currentStep: COOP_STEP.ROLE_ASSIGNMENT,
          participants: [{ participantId: 1, name: '방장', participantRole: 'HOST', participantStatus: 'ACCEPTED' }],
        },
        { acceptedSimIds: [], enabled },
      );

      // 모드가 실제로 갈렸는지 먼저 확인한다 — 갈리지 않았다면 아래 비교가 아무것도 말해 주지 않는다
      expect((simulated.participants ?? []).length).toBe(enabled ? 4 : 1);
      // 그래도 단계는 그대로이고, 안내 판정은 단계와 "이미 띄웠나"만 본다
      expect(simulated.currentStep).toBe(COOP_STEP.ROLE_ASSIGNMENT);

      let alreadyShown = false;
      let shownCount = 0;
      for (let mount = 1; mount <= 2; mount += 1) {
        if (shouldShowRoleAssignNotice(simulated.currentStep, alreadyShown)) {
          shownCount += 1;
          alreadyShown = true;
        }
      }
      expect(shownCount).toBe(1);
    }
  });
});

/**
 * "지금 배정이 돌고 있다"와 "배정이 끊긴 채 멈춰 있다"를 가르는 판정.
 *
 * 서버 단계는 둘 다 2라서 단계만으로는 구분되지 않는다. 그런데 뜻이 정반대다 — 앞은 잠가야 하고
 * (두 번 돌면 역할이 덮어써진다), 뒤는 열어야 한다(잠그면 앞으로 갈 수단이 없어진다).
 * 실기기에서 이어하기가 2단계에서 멈춘 것이 뒤의 경우였다.
 *
 * **시간을 재지 않는다.** "얼마나 지나야 굳은 것인가"에는 답이 없고, 임의의 타이머는 느린 통신에서
 * 멀쩡한 배정을 중단으로 오판한다. 근거는 오직 "이 화면이 배정을 시작했는가"다 — 배정이 정상으로
 * 끝나면 단계가 3이 되므로, 시작한 적 없는 화면이 2단계를 보고 있다면 그 전이는 완료되지 않았다.
 */
describe('coopAssignPhase', () => {
  it('이 기기에서 요청이 나가 있으면 배정 중이다 — 단계가 아직 1이어도 마찬가지다', () => {
    expect(coopAssignPhase(COOP_STEP.INVITE, true)).toBe('assigning');
    expect(coopAssignPhase(COOP_STEP.ROLE_ASSIGNMENT, true)).toBe('assigning');
  });

  it('시작한 적 없는데 2단계면 끊긴 것이다 — 정상으로 끝났다면 3단계여야 한다', () => {
    expect(coopAssignPhase(COOP_STEP.ROLE_ASSIGNMENT, false)).toBe('stalled');
  });

  it('단계를 아는데 배정 구간이 아니면 idle이다', () => {
    expect(coopAssignPhase(COOP_STEP.INVITE, false)).toBe('idle');
    expect(coopAssignPhase(COOP_STEP.MISSION, false)).toBe('idle');
    expect(coopAssignPhase(COOP_STEP.COMPLETE, false)).toBe('idle');
  });

  /**
   * **단계를 모르는 구간이 `'idle'`에 접혀 있던 것이 이번 버그의 뿌리다.**
   *
   * `currentStep`이 null이면 `isCoopAssigningRoles`도 거짓이라, 화면은 그 구간을 1단계로 그렸다 —
   * 수락·거절이 붙고 "다음"이 열린다. 심사위원용 모드에서는 그 구간의 참여자 목록이 폴백
   * (방 생성·이어하기 응답)으로 채워지는데 거기 붙는 가짜는 PENDING이라, 2단계에 굳은 방으로
   * 들어가도 첫 응답 전까지는 **"수락 / 거절"이 달린 1단계 화면**이 보였다.
   */
  it('단계를 아직 모르면 unknown이다 — idle과 갈라야 1단계로 오인하지 않는다', () => {
    expect(coopAssignPhase(null, false)).toBe('unknown');
    expect(coopAssignPhase(undefined, false)).toBe('unknown');
  });

  it('단계를 몰라도 이 기기가 요청을 보냈으면 배정 중이다 — 누른 사실이 서버 응답보다 앞선다', () => {
    expect(coopAssignPhase(null, true)).toBe('assigning');
  });

  it('시간에 의존하지 않는다 — 같은 입력이면 몇 번을 불러도 같은 답이다', () => {
    const first = coopAssignPhase(COOP_STEP.ROLE_ASSIGNMENT, false);
    const later = coopAssignPhase(COOP_STEP.ROLE_ASSIGNMENT, false);
    expect(first).toBe(later);
    expect(first).toBe('stalled');
  });

  it('내가 눌러 배정이 시작되고 실패하면 곧바로 재시도할 수 있는 상태가 된다 — 기다리게 하지 않는다', () => {
    // 누른 직후: 요청이 나가 있다
    expect(coopAssignPhase(COOP_STEP.ROLE_ASSIGNMENT, true)).toBe('assigning');
    // 요청이 실패로 끝났다(화면이 in-flight를 내린다). 단계는 2에 남아 있다.
    expect(coopAssignPhase(COOP_STEP.ROLE_ASSIGNMENT, false)).toBe('stalled');
    // 성공했다면 단계가 3이라 이 화면을 떠난다
    expect(coopAssignPhase(COOP_STEP.MISSION, false)).toBe('idle');
  });

  it('심사위원용 모드와 무관하다 — 시뮬레이션은 단계를 만들지 않는다', () => {
    for (const enabled of [false, true]) {
      const simulated = simulateCoopStatus(
        {
          missionProgressId: 1,
          missionId: 2,
          missionTitle: '함께 만드는 제주',
          missionProgressStatus: 'IN_PROGRESS',
          currentStep: COOP_STEP.ROLE_ASSIGNMENT,
          participants: [{ participantId: 1, name: '방장', participantRole: 'HOST', participantStatus: 'ACCEPTED' }],
        },
        { acceptedSimIds: [], enabled },
      );

      expect((simulated.participants ?? []).length).toBe(enabled ? 4 : 1);
      expect(coopAssignPhase(simulated.currentStep, false)).toBe('stalled');
      expect(coopAssignPhase(simulated.currentStep, true)).toBe('assigning');
    }
  });
});

/**
 * **수락·거절과 "다음"이 같은 게이트를 지난다.**
 *
 * 예전에는 각자 다른 근거를 봤다 — 수락·거절은 "지금 2단계인가", "다음"은 그 위에
 * `canStartCoopMission`의 완화가 따로 얹혀 있었다. 그래서 전이 중에 **한쪽만 열린 화면**이
 * 만들어졌고, 그것이 "재시도를 눌렀더니 수락/거절 1단계가 되는" 증상의 정체였다.
 */
describe('coopInviteActionsOpen', () => {
  it('평소의 초대 단계와 끊긴 2단계에서는 열린다', () => {
    expect(coopInviteActionsOpen('idle', COOP_STEP.INVITE)).toBe(true);
    expect(coopInviteActionsOpen('stalled', COOP_STEP.ROLE_ASSIGNMENT)).toBe(true);
  });

  it('배정이 도는 동안에는 닫힌다 — 다시 누르면 배정이 두 번 돈다', () => {
    expect(coopInviteActionsOpen('assigning', COOP_STEP.ROLE_ASSIGNMENT)).toBe(false);
  });

  it('단계를 모르는 동안에도 닫힌다 — 모르는 단계를 1단계인 척 그리지 않는다', () => {
    expect(coopInviteActionsOpen('unknown', null)).toBe(false);
  });

  /**
   * 배정이 끝나 3단계가 되면 phase는 'idle'로 돌아오지만 화면은 아직 여기 있다 —
   * 옮기는 것이 useEffect라 커밋과 effect 사이에 한 프레임이 그려진다. 그 프레임에서
   * 배정 뒤에 들어온 사람의 수락·거절이 번쩍이면 안 된다.
   */
  it('이 화면의 단계가 지났으면 닫힌다 — 떠나기 직전 한 프레임도 열지 않는다', () => {
    expect(coopInviteActionsOpen('idle', COOP_STEP.MISSION)).toBe(false);
    expect(coopInviteActionsOpen('idle', COOP_STEP.COMPLETE)).toBe(false);
  });
});

/**
 * 헤더 아래 한 줄이 **CTA와 같은 사실을 말하는지.** 버튼만 잠그고 이유를 알리지 않으면
 * 그것도 막다른 길이다(사용자가 2단계에 굳은 방에서 겪은 그대로다).
 */
describe('coopInviteNoticeKind', () => {
  it('재시도가 대기자 때문에 막혔으면 무엇을 해야 하는지 말한다', () => {
    expect(coopInviteNoticeKind('stalled', { canRetryAssign: true, blockedByPending: true })).toBe('pending-review');
  });

  it('재시도가 열려 있으면 중단됐다고만 말한다', () => {
    expect(coopInviteNoticeKind('stalled', { canRetryAssign: true, blockedByPending: false })).toBe('stalled');
  });

  it('팀원에게는 중단을 말하지 않는다 — 되살릴 수단이 없어 불안하기만 하다', () => {
    expect(coopInviteNoticeKind('stalled', { canRetryAssign: false, blockedByPending: true })).toBe('assigning');
    expect(coopInviteNoticeKind('assigning', { canRetryAssign: false, blockedByPending: false })).toBe('assigning');
  });

  it('평소의 초대 단계와 단계를 모르는 구간에서는 준비 완료 안내가 남는다', () => {
    expect(coopInviteNoticeKind('idle', { canRetryAssign: false, blockedByPending: true })).toBe('ready');
    expect(coopInviteNoticeKind('unknown', { canRetryAssign: false, blockedByPending: false })).toBe('ready');
  });
});

/**
 * **초대 화면의 상태 전체를 한 번에 본다** — 사용자가 실기기에서 겪은 순서 그대로.
 *
 * > "심사위원 모드에서 들어갔을 때 처음에 step2 '다시 역할 나누기' 버튼이어서 눌렀더니
 * >  '수락'/'거절' 1단계로 넘어간 후에 갑자기 step2가 진행되고 step3으로 넘어가는 버그"
 *
 * 화면이 실제로 1단계로 **간** 것이 아니다 — 1단계와 2단계는 같은 화면이고(`coopScreenForStep`)
 * 화면 이동은 앞으로만 한다(`coopScreenAdvance`). 같은 초대 화면에서 **수락·거절 UI가 되살아난**
 * 것이고, 그 조건이 "단계를 아직 모른다"였다. 아래 두 함수(`coopAssignPhase` ·
 * `coopInviteActionsOpen`)와 `party.ts`의 명단 판정을 화면과 같은 순서로 엮어 그 구간을 고정한다.
 */
describe('초대 화면의 조작 상태 — 끊긴 2단계와 재시도', () => {
  const host: Participant = { participantId: 1, name: '방장', participantRole: 'HOST', participantStatus: 'ACCEPTED' };
  const ready: Participant = { participantId: 2, name: '팀원', participantRole: 'MEMBER', participantStatus: 'ACCEPTED' };
  const waiting: Participant = { participantId: 3, name: '늦게 온 사람', participantRole: 'MEMBER', participantStatus: 'PENDING' };

  /** 화면(together.tsx)이 렌더마다 계산하는 값들을 그대로 옮긴 것 */
  function screenState(currentStep: number | null, inFlight: boolean, participants: Participant[], me: number | null) {
    const phase = coopAssignPhase(currentStep, inFlight);
    const actionsOpen = coopInviteActionsOpen(phase, currentStep);
    const block = coopStartBlock(participants, me);
    return {
      phase,
      canStart: actionsOpen && block === 'none',
      canRetry: phase === 'stalled' && canStartCoopMission(participants, me),
      reviewable: participants.filter((participant) => canReviewJoinRequest(participant, participants, me, actionsOpen)).map((participant) => participant.participantId),
      notice: coopInviteNoticeKind(phase, { canRetryAssign: phase === 'stalled' && me === host.participantId, blockedByPending: block === 'pending' }),
    };
  }

  it('2단계 고착 + 전원 준비 완료 → 방장에게 재시도가 열린다', () => {
    const state = screenState(COOP_STEP.ROLE_ASSIGNMENT, false, [host, ready], 1);
    expect(state.phase).toBe('stalled');
    expect(state.canStart).toBe(true);
    expect(state.canRetry).toBe(true);
    expect(state.notice).toBe('stalled');
  });

  /**
   * 사용자 확정 규칙: "step2에서 재시도를 하면 그 사이에 다른 사람이 초대되어 들어왔더라도
   * 모두 '준비 완료'가 아니면 '재시도'가 되면 안 돼."
   */
  it('2단계 고착 + 대기자 있음 → 재시도가 막히고, 그 대기자를 처리할 수단은 열려 있다', () => {
    const state = screenState(COOP_STEP.ROLE_ASSIGNMENT, false, [host, ready, waiting], 1);
    expect(state.phase).toBe('stalled');
    expect(state.canStart).toBe(false);
    expect(state.canRetry).toBe(false);
    // 막기만 하면 막다른 길이다 — 무엇을 해야 하는지 말하고, 그 버튼이 그 자리에 있어야 한다
    expect(state.notice).toBe('pending-review');
    expect(state.reviewable).toEqual([waiting.participantId]);
  });

  it('재시도 중에는 수락·거절이 보이지 않는다 — 역할은 누른 시점의 명단으로 나뉜다', () => {
    const state = screenState(COOP_STEP.ROLE_ASSIGNMENT, true, [host, ready, waiting], 1);
    expect(state.phase).toBe('assigning');
    expect(state.reviewable).toEqual([]);
    expect(state.canStart).toBe(false);
    expect(state.notice).toBe('assigning');
  });

  /**
   * 사용자가 본 "1단계로 넘어갔다"의 정체. 화면이 옮겨 간 것이 아니라, 단계를 모르는 구간에서
   * 이 화면이 스스로 1단계처럼 그린 것이다. 지금은 그 구간의 조작이 모두 닫힌다.
   */
  it('단계를 모르는 구간에서는 수락·거절도 "다음"도 열리지 않는다 — 1단계인 척하지 않는다', () => {
    const state = screenState(null, false, [host, waiting], 1);
    expect(state.phase).toBe('unknown');
    expect(state.reviewable).toEqual([]);
    expect(state.canStart).toBe(false);
    expect(state.canRetry).toBe(false);
  });

  it('멤버에게는 어느 경우에도 재시도가 없다', () => {
    for (const [step, inFlight] of [
      [COOP_STEP.ROLE_ASSIGNMENT, false],
      [COOP_STEP.ROLE_ASSIGNMENT, true],
      [COOP_STEP.INVITE, false],
    ] as const) {
      const state = screenState(step, inFlight, [host, ready, waiting], ready.participantId);
      expect(state.canRetry).toBe(false);
      expect(state.canStart).toBe(false);
      expect(state.reviewable).toEqual([]);
    }
  });

  /**
   * **심사위원용 모드의 가짜 팀원이 재시도를 영영 막지 않는다.**
   *
   * 2·3단계 응답에서는 가짜가 전원 ACCEPTED로 붙으므로(coopDevSimulation.ts) 대기자가 되지 않는다.
   * 반대로 **단계를 모르는 구간**에서는 화면이 폴백 목록을 쓰는데 거기서는 가짜가 PENDING이다 —
   * 그 구간이 바로 예전에 "수락 / 거절"이 되살아나던 자리이고, 지금은 `'unknown'`이라 닫힌다.
   */
  it('모드 ON/OFF — 가짜 팀원은 끊긴 2단계에서 재시도를 막지 않는다', () => {
    for (const enabled of [false, true]) {
      const simulated = simulateCoopStatus(
        {
          missionProgressId: 1,
          missionId: 2,
          missionTitle: '함께 만드는 제주',
          missionProgressStatus: 'IN_PROGRESS',
          currentStep: COOP_STEP.ROLE_ASSIGNMENT,
          participants: [host],
        },
        { acceptedSimIds: [], enabled },
      );
      const roster = simulated.participants ?? [];
      expect(roster).toHaveLength(enabled ? 4 : 1);
      expect(pendingParticipants(roster)).toEqual([]);

      const state = screenState(simulated.currentStep, false, roster, host.participantId);
      expect(state.canRetry).toBe(true);
      expect(state.notice).toBe('stalled');

      // 첫 응답 전의 폴백 목록에서는 가짜가 PENDING이다. 그래도 조작은 열리지 않는다.
      const fallback = simulateParticipants([host], [], [], enabled);
      expect(pendingParticipants(fallback)).toHaveLength(enabled ? DEV_SIM_PARTICIPANT_IDS.length : 0);
      const unknown = screenState(null, false, fallback, host.participantId);
      expect(unknown.phase).toBe('unknown');
      expect(unknown.reviewable).toEqual([]);
      expect(unknown.canStart).toBe(false);
    }
  });
});
