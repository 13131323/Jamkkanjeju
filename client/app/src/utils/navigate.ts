import { router, type ImperativeRouter } from 'expo-router';
import { acceptNavigation } from './navigationGate';

/**
 * 연타를 한 번으로 접는 화면 전환 래퍼. **화면 전환은 전부 이걸 쓴다.**
 *
 * router를 직접 쓰면 전역 게이트를 우회하므로, 새 화면을 추가할 때도 router 대신 이걸 import한다.
 * (게이트가 왜 전역이어야 하는지는 navigationGate.ts 주석 참고)
 *
 * 전환이 버려질 때 화면에는 아무 변화가 없어야 한다 — disabled나 로딩 표시를 두지 않는 이유다.
 * 사용자 입장에서는 "한 번 눌렀고 한 번 넘어갔다"로 보여야 하고, 두 번째 탭은 없던 일이 된다.
 *
 * expo-router의 다른 메서드(dismiss·navigate 등)는 아직 쓰는 곳이 없어 넣지 않았다.
 * 필요해지면 같은 방식으로 추가한다.
 */
type PushArgs = Parameters<ImperativeRouter['push']>;
type ReplaceArgs = Parameters<ImperativeRouter['replace']>;

export const navigate = {
  push(...args: PushArgs): void {
    if (!acceptNavigation(Date.now())) return;
    router.push(...args);
  },

  replace(...args: ReplaceArgs): void {
    if (!acceptNavigation(Date.now())) return;
    router.replace(...args);
  },

  back(): void {
    if (!acceptNavigation(Date.now())) return;
    router.back();
  },

  /**
   * **서버 응답이 정한 화면**으로 옮긴다. 연타 게이트를 지나지 않는다.
   *
   * 게이트는 사람이 버튼을 두 번 누른 것을 한 번으로 접기 위한 장치다(navigationGate.ts).
   * 그런데 협동 미션은 어느 화면으로 갈지를 **사람이 아니라 서버 응답이** 고른다.
   * 홈의 "이어서 진행"이 `/mission/together`로 들어오고(전환 #1), 그 화면이 곧바로
   * 이어하기 응답의 `currentStep`을 보고 진짜 단계 화면으로 갈아 끼운다(전환 #2).
   * 두 전환 사이에는 요청 한 번뿐이라 간격이 400ms보다 짧기 쉽고, 그러면 #2가 **조용히
   * 버려져** 3단계 방인데도 1단계(초대) 화면에 그대로 남는다. 게다가 그 전환을 부르는
   * effect의 의존성은 `currentStep` 하나라, 단계 값이 더 바뀌지 않으면 다시 시도하지도
   * 않는다 — 화면이 영구히 어긋난 채로 굳는다.
   *
   * 통과 시각을 **기록하지도 않는다.** 기록하면 이 전환 직후 사용자가 누른 첫 탭이 대신
   * 버려져 같은 문제가 자리만 옮긴다. 게이트가 세야 하는 것은 사람이 만든 전환뿐이다.
   *
   * 사람이 누른 버튼에서는 쓰지 않는다 — 그쪽은 위의 push/replace가 맞다.
   */
  pushProgrammatic(...args: PushArgs): void {
    router.push(...args);
  },

  replaceProgrammatic(...args: ReplaceArgs): void {
    router.replace(...args);
  },
};
