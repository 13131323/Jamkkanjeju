import { hashKey } from '@tanstack/react-query';
import { accountId } from '../auth/session';
/** 로그인 사용자별로 조회 캐시를 분리한다. */
export function hashQueryKeyByAccount(queryKey: readonly unknown[]): string {
  return hashKey([accountId(), ...queryKey]);
}
