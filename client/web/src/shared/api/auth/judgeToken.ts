import { judgeAuthorizationHeader } from '@packages/shared';

/**
 * 심사위원용 모드에서 쓰는 고정 토큰을 요청 헤더에 붙이는 장치.
 *
 * **토큰 값 자체는 여기에 없다.** `packages/shared`의 `JUDGE_ACCESS_TOKEN`이 단일 출처다 —
 * 같은 모드에서 앱도 같은 사용자로 호출해야 하기 때문이다(app/src/services/authHeader.ts).
 * 값을 여기에 두면 web과 app이 토큰 규칙을 두 벌 갖게 되고, 어긋나는 순간 홈이 보여 준
 * 진행도와 그것을 이어받는 앱 호출의 주인이 갈린다. 값의 근거·배경은 그 상수의 주석에 있다.
 */

/**
 * 모드가 켜져 있는지. **axios 인터셉터는 동기 함수라 React 훅을 쓸 수 없다.**
 *
 * 모드의 주인은 web의 zustand 스토어(`entities/location/model/judgeMode.ts`)이고, 그쪽이
 * 스토어를 구독해 이 값을 밀어 넣는다. FSD 상 shared가 entities를 import할 수 없어서
 * 방향을 뒤집었다 — shared는 장치만 두고 값은 위 레이어가 정한다.
 */
let judgeModeEnabled = false;

export function setJudgeAuthEnabled(enabled: boolean): void {
  judgeModeEnabled = enabled;
}

/** 모드가 켜져 있으면 심사위원 토큰 헤더, 아니면 null */
export function judgeAuthHeader(): string | null {
  return judgeModeEnabled ? judgeAuthorizationHeader() : null;
}
