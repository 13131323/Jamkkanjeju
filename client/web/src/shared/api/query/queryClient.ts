import { QueryClient } from '@tanstack/react-query';
import { hashQueryKeyByAccount } from './accountScopedHash';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1분 (임시설정)
        throwOnError: true,
        // 심사위원용 모드와 일반 모드의 응답을 같은 칸에 담지 않는다 — 모드를 바꿀 때 캐시를
        // 통째로 버리지 않아도 되고, 되돌아오면 캐시 적중으로 끝난다(accountScopedHash.ts)
        queryKeyHashFn: hashQueryKeyByAccount,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // 서버: 매 요청마다 새 QueryClient 생성
    return makeQueryClient();
  }
  // 브라우저: 싱글톤 유지
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
