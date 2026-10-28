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
