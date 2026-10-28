import { isJudgeAuthEnabled } from '@shared/api/auth/judgeToken';

/**
 * 마지막으로 보여준 주소를 담아 두는 외부 스토어.
 *
 * 홈 WebView는 미션을 끝낼 때마다 새로 로드되고 그때마다 좌표→주소 변환을 처음부터 다시 한다.
 * 그 사이 자리표시가 한 번 반짝이는 것이 거슬린다는 지적이 있어 직전 값으로 받친다.
 *
 * **useAddressDisplay가 아니라 별도 모듈인 이유**: 심사위원용 모드를 끌 때 이 캐시를 비워야 하는데
 * (judgeMode.ts), useAddressDisplay를 import하면 useCurrentCoords → forcedLocation → judgeMode로
 * 순환 참조가 된다. 값만 가진 이 모듈을 양쪽이 함께 보면 순환이 생기지 않는다.
 */
const LAST_ADDRESS_STORAGE_KEY_PREFIX = 'tamnalog:last-address';

/**
 * **저장 키를 계정으로 가른다** — 쿼리 캐시를 가른 것과 같은 규칙이다(shared/api/query/accountScopedHash.ts).
 *
 * 하나의 키를 함께 쓰던 동안은, 심사위원용 모드로 돌다 남긴 제주시청 주소가 기본 모드의 첫 화면에
 * (그리고 그 반대로도) **확정값처럼** 먼저 떴다가 바뀌었다. 쿼리에 게이트를 걸어도 이 경로는 게이트
 * 밖이라 그대로 남는다 — 값이 네트워크가 아니라 localStorage에서 오기 때문이다.
 *
 * judgeMode.ts가 아니라 shared의 플래그를 읽는 이유: 이 모듈은 judgeMode가 import하는 쪽이라
 * 거꾸로 import하면 순환이 된다(파일 첫 주석 참고). shared의 플래그는 토큰·쿼리 해시가 보는 값과
 * **같은 값**이라 세 곳이 갈릴 수 없다.
 */
function accountScope(): string {
  return isJudgeAuthEnabled() ? 'judge' : 'app';
}

function storageKey(): string {
  return `${LAST_ADDRESS_STORAGE_KEY_PREFIX}:${accountScope()}`;
}

/** 마지막으로 알려진 주소. useSyncExternalStore가 읽는 외부 스토어의 전부다 */
let currentAddress: string | null | undefined;
/** 위 값이 **어느 계정의 것인지**. 모드가 뒤집히면 메모리 캐시도 다시 읽어야 한다 */
let loadedScope: string | null = null;
const listeners = new Set<() => void>();

function readCachedAddress(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(storageKey()) ?? undefined;
  } catch {
    // 사파리 프라이빗 모드 등에서 던진다 — 받칠 값이 없는 것으로 본다
    return undefined;
  }
}

/**
 * 메모리 캐시를 **지금 계정의** 저장값으로 맞춘다.
 *
 * 첫 구독뿐 아니라 읽을 때마다 확인하는 이유: 모드는 실행 중에 뒤집히는데(홈의 "모드변경"),
 * 구독은 그때 다시 돌지 않는다. 계정이 그대로면 아무것도 하지 않으므로 비용은 비교 한 번이다.
 */
function syncToCurrentScope(): void {
  const scope = accountScope();
  if (loadedScope === scope && currentAddress !== undefined) return;

  loadedScope = scope;
  currentAddress = readCachedAddress() ?? null;
}

export function subscribeLastKnownAddress(listener: () => void): () => void {
  listeners.add(listener);
  syncToCurrentScope();

  return () => {
    listeners.delete(listener);
  };
}

export function getLastKnownAddress(): string | undefined {
  syncToCurrentScope();
  return currentAddress ?? undefined;
}

/**
 * 서버 스냅샷은 없음이다. 서버에는 localStorage가 없고, 여기서 무엇을 지어내면 hydration 직후
 * 그 값이 한 프레임 보였다가 바뀐다 — 없애려는 장면이 모양만 바꿔 돌아온다.
 */
export function getLastKnownAddressServerSnapshot(): string | undefined {
  return undefined;
}

export function writeLastKnownAddress(address: string): void {
  syncToCurrentScope();
  if (currentAddress === address) return;

  loadedScope = accountScope();
  currentAddress = address;
  listeners.forEach((listener) => listener());

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(), address);
  } catch {
    // 저장 실패는 다음 로드에서 자리표시가 한 번 반짝이는 정도의 손해라 삼킨다
  }
}

/**
 * 지금 계정의 직전 주소를 버린다.
 *
 * **모드 전환 때문에 부를 일은 이제 없다.** 예전에는 모드를 끌 때 불렀다 — 모드 동안 기록된
 * 제주시청 주소가 기본 모드에서도 "현재 위치"처럼 남았기 때문이다. 지금은 저장 키 자체가 계정으로
 * 갈려 그 오염이 일어나지 않는다(위 accountScope 주석).
 *
 * 남겨 두는 이유: 테스트가 회차 사이를 정리하는 데 쓰고, "직전 주소를 버린다"는 동작 자체는
 * 다른 이유(로그아웃 등)로 다시 필요해질 수 있다.
 */
export function clearLastKnownAddress(): void {
  if (currentAddress === undefined || currentAddress === null) {
    currentAddress = null;
    return;
  }

  currentAddress = null;
  listeners.forEach((listener) => listener());

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey());
  } catch {
    // 지우기 실패는 다음 로드에서 옛 주소가 한 번 받치는 정도라 삼킨다
  }
}
