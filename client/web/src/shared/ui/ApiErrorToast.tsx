'use client';

import { useCallback, useEffect, useState } from 'react';
import { subscribeApiErrors } from '@packages/shared';
import { Toast } from './Toast';

/** 모든 API의 서버 오류 메시지를 기존 하단 토스트로 순서대로 표시한다. */
export function ApiErrorToast() {
  const [messages, setMessages] = useState<{ id: number; message: string }[]>([]);
  const [sequence] = useState(() => ({ value: 0 }));
  useEffect(() => subscribeApiErrors((message) => {
    const id = ++sequence.value;
    setMessages((previous) => [...previous, { id, message }]);
  }), [sequence]);
  const onDone = useCallback(() => setMessages((previous) => previous.slice(1)), []);
  const current = messages[0];
  return current ? <Toast key={current.id} message={current.message} onDone={onDone} /> : null;
}
