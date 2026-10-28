import { describe, expect, it } from 'vitest';
// 배럴(@entities/location)이 아니라 모듈을 직접 부른다 — 배럴은 브릿지·인터셉터까지 끌고 와
// node 환경 테스트에서 필요 없는 부작용이 실행된다.
import { resolveCurrentCoords } from '@entities/location/model/useCurrentCoords';
import { resolveDisplayLocation } from '@entities/location/model/resolveDisplayLocation';
// FORCED_JEJU_COORDS(entities/location)와 같은 값이다. 그쪽을 import하면 judgeMode 스토어까지 딸려 온다
import { JUDGE_MODE_COORDS as FORCED_JEJU_COORDS } from '@packages/shared';
import { JEJU_CENTER } from '@shared/config/geo';
import { resolveHomeQueryCoords } from './homeQueryCoords';

// 홈 조회가 실제로 쓰는 파이프라인: useCurrentCoords(=resolveCurrentCoords) → resolveHomeQueryCoords.
// 훅을 그대로 부를 수 없어(vitest environment: node) 같은 순수 함수 조합으로 검증한다.
function homeQueryCoords(liveCoords: { lat: number; lng: number } | null, isJudgeMode: boolean) {
  const forced = isJudgeMode ? FORCED_JEJU_COORDS : null;
  return resolveHomeQueryCoords(resolveCurrentCoords('granted-precise', liveCoords, null, forced));
}

const SEOUL = { lat: 37.5665, lng: 126.978 };
const JEJU_INSIDE = { lat: 33.4507, lng: 126.5706 };

describe('홈 조회 query 좌표', () => {
  it('심사위원용 모드가 꺼져 있으면 제주 밖 좌표도 그대로 싣는다 — 서버가 근처 추천을 못 찾아 추천 미션이 비는 것이 정상 동작이다', () => {
    expect(homeQueryCoords(SEOUL, false)).toEqual(SEOUL);
  });

  it('심사위원용 모드가 꺼져 있고 제주 안이면 실제 좌표를 싣는다', () => {
    expect(homeQueryCoords(JEJU_INSIDE, false)).toEqual(JEJU_INSIDE);
  });

  it('심사위원용 모드가 켜져 있으면 실제 위치와 무관하게 제주시청 고정 좌표를 싣는다', () => {
    expect(homeQueryCoords(SEOUL, true)).toEqual(FORCED_JEJU_COORDS);
    expect(homeQueryCoords(JEJU_INSIDE, true)).toEqual(FORCED_JEJU_COORDS);
  });

  it('아직 좌표를 모를 때만 섬 중심으로 대체한다 — 진행중 미션·방명록 개수까지 같은 조회에 실려 있어 멈출 수 없다', () => {
    expect(homeQueryCoords(null, false)).toEqual(JEJU_CENTER);
  });

  // GPS는 가만히 있어도 미세하게 흔들린다. 그 값이 그대로 queryKey에 실려서 홈이 뜰 때마다
  // 새 키가 되고, keepPreviousData를 일부러 안 쓰는 화면이라 배너·진행중 미션·뱃지가 통째로
  // 스켈레톤으로 되돌아간다. 주소 조회는 같은 문제를 이미 4자리 반올림으로 막아 뒀다(useCurrentAddress).
  it('11m 안쪽의 GPS 흔들림은 같은 좌표로 접는다 — 홈이 매번 스켈레톤으로 깜빡이지 않도록', () => {
    const jittered = { lat: JEJU_INSIDE.lat + 0.00002, lng: JEJU_INSIDE.lng - 0.00003 };
    expect(homeQueryCoords(jittered, false)).toEqual(homeQueryCoords(JEJU_INSIDE, false));
  });

  it('11m을 넘어 움직이면 새 좌표로 조회한다', () => {
    const moved = { lat: JEJU_INSIDE.lat + 0.001, lng: JEJU_INSIDE.lng };
    expect(homeQueryCoords(moved, false)).not.toEqual(homeQueryCoords(JEJU_INSIDE, false));
  });

  it('지도 표시용 판정(resolveDisplayLocation)을 쓰면 안 되는 이유 — 제주 밖 좌표를 버려서 섬 중심 추천이 나간다', () => {
    // 이 회귀가 실제로 있었다: useHomeData가 useDisplayLocation을 쓰던 시절 서울에서도 한라산 기준 추천이 떴다.
    expect(resolveDisplayLocation('granted-precise', SEOUL, null, null).coords).toBeNull();
  });
});
