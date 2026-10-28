'use client';

import { useSyncExternalStore } from 'react';
import { listenFromApp } from '@shared/lib/bridge/utils';

/**
 * 마지막으로 받은 걸음 수를 담아 두는 키.
 *
 * 앱이 STEP_COUNT_UPDATE를 보내기까지 센서 구독이 붙는 한 박자가 걸린다. 예전에는 그 자리를
 * 목업("8,432걸음")으로 채웠는데 실제와 무관한 숫자가 진짜처럼 보였다(사용자 지시로 제거).
 * 직전 값은 **적어도 한 번은 사실이었던 값**이라, 그것으로 받치고 첫 메시지에 갱신한다.
 */
const STEP_COUNT_STORAGE_KEY = 'tamnalog:last-step-count';

/** 마지막으로 알려진 걸음 수. useSyncExternalStore가 읽는 외부 스토어의 전부다 */
let currentSteps: number | null = null;
const listeners = new Set<() => void>();

function readCachedSteps(): number {
  try {
    const stored = Number(window.localStorage.getItem(STEP_COUNT_STORAGE_KEY));
    // 저장된 적 없으면 NaN, 손상된 값이면 음수·실수일 수 있다 — 셋 다 0으로 떨어뜨린다
    return Number.isInteger(stored) && stored >= 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function setSteps(next: number): void {
  if (currentSteps === next) return;
  currentSteps = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // 첫 구독자가 붙을 때 저장값을 올린다. 이후 구독자는 이미 올라온 값을 그대로 본다.
  if (currentSteps === null) currentSteps = readCachedSteps();

  const stopBridge = listenFromApp((message) => {
    if (message.type !== 'STEP_COUNT_UPDATE') return;
    setSteps(message.payload.steps);
    try {
      window.localStorage.setItem(STEP_COUNT_STORAGE_KEY, String(message.payload.steps));
    } catch {
      // 저장 실패는 다음 진입에서 0부터 시작하는 정도의 손해라 삼킨다
    }
  });

  return () => {
    listeners.delete(listener);
    stopBridge();
  };
}

/** 클라이언트 스냅샷. 구독 전에는 아직 저장값을 읽지 않았으므로 0으로 본다 */
function getSnapshot(): number {
  return currentSteps ?? 0;
}

/**
 * 서버 스냅샷. 서버에는 localStorage가 없으니 항상 0이다.
 *
 * useSyncExternalStore가 이 값으로 hydration하고 직후 클라이언트 스냅샷으로 바꿔 그리므로
 * 텍스트 불일치 경고가 없다(useState + effect로 하면 effect 안 setState가 되어 렌더 연쇄가 된다).
 */
function getServerSnapshot(): number {
  return 0;
}

/**
 * 앱이 주기적으로 push하는 걸음 수(STEP_COUNT_UPDATE)를 구독한다.
 *
 * **항상 숫자를 돌려준다.** 메시지가 오기 전에는 직전에 저장해 둔 값, 그것도 없으면 0이다.
 * WebView 밖(일반 브라우저)에서는 영영 메시지가 오지 않으므로 저장값(없으면 0)에 머문다.
 */
export function useStepCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
