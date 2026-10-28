import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from './withTimeout';

describe('withTimeout', () => {
  it('resolves with the original value when the promise settles before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'timed out')).resolves.toBe('ok');
  });

  it('rejects with the original error when the promise rejects before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'timed out')).rejects.toThrow('boom');
  });

  it('rejects with the timeout message when the promise never settles in time', async () => {
    vi.useFakeTimers();
    const neverSettles = new Promise(() => {});

    const result = withTimeout(neverSettles, 5000, 'timed out');
    const assertion = expect(result).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    vi.useRealTimers();
  });
});
