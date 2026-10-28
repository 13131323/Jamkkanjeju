'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { JUDGE_MODE_GLOBAL, parseInjectedJudgeMode } from '@packages/shared';
import { setJudgeAuthEnabled } from '@shared/api/auth/judgeToken';
import { sendToApp } from '@shared/lib/bridge/utils';

/**
 * 심사위원용 모드 — 빌드를 다시 하지 않고 화면에서 직접 켜는 제주 고정 스위치.
 *
 * 홈 단축 버튼 행(방명록 왼쪽)의 "모드변경" 열쇠 아이콘을 눌러 코드를 입력하면 켜진다
 * (features/judge-mode). 예전에는 하단 마스코트를 3초 꾹 눌러 토글했는데, 코드 없이 켜지는
 * 제스처라 실수로 밟을 수 있었고 심사위원 토큰을 받을 통로도 없었다.
 *
 * 값은 **web이 들고 앱에 알려 준다**(app/src/store/judgeMode.ts) — 양쪽이 각자 저장하면
 * 상태가 갈라진다. localStorage에 남기는 이유: 홈이 아닌 화면에는 켤 UI가 없고 WebView가
 * 새로 열리기도 하므로, 메모리에만 두면 홈을 벗어나는 순간 꺼진다.
 */

/** 브라우저에 남기는 키. 켜짐만 `'true'`로 적고, 그 외 값은 전부 꺼진 것으로 본다 */
const JUDGE_MODE_STORAGE_KEY = 'tamnalog:judge-mode';

type JudgeModeState = {
  enabled: boolean;
  /**
   * 저장값 되살리기(useJudgeModeHydration)가 끝났는지. 저장값이 없어 꺼진 채로 확정된 경우도
   * 포함해서 true다 — "복원할 값이 없었다"도 복원이 끝난 상태이지 아직 모르는 상태가 아니다.
   *
   * 계정을 타는 조회(useHomeData 등)가 이 값을 기다리는 이유는 useJudgeModeHydration 주석 참고.
   */
  isHydrated: boolean;
  /** 켜고 끄면서 브라우저에도 남긴다. 돌려주는 값은 바뀐 뒤의 상태 */
  toggle: () => boolean;
  /** 코드 입장처럼 "켜기"만 필요한 경로용. toggle과 달리 현재 상태를 보지 않는다 */
  enable: () => void;
  /** 되돌리기용. 끄는 데는 코드를 요구하지 않는다 — 기본 모드로 돌아가는 것은 위험하지 않다 */
  disable: () => void;
};

/**
 * localStorage에서 읽은 원시값을 켜짐/꺼짐으로 접는다.
 *
 * `persist`가 켜짐만 `'true'`로 적으므로 그 외(널·`'false'`·손상된 값)는 전부 꺼짐이다 —
 * 저장 자체가 실패했거나 아직 한 번도 저장한 적 없는 경우를 안전한 쪽(꺼짐)으로 접는다.
 */
export function parseStoredJudgeMode(raw: string | null): boolean {
  return raw === 'true';
}

/**
 * 앱이 문서 실행 전에 심어 둔 값(`window.__TAMNALOG_JUDGE_MODE__`). 앱 밖(브라우저)이면 null.
 *
 * **모드의 보관은 앱이 한다.** localStorage는 이 WebView 인스턴스가 예전에 남긴 값이라
 * 앱이 들고 있는 값보다 낡을 수 있다 — 앱을 지웠다 깔거나 WebView 저장소가 비워진 경우가 그렇다.
 * 그래서 주입값이 있으면 그쪽이 이긴다(packages/shared의 JUDGE_MODE_GLOBAL 주석).
 *
 * null과 false를 구분해 돌려주는 것이 요점이다. 앱이 낡아 전역을 아예 심지 않는 경우(null)에
 * 꺼짐으로 접어 버리면 저장값이 있어도 무시하게 된다.
 */
function readInjectedJudgeMode(): boolean | null {
  if (typeof window === 'undefined') return null;

  const raw = (window as unknown as Record<string, unknown>)[JUDGE_MODE_GLOBAL];
  if (raw === undefined) return null;

  return parseInjectedJudgeMode(raw);
}

function persist(enabled: boolean): void {
  // localStorage는 시크릿 모드·저장 차단 설정에서 접근 자체가 던진다. 모드는 켜지되
  // 다음 진입에서 잊히는 정도의 손해라, 실패를 삼키고 진행한다.
  try {
    window.localStorage.setItem(JUDGE_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // 저장 실패는 이 세션에서만 유지되는 것으로 감수한다
  }
}

// 초기값은 **항상 꺼짐**이다. 서버 렌더에는 localStorage가 없으므로 저장값을 여기서 읽으면
// 서버/클라이언트 첫 렌더가 어긋나 hydration 경고가 난다. 저장값은 useJudgeModeHydration이
// 마운트 뒤에 되살리고, 그때 isHydrated도 함께 true가 된다.
export const useJudgeModeStore = create<JudgeModeState>((set, get) => ({
  enabled: false,
  isHydrated: false,
  toggle: () => {
    const next = !get().enabled;
    persist(next);
    set({ enabled: next });
    return next;
  },
  enable: () => {
    persist(true);
    set({ enabled: true });
  },
  disable: () => {
    persist(false);
    set({ enabled: false });
  },
}));

/**
 * 모드 상태를 axios 인터셉터에 흘려보낸다.
 *
 * 인터셉터는 동기 함수라 훅을 쓸 수 없고, shared는 FSD 상 entities를 import할 수 없다.
 * 그래서 값을 아는 이쪽(entities)이 shared의 장치에 밀어 넣는다 —
 * 스토어 하나가 주인이고 저장 키가 두 곳으로 갈라지지 않는다.
 *
 * 모듈 평가 시점에 한 번 맞춰 두고(초기값 꺼짐), 이후 변경은 구독으로 따라간다.
 * 되살리기(useJudgeModeHydration)도 setState를 거치므로 이 구독에 걸린다.
 */
// **첫 요청부터 올바른 계정으로 나가게 한다.** 스토어 초기값은 SSR 때문에 항상 꺼짐이지만,
// 이 플래그는 마크업이 아니라 Authorization과 쿼리 키 해시만 정하므로(auth/judgeToken.ts,
// query/accountScopedHash.ts) 주입값을 바로 반영해도 하이드레이션이 깨지지 않는다.
// 둘을 같은 값으로 두는 것이 중요하다 — 갈리면 심사위원 토큰으로 받은 응답이 일반 계정 칸에 들어간다.
setJudgeAuthEnabled(readInjectedJudgeMode() ?? useJudgeModeStore.getState().enabled);
useJudgeModeStore.subscribe((state) => {
  setJudgeAuthEnabled(state.enabled);
});

/*
 * 모드가 바뀔 때 **캐시를 버리지 않는다.**
 *
 * 예전에는 `resetQueries()`로 통째로 비웠다. 토큰은 요청 시점에 계산돼 되돌릴 것이 없지만
 * (shared/api/auth/judgeToken.ts), 응답 캐시는 남아서 "심사위원 계정이 그대로"로 보였기 때문이다.
 * 그 대가로 모드를 바꿀 때마다 홈 전체를 다시 받아야 했고, 되돌아올 때도 같은 대기가 반복됐다
 * (사용자 지적: 전환이 너무 느려 오히려 UX가 나쁘다).
 *
 * 지금은 **쿼리 키 해시에 계정을 섞어** 두 모드의 응답이 애초에 다른 칸에 들어간다
 * (shared/api/query/accountScopedHash.ts). 섞일 수 없으니 버릴 이유도 없고, 한 번씩 다녀온
 * 뒤로는 전환이 캐시 적중으로 끝난다.
 *
 * 직전 주소(localStorage)도 버리지 않는다. 한 번 버려 봤는데 더 나빠졌다(사용자 확인) —
 * 모드를 끄면 상단 주소가 자리표시로 남은 채 앱 재시작 전까지 채워지지 않았다. 이유는 그 값이
 * 아니라 **좌표에 있다**: `resolveCurrentCoords`가 null을 주면 `useCurrentAddress`는
 * `enabled: coords !== null`이라 조회를 시작조차 하지 않는다. 고칠 자리는 좌표 쪽이다.
 */

/**
 * 훅 밖(effect 안에서 스토어를 한 번만 읽는 곳 등)에서 쓰는 비반응형 조회.
 *
 * 반응형이 필요하면 `useForcedJejuCoords()`(forcedLocation.ts)를 쓴다.
 */
export function isJudgeModeEnabled(): boolean {
  return useJudgeModeStore.getState().enabled;
}

/**
 * 저장된 값을 스토어로 되살린다. **루트(Providers)에서 한 번만** 부른다.
 *
 * 모드의 효과(제주 고정)는 지도·주소 등 모든 화면에 걸리므로 되살리기도 루트가 해야 한다.
 * 다만 **앱에 알리는 일은 여기서 하지 않는다** — useJudgeModeAppSync 주석 참고.
 *
 * **끝났음을 `isHydrated`로도 알린다.** React는 자식 effect를 부모(Providers)보다 먼저 돌리므로,
 * 이 훅이 돌기 전에 이미 홈의 계정 스코프 조회(useHomeData 등)가 `enabled=false` 기준으로
 * 한 번 나갈 수 있다 — 저장값이 켜짐이면 그 응답은 일반 계정 것이라 금방 심사위원 계정 응답으로
 * 덮이면서 "깜빡이며 모드가 바뀌는" 것처럼 보였다. 그 조회들이 `isHydrated`가 참이 될 때까지
 * 기다리면 처음부터 올바른 계정으로만 한 번 나간다.
 */
export function useJudgeModeHydration(): void {
  useEffect(() => {
    const injected = readInjectedJudgeMode();
    if (injected !== null) {
      // 앱이 준 값이 이긴다. localStorage에도 같은 값을 적어 두 저장소가 갈라지지 않게 한다 —
      // 앱이 낡은 버전으로 되돌아가 전역을 심지 않게 되면 그때는 이 값이 폴백이 된다.
      persist(injected);
      useJudgeModeStore.setState({ enabled: injected, isHydrated: true });
      return;
    }

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(JUDGE_MODE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    useJudgeModeStore.setState({ enabled: parseStoredJudgeMode(stored), isHydrated: true });
  }, []);
}

/** 계정 스코프 조회가 `enabled` 조건에 섞어 쓰는 훅 — useJudgeModeHydration 주석 참고 */
export function useIsJudgeModeHydrated(): boolean {
  return useJudgeModeStore((s) => s.isHydrated);
}

/**
 * 모드를 앱에 알린다. **홈에서만** 부른다.
 *
 * 루트(Providers)에 두면 모든 web 라우트가 보내고 앱의 WebView 6개가 전부 받는다. 정작 쓰는
 * 곳은 홈 하나뿐인데, 앱 스키마가 낡으면 나머지 5개가 각자 검증 실패를 기록해 한 번의 토글이
 * 6배의 오류가 된다 — 브릿지 메시지는 필요한 화면에서만 보낸다.
 *
 * 홈만으로 충분한 근거: 모든 미션·상세 화면은 홈을 거쳐 열리고, 앱 스토어는 실행 수명 동안 값을 유지한다.
 */
export function useJudgeModeAppSync(): void {
  const enabled = useJudgeModeStore((s) => s.enabled);
  const isHydrated = useJudgeModeStore((s) => s.isHydrated);

  /**
   * **되살리기가 끝나기 전에는 보내지 않는다.**
   *
   * 예전에는 초기값(꺼짐)이 먼저 나가고 되살리기 직후 켜짐이 한 번 더 갔다. 앱 스토어의 초기값도
   * 꺼짐이던 시절에는 앞의 한 번이 아무것도 바꾸지 않았지만, 두 가지가 달라졌다.
   *
   * 1. 이제 **앱이 모드를 보관한다**(app/src/services/judgeModePersistence.ts). 앱은 켜짐으로
   *    시작하는데 이 훅이 꺼짐을 먼저 보내면 앱을 껐다가 한 틱 뒤 다시 켜는 꼴이 된다 —
   *    그 사이 저장값까지 꺼짐으로 덮인다.
   * 2. 앱은 값이 실제로 바뀐 회차에 `resetQueries()`를 돈다(useHomeBridge). 꺼짐 → 켜짐이
   *    한 번씩 가면 토글한 적이 없는데도 콜드 스타트마다 앱 캐시가 통째로 비워졌다.
   *
   * 기다리면 통지가 **한 번만**, 그것도 올바른 값으로 나간다.
   */
  useEffect(() => {
    if (!isHydrated) return;
    sendToApp({ type: 'JUDGE_MODE_UPDATE', payload: { enabled } });
  }, [enabled, isHydrated]);
}
