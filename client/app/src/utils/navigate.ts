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
 * expo-router의 나머지 메서드(dismiss·navigate 등)는 아직 쓰는 곳이 없어 넣지 않았다.
 * 필요해지면 같은 방식으로 추가한다.
 */
type PushArgs = Parameters<ImperativeRouter['push']>;
type ReplaceArgs = Parameters<ImperativeRouter['replace']>;
type DismissToArgs = Parameters<ImperativeRouter['dismissTo']>;

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
   * **스택에 이미 있는 화면으로 되돌아간다.** 없으면 현재 화면을 그 화면으로 갈아 끼운다.
   *
   * `replace`와의 차이가 결과를 통째로 가른다. `replace`는 같은 이름의 화면이 스택에 이미 있어도
   * **언제나 새 인스턴스를 만든다**(expo-router가 REPLACE로 넘기고 StackRouter가 새 key로 라우트를
   * 만든다). 그래서 미션 완료의 "홈으로 이동하기"가 `replace('/home')`이던 동안 루트 스택은
   * `[home, mission]` → `[home, home]`이 됐다. 아래에 깔린 첫 home은 **언마운트되지 않아**
   * WebView 한 장·위치 구독·GPS 타이머가 미션을 끝낼 때마다 한 벌씩 늘었고, 홈 리셋은 스토어
   * 하나로 걸리므로(store/homeReset.ts) 보이지도 않는 옛 home의 WebView까지 **같이 다시 로드돼**
   * 눈에 보이는 홈이 그만큼 늦게 떴다.
   *
   * POP_TO는 같은 이름의 라우트를 아래에서 찾아 **그 인스턴스로 되돌아가고**(위에 쌓인 화면은
   * 버린다), 못 찾으면 현재 라우트를 새 화면으로 교체한다. 딥링크로 곧장 들어와 홈이 스택에 없는
   * 경우에도 `replace`와 같은 결과가 되므로 호출부가 갈래를 따로 둘 필요가 없다.
   */
  dismissTo(...args: DismissToArgs): void {
    if (!acceptNavigation(Date.now())) return;
    router.dismissTo(...args);
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
