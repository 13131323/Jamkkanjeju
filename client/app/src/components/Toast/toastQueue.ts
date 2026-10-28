/**
 * 토스트 큐.
 *
 * 표시 중에 새 메시지가 오면 겹쳐 띄우지 않고 뒤에 쌓는다.
 * 겹치면 방장 승계와 초대 거절이 동시에 발생할 때 하나가 가려진다.
 *
 * 상태 전이만 담은 순수 함수라 타이머·렌더와 분리해 테스트할 수 있다.
 */

/**
 * 토스트 유형.
 * - `dark`: 기본. 어두운 반투명 배경 + 흰 텍스트(협동 미션 step1~3)
 * - `guide`: 보물찾기 step0의 안내 토스트. 흰 반투명 배경 + 어두운 텍스트
 *   (Penpot TreasureHunt_step0 "BottomArea", prompt §9 "toast 컴포넌트에 유형 추가")
 */
export type ToastVariant = 'dark' | 'guide';

export interface ToastItem {
  message: string;
  variant: ToastVariant;
  /** 화면 아래에서 비켜 갈 높이(px). 생략하면 컴포넌트가 CTA 버튼 높이를 쓴다 */
  bottomClearance?: number;
}

export interface ToastQueue {
  /** 지금 화면에 떠 있는 항목. 없으면 null */
  current: ToastItem | null;
  pending: ToastItem[];
}

export const EMPTY_TOAST_QUEUE: ToastQueue = { current: null, pending: [] };

/**
 * 대기줄에 쌓아 둘 최대 개수.
 *
 * 한 항목이 화면에 머무는 시간이 있어서, 대기줄이 길어지면 **행동한 지 한참 뒤에 안내가 뜬다.**
 * 방장이 여러 명을 빠르게 거절하면 마지막 안내가 몇 초 뒤에 나와 어느 사람 얘기인지 알 수 없었다.
 * 넘치면 **오래된 것부터 버린다** — 늦게 도착한 소식이 지금 화면과 더 가깝다.
 */
export const MAX_PENDING_TOASTS = 2;

export function enqueue(state: ToastQueue, item: ToastItem): ToastQueue {
  if (state.current === null) return { current: item, pending: [] };

  const pending = [...state.pending, item];
  return { current: state.current, pending: pending.slice(-MAX_PENDING_TOASTS) };
}

export function dequeue(state: ToastQueue): ToastQueue {
  const [next, ...rest] = state.pending;
  return { current: next ?? null, pending: rest };
}

/**
 * 떠 있는 항목과 대기 중인 항목을 모두 버린다.
 *
 * 토스트는 "띄우고 잊는" 것이 기본이지만, 같은 자리에 다른 안내가 올라오는 순간에는 즉시
 * 사라져야 한다 — 보물찾기에서 반경에 들어서면 step1 시트가 올라오는데, 그때까지 남아 있던
 * 접근 안내 토스트가 시트와 겹쳐 보였다.
 */
export function clear(): ToastQueue {
  return EMPTY_TOAST_QUEUE;
}
