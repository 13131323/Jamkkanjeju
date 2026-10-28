/**
 * WebView 렌더러 프로세스가 사라졌을 때 **어떻게 복구할지**를 정하는 규칙.
 *
 * 렌더 없이 검증하려고 훅에서 떼어 놓았다(이 레포에는 RN 컴포넌트 렌더 테스트 인프라가 없다).
 * 실제 배선은 `useWebViewRecovery.ts`가 한다.
 *
 * ## 무슨 일이 일어나는가
 *
 * 안드로이드는 메모리가 모자라면 **앱이 아니라 WebView의 렌더러 프로세스만** 골라 죽인다.
 * `react-native-webview@13.16.1`의 `RNCWebViewClient.onRenderProcessGone`은 그 사실을
 * `onRenderProcessGone` 이벤트(payload: `didCrash`)로 JS에 넘긴 뒤 **`true`를 돌려준다** —
 * 네이티브가 `false`를 주면 앱 프로세스가 함께 죽으므로 라이브러리가 앱을 살려 두는 쪽을 택했다
 * (해당 파일의 "returning false would crash the app" 주석).
 *
 * 그래서 이 이벤트를 **아무도 받지 않으면 앱은 멀쩡한데 WebView 자리만 빈 흰 화면으로 남는다.**
 * 사용자가 할 수 있는 일은 앱 재시작뿐이었다.
 *
 * ## 왜 `reload()`가 아니라 재생성인가
 *
 * 죽은 것은 문서가 아니라 **렌더러 프로세스**다. `reload()`는 사라진 렌더러에게 말을 거는 셈이라
 * 듣지 않고, 죽은 인스턴스를 계속 건드리면 크래시가 될 수 있다. 유일한 복구는 네이티브 뷰를
 * 통째로 새로 만드는 것이고, React에서 그건 **`key`를 바꾸는 것**이다 — key가 같으면 React는
 * 같은 네이티브 뷰를 재사용한다. `generation`이 그 key다.
 *
 * ## 왜 2회인가
 *
 * 이 이벤트의 대다수는 `didCrash: false`, 즉 **시스템이 메모리를 회수하려고 죽인 것**이다.
 * 사용자가 앱으로 돌아온 시점에는 대개 메모리가 확보돼 있어 첫 재생성이면 대개 성공한다.
 * 2회째는 복귀 직후 메모리가 아직 빠듯한 경우를 덮는다. **3회째부터는 일시적인 압박이 아니라
 * 지속 상태**로 봐야 하고, 그 상태에서 계속 새 렌더러를 띄우면 메모리를 더 먹으며 루프가 된다.
 * 그때는 포기하고 오류 화면 + 수동 재시도로 사용자에게 넘긴다.
 *
 * 지연(setTimeout)은 두지 않는다. 렌더러 사망은 시간이 아니라 메모리에 달린 일이라 기다린다고
 * 메모리가 돌아온다는 보장이 없고, 근거 없는 상수만 하나 늘어난다.
 *
 * ## 왜 성공 로드 시 0으로 되돌리는가 (재시도 횟수보다 이쪽이 중요하다)
 *
 * 횟수를 앱 수명 전체로 누적하면, 홈처럼 오래 켜 두는 화면이 **몇 시간에 한 번씩** 드물게 죽는
 * 상황에서 결국 카운터가 소진된다. 그러면 메모리가 넉넉한데도 영구 오류 화면이 된다.
 * 한 번이라도 정상 로드됐다면 직전의 사망은 이미 회복된 사건이므로 세지 않는다 —
 * 이 카운터가 세는 것은 누적 실패가 아니라 **연속 실패**다.
 *
 * ## didCrash로 동작을 가르지 않는 이유
 *
 * `didCrash: true`는 렌더러가 실제로 크래시한 경우다. 그래도 복구 수단은 재생성 하나뿐이고,
 * 페이지 자체가 원인이라 반복 크래시하더라도 위의 2회 상한이 이미 루프를 끊는다. 분기해서 얻을
 * 것이 없으므로 **로그에만 남긴다** — 나중에 "시스템이 죽인 것"과 "진짜 크래시"를 갈라 보기 위해서다.
 * 이벤트에 값은 실어 두되(`renderer-lost.didCrash`) 전이 규칙은 그 값을 읽지 않는다.
 */

/** 마지막 성공 로드 이후 허용하는 자동 재생성 횟수. 근거는 파일 상단 "왜 2회인가" */
export const MAX_RENDERER_RECREATE_ATTEMPTS = 2;

/** 렌더러가 사라졌을 때 할 일 */
export type RendererLossAction = 'recreate' | 'give-up';

/**
 * 렌더러가 또 사라졌다. 다시 만들 것인가, 포기할 것인가.
 *
 * @param attemptsSinceLastLoad 마지막 성공 로드 이후 이미 다시 만든 횟수
 * @param maxAttempts 허용 횟수. 0이면 곧바로 포기한다(캐시 워밍용 오프스크린 WebView가 쓴다)
 */
export function resolveRendererLossAction(attemptsSinceLastLoad: number, maxAttempts: number = MAX_RENDERER_RECREATE_ATTEMPTS): RendererLossAction {
  return attemptsSinceLastLoad < maxAttempts ? 'recreate' : 'give-up';
}

export interface WebViewRecoveryState {
  /** 마지막 성공 로드 이후 자동으로 다시 만든 횟수 */
  attempts: number;
  /** 자동 복구를 포기했다. 호출부는 WebView 대신 오류 화면을 그린다 */
  hasGivenUp: boolean;
  /** WebView의 `key`. 값이 바뀌면 React가 옛 인스턴스를 버리고 새 네이티브 뷰를 만든다 */
  generation: number;
}

export const INITIAL_WEBVIEW_RECOVERY_STATE: WebViewRecoveryState = { attempts: 0, hasGivenUp: false, generation: 0 };

export type WebViewRecoveryEvent =
  /**
   * 렌더러 프로세스가 사라졌다(Android `onRenderProcessGone` / iOS `onContentProcessDidTerminate`).
   *
   * `didCrash`는 **로그 전용**이다 — 전이 규칙은 이 값을 읽지 않는다(파일 상단 "didCrash로
   * 동작을 가르지 않는 이유"). iOS 이벤트에는 이 값이 없어 null로 온다.
   */
  | { type: 'renderer-lost'; didCrash?: boolean | null }
  /** 페이지가 정상적으로 로드됐다. 연속 실패 카운터를 되돌리는 유일한 사건이다 */
  | { type: 'load-succeeded' }
  /** 오류 화면의 "다시 시도". 사용자가 직접 눌렀으므로 카운터를 새로 시작한다 */
  | { type: 'manual-retry' }
  /** 복구와 무관한 이유(홈 리셋 등)로 WebView를 새로 만든다 */
  | { type: 'recreate-requested' };

/**
 * 상태 전이. **변화가 없으면 같은 객체를 그대로 돌려준다** — useReducer가 이 동일성으로
 * 불필요한 리렌더를 건너뛴다(성공 로드는 페이지마다 수시로 들어온다).
 */
export function nextWebViewRecoveryState(state: WebViewRecoveryState, event: WebViewRecoveryEvent, maxAttempts: number = MAX_RENDERER_RECREATE_ATTEMPTS): WebViewRecoveryState {
  switch (event.type) {
    case 'renderer-lost': {
      // 이미 포기해 오류 화면을 띄운 뒤라면 WebView가 떠 있지도 않다. 늦게 도착한 이벤트는 버린다
      if (state.hasGivenUp) return state;

      if (resolveRendererLossAction(state.attempts, maxAttempts) === 'give-up') {
        return { ...state, hasGivenUp: true };
      }

      // generation을 올려야 **새 네이티브 뷰**가 만들어진다(파일 상단 "왜 reload()가 아니라 재생성인가")
      return { attempts: state.attempts + 1, hasGivenUp: false, generation: state.generation + 1 };
    }

    case 'load-succeeded':
      // 포기 상태에서는 WebView가 없으므로 여기로 올 수 없다. hasGivenUp은 건드리지 않는다
      return state.attempts === 0 ? state : { ...state, attempts: 0 };

    case 'manual-retry':
      // 포기하지 않았는데 눌렀다면(예: 네트워크 오류 화면의 같은 버튼) 이 규칙이 관여할 일이 아니다
      return state.hasGivenUp ? { attempts: 0, hasGivenUp: false, generation: state.generation + 1 } : state;

    case 'recreate-requested':
      // 재시도 카운터는 건드리지 않는다. 복구와 무관한 remount라 "연속 실패"와 아무 상관이 없다
      return { ...state, generation: state.generation + 1 };
  }
}
