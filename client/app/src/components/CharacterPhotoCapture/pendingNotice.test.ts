import { afterEach, describe, expect, it, vi } from 'vitest';
import { PENDING_NOTICE_DELAY_MS, schedulePendingNotice } from './pendingNotice';

afterEach(() => {
  vi.useRealTimers();
});

describe('schedulePendingNotice', () => {
  it('지연이 지나면 한 번 알린다', () => {
    vi.useFakeTimers();
    const notify = vi.fn();

    schedulePendingNotice(notify);
    vi.advanceTimersByTime(PENDING_NOTICE_DELAY_MS);

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('지연 직전까지는 알리지 않는다 — 빨리 끝나면 아무것도 보이지 않아야 한다', () => {
    vi.useFakeTimers();
    const notify = vi.fn();

    schedulePendingNotice(notify);
    vi.advanceTimersByTime(PENDING_NOTICE_DELAY_MS - 1);

    expect(notify).not.toHaveBeenCalled();
  });

  it('지연 안에 취소하면 영영 알리지 않는다 (깜빡임 방지의 핵심)', () => {
    vi.useFakeTimers();
    const notify = vi.fn();

    const cancel = schedulePendingNotice(notify);
    vi.advanceTimersByTime(PENDING_NOTICE_DELAY_MS - 1);
    cancel();
    vi.advanceTimersByTime(10_000);

    expect(notify).not.toHaveBeenCalled();
  });

  it('이미 알린 뒤에 취소해도 안전하고, 알림이 되돌려지지 않는다', () => {
    vi.useFakeTimers();
    const notify = vi.fn();

    const cancel = schedulePendingNotice(notify);
    vi.advanceTimersByTime(PENDING_NOTICE_DELAY_MS);
    cancel();
    vi.advanceTimersByTime(10_000);

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('취소를 여러 번 불러도 안전하다', () => {
    vi.useFakeTimers();
    const notify = vi.fn();

    const cancel = schedulePendingNotice(notify);
    cancel();
    cancel();
    vi.advanceTimersByTime(10_000);

    expect(notify).not.toHaveBeenCalled();
  });

  it('지연을 직접 줄 수 있다', () => {
    vi.useFakeTimers();
    const notify = vi.fn();

    schedulePendingNotice(notify, 1000);
    vi.advanceTimersByTime(999);
    expect(notify).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('지연이 0 이하면 아예 알리지 않는다 — 즉시 표시는 이 함수가 막으려는 것 그 자체다', () => {
    vi.useFakeTimers();
    const notify = vi.fn();

    schedulePendingNotice(notify, 0);
    schedulePendingNotice(notify, -1);
    vi.advanceTimersByTime(10_000);

    expect(notify).not.toHaveBeenCalled();
  });

  it('깜빡임 임계값은 "즉시로 느끼는 100ms"와 "흐름이 끊기는 1초" 사이에 있다', () => {
    expect(PENDING_NOTICE_DELAY_MS).toBeGreaterThan(100);
    expect(PENDING_NOTICE_DELAY_MS).toBeLessThanOrEqual(1000);
  });
});
