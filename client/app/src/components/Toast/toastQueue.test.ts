import { describe, expect, it } from 'vitest';
import { dequeue, enqueue, MAX_PENDING_TOASTS, type ToastItem, type ToastQueue } from './toastQueue';

const empty: ToastQueue = { current: null, pending: [] };

/** 테스트 가독성용 — 유형은 기본값(dark)으로 고정한다 */
function item(message: string): ToastItem {
  return { message, variant: 'dark' };
}

describe('enqueue', () => {
  it('비어 있으면 바로 표시한다', () => {
    expect(enqueue(empty, item('방장이 되었어요'))).toEqual({
      current: item('방장이 되었어요'),
      pending: [],
    });
  });

  it('표시 중이면 뒤에 쌓는다', () => {
    // 겹쳐 띄우면 승계와 거절이 동시에 올 때 하나가 가려진다
    const state = enqueue({ current: item('A'), pending: [] }, item('B'));
    expect(state).toEqual({ current: item('A'), pending: [item('B')] });
  });

  it('여러 개가 순서대로 쌓인다', () => {
    let state = enqueue(empty, item('A'));
    state = enqueue(state, item('B'));
    state = enqueue(state, item('C'));
    expect(state).toEqual({ current: item('A'), pending: [item('B'), item('C')] });
  });

  it('유형을 그대로 보존한다', () => {
    const guide: ToastItem = { message: '500m 남았어요', variant: 'guide' };
    expect(enqueue(empty, guide).current).toEqual(guide);
  });
});

describe('dequeue', () => {
  it('대기가 없으면 비운다', () => {
    expect(dequeue({ current: item('A'), pending: [] })).toEqual({ current: null, pending: [] });
  });

  it('다음 것을 앞에서 꺼낸다', () => {
    expect(dequeue({ current: item('A'), pending: [item('B'), item('C')] })).toEqual({
      current: item('B'),
      pending: [item('C')],
    });
  });

  it('빈 상태에서 호출해도 안전하다', () => {
    expect(dequeue(empty)).toEqual(empty);
  });
});

describe('대기줄 상한 — 빠른 연속 동작에서 안내가 늦게 뜨지 않게', () => {
  const item = (message: string): ToastItem => ({ message, variant: 'dark' });

  it('대기줄이 상한을 넘지 않는다', () => {
    let state = enqueue(empty, item('떠 있는 것'));
    for (const name of ['둘째', '셋째', '넷째', '다섯째']) {
      state = enqueue(state, item(name));
    }

    expect(state.pending).toHaveLength(MAX_PENDING_TOASTS);
  });

  it('넘치면 오래된 것부터 버린다 — 늦게 온 소식이 지금 화면과 더 가깝다', () => {
    let state = enqueue(empty, item('떠 있는 것'));
    for (const name of ['버려질 것', '남을 것1', '남을 것2']) {
      state = enqueue(state, item(name));
    }

    expect(state.current?.message).toBe('떠 있는 것');
    expect(state.pending.map((toast) => toast.message)).toEqual(['남을 것1', '남을 것2']);
  });

  it('상한 안에서는 순서를 지킨다', () => {
    let state = enqueue(empty, item('현재'));
    state = enqueue(state, item('다음'));

    expect(state.pending.map((toast) => toast.message)).toEqual(['다음']);
  });
});
