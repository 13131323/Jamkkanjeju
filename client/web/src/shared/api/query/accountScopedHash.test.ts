import { describe, expect, it, vi } from 'vitest';
const account = vi.hoisted(() => ({ id: '1' }));
vi.mock('../auth/session', () => ({ accountId: () => account.id }));
import { hashQueryKeyByAccount } from './accountScopedHash';
describe('사용자별 조회 캐시', () => {
  it('다른 사용자는 같은 요청도 분리한다', () => {
    account.id = '1';
    const a = hashQueryKeyByAccount(['home']);
    account.id = '2';
    expect(hashQueryKeyByAccount(['home'])).not.toBe(a);
  });
  it('같은 사용자의 객체 키 순서는 무관하다', () => {
    expect(hashQueryKeyByAccount(['home', { a: 1, b: 2 }])).toBe(hashQueryKeyByAccount(['home', { b: 2, a: 1 }]));
  });
});
