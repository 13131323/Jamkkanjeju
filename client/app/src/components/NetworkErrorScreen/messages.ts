/**
 * 에러 화면 문구.
 *
 * 컴포넌트 밖에 두는 이유는 렌더 없이 문구를 검증하기 위해서다.
 * (이 레포에는 RN 컴포넌트 렌더 테스트 인프라가 없다)
 */
export type NetworkErrorVariant = 'offline' | 'server';

export const NETWORK_ERROR_MESSAGES: Record<
  NetworkErrorVariant,
  { title: string; description: string }
> = {
  /** 기기가 인터넷에 닿지 못한 경우 */
  offline: {
    title: '네트워크에 연결할 수 없어요',
    description: '인터넷 연결 상태를 확인한 뒤\n다시 시도해주세요.',
  },
  /** 서버까지는 닿았지만 오류 응답이 온 경우 — 사용자가 할 수 있는 일이 없다 */
  server: {
    title: '서버와 연결이 원활하지 않아요',
    description: '잠시 후 다시 시도해주세요.',
  },
};
