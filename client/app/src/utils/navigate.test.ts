import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * expo-router의 `router`는 네이티브 네비게이션에 붙어 있어 테스트에서 그대로 부를 수 없다.
 * 여기서 보고 싶은 것은 라우팅 결과가 아니라 **연타 게이트를 지났는지 아닌지**뿐이라,
 * router를 스파이로 갈아 끼우고 호출 횟수만 센다.
 *
 * `ImperativeRouter` 타입은 값이 아니라 타입이므로 mock에서 만들 필요가 없다(type import).
 */
vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
}));

const { router } = await import('expo-router');
const { navigate } = await import('./navigate');
const { resetNavigationGate } = await import('./navigationGate');

describe('navigate', () => {
  beforeEach(() => {
    resetNavigationGate();
    vi.mocked(router.push).mockClear();
    vi.mocked(router.replace).mockClear();
  });

  it('사람이 만든 전환은 연타 게이트를 지난다 — 두 번째는 버려진다', () => {
    navigate.push('/home');
    navigate.replace('/home');

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledTimes(0);
  });

  /**
   * 이 테스트가 막는 회귀가 버그 그 자체다.
   *
   * 홈의 "이어서 진행"이 `/mission/together`로 들어오고(전환 1), 그 화면이 이어하기 응답의
   * `currentStep`을 보고 곧바로 단계 화면으로 갈아 끼운다(전환 2). 둘 사이는 요청 한 번뿐이라
   * 400ms 게이트에 걸렸고, 버려진 전환을 다시 시도하는 곳이 없어 3단계 방인데도 초대 화면에
   * 남았다("방장이 변경되었어요" 토스트만 뜨고 단계는 1단계 그대로).
   */
  it('서버 응답이 정한 전환은 게이트를 지나지 않는다 — 직전 전환 바로 뒤여도 반드시 나간다', () => {
    navigate.push('/mission/together');
    navigate.replaceProgrammatic('/mission/together-materials');

    expect(router.replace).toHaveBeenCalledWith('/mission/together-materials');
  });

  it('pushProgrammatic도 같다', () => {
    navigate.push('/mission/together');
    navigate.pushProgrammatic('/mission/together-materials');

    expect(router.push).toHaveBeenCalledTimes(2);
  });

  /**
   * 통과 시각을 기록하지 않는다.
   *
   * 기록하면 서버가 옮겨 준 화면에서 사용자가 누른 **첫 탭**이 대신 버려져,
   * 같은 문제가 자리만 옮긴다. 게이트가 세야 하는 것은 사람이 만든 전환뿐이다.
   */
  it('게이트의 기준 시각을 갱신하지 않는다 — 직후의 사용자 탭이 대신 버려지면 안 된다', () => {
    navigate.replaceProgrammatic('/mission/together-materials');
    navigate.push('/mission/complete');

    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
