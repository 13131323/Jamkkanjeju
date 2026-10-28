import { describe, expect, it } from 'vitest';
import { applyNetworkReading, INITIAL_NETWORK_GATE, type NetworkGate, offlineGraceRemaining, OFFLINE_GRACE_MS, readNetworkState } from './networkStatus';

const T0 = 1_700_000_000_000;

/** 이벤트를 순서대로 흘려 넣는다. 각 항목은 [원시 판정, T0로부터의 경과 ms] */
function feed(start: NetworkGate, events: [Parameters<typeof applyNetworkReading>[1], number][]): NetworkGate {
  return events.reduce((gate, [reading, offset]) => applyNetworkReading(gate, reading, T0 + offset), start);
}

const online: NetworkGate = { status: 'online', reading: 'online', offlineSince: null };

describe('readNetworkState', () => {
  it('연결 자체가 없으면 확실한 끊김이다', () => {
    expect(readNetworkState({ isConnected: false, isInternetReachable: false })).toBe('offline');
  });

  it('연결과 도달성이 모두 있으면 온라인이다', () => {
    expect(readNetworkState({ isConnected: true, isInternetReachable: true })).toBe('online');
  });

  it('연결은 있는데 도달성만 false면 판단을 미룬다 — 안드로이드 재검증 중의 모습이다', () => {
    expect(readNetworkState({ isConnected: true, isInternetReachable: false })).toBe('unknown');
  });

  it('도달성을 아예 알려주지 않으면 온라인으로 본다 — 연결이 있다는 것까지는 확인됐다', () => {
    expect(readNetworkState({ isConnected: true })).toBe('online');
  });

  it('연결 여부를 모르면 끊김으로 접지 않는다', () => {
    expect(readNetworkState({})).toBe('unknown');
    expect(readNetworkState({ isConnected: null, isInternetReachable: null })).toBe('unknown');
  });
});

describe('applyNetworkReading — 재개 직후의 불확실한 상태', () => {
  it('쓰고 있던 화면은 도달성이 잠깐 false가 되어도 온라인 그대로다', () => {
    const gate = applyNetworkReading(online, 'unknown', T0);

    expect(gate.status).toBe('online');
  });

  it('유예 안에 회복되면 오프라인을 한 번도 거치지 않는다', () => {
    const gate = feed(online, [
      ['unknown', 0],
      ['unknown', 500],
      ['online', 1200],
    ]);

    expect(gate).toEqual({ status: 'online', reading: 'online', offlineSince: null });
  });

  it('연결이 잠깐 끊겼다 붙는 경우(Wi-Fi 재접속)도 화면을 바꾸지 않는다', () => {
    const gate = feed(online, [
      ['offline', 0],
      ['online', 900],
    ]);

    expect(gate.status).toBe('online');
  });
});

describe('applyNetworkReading — 진짜 오프라인은 여전히 알린다', () => {
  it('유예가 지나면 확정한다', () => {
    const gate = feed(online, [
      ['unknown', 0],
      ['unknown', OFFLINE_GRACE_MS],
    ]);

    expect(gate.status).toBe('offline');
  });

  it('이벤트가 계속 흔들려도 유예 시작 시각은 밀리지 않는다', () => {
    // 재개 직후에는 onCapabilitiesChanged가 연달아 온다. 올 때마다 유예를 새로 시작하면
    // 진짜 오프라인을 영영 확정하지 못한다.
    const gate = feed(online, [
      ['unknown', 0],
      ['offline', 1000],
      ['unknown', 2000],
      ['offline', OFFLINE_GRACE_MS],
    ]);

    expect(gate.status).toBe('offline');
    expect(gate.offlineSince).toBe(T0);
  });

  it('한 번 확정된 뒤에는 유예가 다시 생기지 않는다', () => {
    const offline = feed(online, [
      ['unknown', 0],
      ['unknown', OFFLINE_GRACE_MS],
    ]);

    expect(applyNetworkReading(offline, 'unknown', T0 + OFFLINE_GRACE_MS + 10).status).toBe('offline');
  });
});

describe('applyNetworkReading — 앱 시작 직후', () => {
  it('확실한 끊김은 기다리지 않는다 — 지킬 화면이 아직 없다', () => {
    expect(applyNetworkReading(INITIAL_NETWORK_GATE, 'offline', T0).status).toBe('offline');
  });

  it('불확실한 값에는 판단을 내리지 않아 스플래시가 유지된다', () => {
    expect(applyNetworkReading(INITIAL_NETWORK_GATE, 'unknown', T0).status).toBe('checking');
  });

  it('불확실한 채로 유예가 지나면 오프라인으로 확정한다 — 스플래시에 갇히지 않는다', () => {
    const gate = feed(INITIAL_NETWORK_GATE, [
      ['unknown', 0],
      ['unknown', OFFLINE_GRACE_MS],
    ]);

    expect(gate.status).toBe('offline');
  });
});

describe('applyNetworkReading — 회복', () => {
  it('오프라인에서 온라인이 오면 즉시 되돌아온다', () => {
    const offline: NetworkGate = { status: 'offline', reading: 'offline', offlineSince: T0 };

    expect(applyNetworkReading(offline, 'online', T0 + 60_000)).toEqual({ status: 'online', reading: 'online', offlineSince: null });
  });
});

describe('offlineGraceRemaining', () => {
  it('후보가 아니면 기다릴 것이 없다', () => {
    expect(offlineGraceRemaining(online, T0)).toBeNull();
  });

  it('이미 확정된 뒤에도 기다릴 것이 없다', () => {
    expect(offlineGraceRemaining({ status: 'offline', reading: 'offline', offlineSince: T0 }, T0 + 10)).toBeNull();
  });

  it('후보 구간에서는 확정 시각까지 남은 시간을 돌려준다', () => {
    const gate = applyNetworkReading(online, 'unknown', T0);

    expect(offlineGraceRemaining(gate, T0 + 1000)).toBe(OFFLINE_GRACE_MS - 1000);
  });

  it('이미 지났으면 0이다 — 타이머가 즉시 확정한다', () => {
    const gate = applyNetworkReading(online, 'unknown', T0);

    expect(offlineGraceRemaining(gate, T0 + OFFLINE_GRACE_MS + 500)).toBe(0);
  });
});
