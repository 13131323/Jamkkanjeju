import { describe, expect, it } from 'vitest';
import {
  INITIAL_WEBVIEW_RECOVERY_STATE,
  MAX_RENDERER_RECREATE_ATTEMPTS,
  nextWebViewRecoveryState,
  resolveRendererLossAction,
  type WebViewRecoveryEvent,
  type WebViewRecoveryState,
} from './webViewRecoveryPolicy';

/** 이벤트를 차례로 먹인 뒤 마지막 상태를 돌려준다 */
function run(events: WebViewRecoveryEvent[], maxAttempts?: number, from: WebViewRecoveryState = INITIAL_WEBVIEW_RECOVERY_STATE): WebViewRecoveryState {
  return events.reduce((state, event) => nextWebViewRecoveryState(state, event, maxAttempts), from);
}

const LOST: WebViewRecoveryEvent = { type: 'renderer-lost' };
const LOADED: WebViewRecoveryEvent = { type: 'load-succeeded' };

describe('resolveRendererLossAction', () => {
  it('허용 횟수(2회)까지는 다시 만든다 — 시스템이 메모리를 회수하려고 죽인 경우가 대다수라 대개 성공한다', () => {
    expect(resolveRendererLossAction(0)).toBe('recreate');
    expect(resolveRendererLossAction(1)).toBe('recreate');
  });

  it('3회째부터는 포기한다 — 일시적 압박이 아니라 지속 상태이고, 계속 띄우면 메모리를 더 먹으며 루프가 된다', () => {
    expect(resolveRendererLossAction(MAX_RENDERER_RECREATE_ATTEMPTS)).toBe('give-up');
    expect(resolveRendererLossAction(MAX_RENDERER_RECREATE_ATTEMPTS + 1)).toBe('give-up');
  });

  it('maxAttempts 0이면 곧바로 포기한다 — 캐시 워밍용 오프스크린 WebView가 쓰는 설정', () => {
    expect(resolveRendererLossAction(0, 0)).toBe('give-up');
  });
});

describe('nextWebViewRecoveryState', () => {
  it('1회차 사망: 다시 만든다 — generation이 올라 새 네이티브 뷰가 생긴다', () => {
    expect(run([LOST])).toEqual({ attempts: 1, hasGivenUp: false, generation: 1 });
  });

  it('2회차 사망: 아직 다시 만든다 — 복귀 직후 메모리가 빠듯한 경우를 덮는다', () => {
    expect(run([LOST, LOST])).toEqual({ attempts: 2, hasGivenUp: false, generation: 2 });
  });

  it('3회차 사망: 포기한다 — generation을 올리지 않아 새 WebView를 만들지 않는다', () => {
    expect(run([LOST, LOST, LOST])).toEqual({ attempts: 2, hasGivenUp: true, generation: 2 });
  });

  it('포기한 뒤 늦게 도착한 사망 이벤트는 아무것도 바꾸지 않는다', () => {
    const givenUp = run([LOST, LOST, LOST]);
    expect(nextWebViewRecoveryState(givenUp, LOST)).toBe(givenUp);
  });

  it('성공 로드가 카운터를 0으로 되돌려 다시 2회를 쓸 수 있다 — 이 리셋이 없으면 오래 켜 둔 화면이 결국 영구 오류 화면이 된다', () => {
    const recovered = run([LOST, LOST, LOADED]);
    expect(recovered.attempts).toBe(0);

    expect(run([LOST, LOST], undefined, recovered).hasGivenUp).toBe(false);
    expect(run([LOST, LOST, LOST], undefined, recovered).hasGivenUp).toBe(true);
  });

  it('성공 로드는 generation을 건드리지 않는다 — 멀쩡한 WebView를 다시 만들면 안 된다', () => {
    expect(run([LOST, LOADED]).generation).toBe(1);
  });

  it('바뀔 것이 없는 성공 로드는 같은 객체를 돌려준다 — 리렌더를 만들지 않기 위해서다', () => {
    const state = run([LOST, LOADED]);
    expect(nextWebViewRecoveryState(state, LOADED)).toBe(state);
  });

  it('수동 재시도는 포기 상태를 풀고 WebView를 새로 만든다', () => {
    const retried = run([LOST, LOST, LOST, { type: 'manual-retry' }]);
    expect(retried).toEqual({ attempts: 0, hasGivenUp: false, generation: 3 });
  });

  it('포기하지 않은 상태의 수동 재시도는 무시한다 — 네트워크 오류 화면이 같은 버튼을 공유한다', () => {
    const state = run([LOST]);
    expect(nextWebViewRecoveryState(state, { type: 'manual-retry' })).toBe(state);
  });

  it('복구와 무관한 재생성 요청(홈 리셋)은 generation만 올리고 재시도 횟수는 건드리지 않는다', () => {
    expect(run([LOST, { type: 'recreate-requested' }])).toEqual({ attempts: 1, hasGivenUp: false, generation: 2 });
  });

  it('maxAttempts 0이면 첫 사망에서 곧바로 포기한다 — 오프스크린 프리페치는 재시도가 메모리 압박을 키울 뿐이다', () => {
    expect(run([LOST], 0)).toEqual({ attempts: 0, hasGivenUp: true, generation: 0 });
  });

  it('didCrash는 동작을 가르지 않는다 — 복구 수단이 재생성 하나뿐이라 분기할 이유가 없고, 값은 로그로만 쓴다', () => {
    const killedBySystem = run([{ type: 'renderer-lost', didCrash: false }]);
    const realCrash = run([{ type: 'renderer-lost', didCrash: true }]);
    // iOS(onContentProcessDidTerminate)에는 이 값 자체가 없어 null로 온다
    const ios = run([{ type: 'renderer-lost', didCrash: null }]);

    expect(killedBySystem).toEqual(realCrash);
    expect(killedBySystem).toEqual(ios);
    expect(
      run([
        { type: 'renderer-lost', didCrash: true },
        { type: 'renderer-lost', didCrash: true },
        { type: 'renderer-lost', didCrash: true },
      ]).hasGivenUp,
    ).toBe(true);
  });
});
