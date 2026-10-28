/** 백엔드 오류 응답의 message만 읽는다. 응답이 없는 네트워크 오류에는 메시지를 만들지 않는다. */
export function getApiErrorMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return null;
  const data = (response as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

const listeners = new Set<(message: string) => void>();
const notified = new WeakSet<object>();
let pending: string[] = [];

/** 웹·앱의 공통 요청 코드가 서버 오류 메시지를 기존 토스트 표시 지점에 전달한다. */
export function notifyApiError(error: unknown): void {
  const message = getApiErrorMessage(error);
  if (message === null || typeof error !== 'object' || error === null || notified.has(error)) return;
  notified.add(error);
  if (listeners.size === 0) pending.push(message);
  else listeners.forEach((listener) => listener(message));
}

/** 공통 토스트로 처리한 오류인지 확인해 화면의 기존 실패 안내가 중복되지 않게 한다. */
export function wasApiErrorNotified(error: unknown): boolean {
  return typeof error === 'object' && error !== null && notified.has(error);
}

/** 루트 토스트가 오류 메시지를 구독한다. 표시 지점 마운트 전 응답도 마운트 후 전달한다. */
export function subscribeApiErrors(listener: (message: string) => void): () => void {
  listeners.add(listener);
  const waiting = pending;
  pending = [];
  waiting.forEach(listener);
  return () => { listeners.delete(listener); };
}
