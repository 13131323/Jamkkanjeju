'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
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
  /** 켜고 끄면서 브라우저에도 남긴다. 돌려주는 값은 바뀐 뒤의 상태 */
  toggle: () => boolean;
  /** 코드 입장처럼 "켜기"만 필요한 경로용. toggle과 달리 현재 상태를 보지 않는다 */
  enable: () => void;
  /** 되돌리기용. 끄는 데는 코드를 요구하지 않는다 — 기본 모드로 돌아가는 것은 위험하지 않다 */
  disable: () => void;
};

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
// 마운트 뒤에 되살린다.
export const useJudgeModeStore = create<JudgeModeState>((set, get) => ({
  enabled: false,
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
setJudgeAuthEnabled(useJudgeModeStore.getState().enabled);
useJudgeModeStore.subscribe((state) => setJudgeAuthEnabled(state.enabled));

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
 */
export function useJudgeModeHydration(): void {
  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(JUDGE_MODE_STORAGE_KEY) === 'true';
    } catch {
      stored = false;
    }
    if (stored) useJudgeModeStore.setState({ enabled: true });
  }, []);
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

  // 값이 바뀔 때마다 알린다. 켜 둔 채로 다시 열면 초기값(꺼짐)이 먼저 나가고 되살리기 직후에
  // 켜짐이 한 번 더 가는데, 앱 스토어의 초기값도 꺼짐이라 앞의 한 번은 아무것도 바꾸지 않는다.
  useEffect(() => {
    sendToApp({ type: 'JUDGE_MODE_UPDATE', payload: { enabled } });
  }, [enabled]);
}
