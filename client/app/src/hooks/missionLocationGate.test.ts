import { describe, expect, it } from 'vitest';
import type * as Location from 'expo-location';
import { resolveMissionLocationGate } from './missionLocationGate';

// expo-location은 네이티브 모듈이라 값으로 import할 수 없다. 실제 열거값과 같은 문자열을 쓴다.
const GRANTED = 'granted' as Location.PermissionStatus;
const DENIED = 'denied' as Location.PermissionStatus;
const UNDETERMINED = 'undetermined' as Location.PermissionStatus;

describe('resolveMissionLocationGate', () => {
  it('허용됐으면 진행한다', () => {
    expect(resolveMissionLocationGate(GRANTED, true)).toBe('granted');
    expect(resolveMissionLocationGate(GRANTED, false)).toBe('granted');
  });

  it('거부했지만 다시 물어볼 수 있으면 안내만 한다', () => {
    expect(resolveMissionLocationGate(DENIED, true)).toBe('ask-again');
    expect(resolveMissionLocationGate(UNDETERMINED, true)).toBe('ask-again');
  });

  it('영구 거부면 설정으로 보낸다 — 앱에서 다시 물어볼 방법이 없다', () => {
    expect(resolveMissionLocationGate(DENIED, false)).toBe('open-settings');
  });
});

/**
 * 이미 완료한 보물찾기에 다시 들어왔을 때의 **완료 화면**도 진입하면서 이 게이트를 한 번 돌린다
 * (app/mission/intro.tsx). 그 화면은 근처 미션·쿠폰을 좌표로 조회해서 권한이 없으면 목록이 비는데,
 * 안내를 띄울 CTA가 없어 진입 자체가 게이트 시점이 됐다.
 *
 * 미션 홈과 판정이 갈리면 "같은 화면인데 다른 말을 한다"가 되므로 세 갈래를 여기서 못 박는다.
 */
describe('완료 화면 재진입 — 미션 홈과 같은 게이트를 쓴다', () => {
  it('이미 허용된 기기에서는 아무것도 띄우지 않는다', () => {
    expect(resolveMissionLocationGate(GRANTED, false)).toBe(resolveMissionLocationGate(GRANTED, true));
    expect(resolveMissionLocationGate(GRANTED, true)).toBe('granted');
  });

  it('거부했어도 다시 물을 수 있으면 시스템 요청과 안내로 간다', () => {
    expect(resolveMissionLocationGate(DENIED, true)).toBe('ask-again');
  });

  it('안드로이드에서 두 번 거부해 다시 물을 수 없으면 다이얼로그 대신 설정 안내다', () => {
    expect(resolveMissionLocationGate(DENIED, false)).toBe('open-settings');
  });
});
