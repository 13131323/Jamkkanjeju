import { describe, expect, it } from 'vitest';
import type { GeneratedApi } from '@packages/shared';
import { selectVisibleProgressMissions } from './progressMissions';

function mission(missionType: GeneratedApi.AppHomeSchemasMissionType, currentStep: number, totalStep: number): GeneratedApi.ProgressMission {
  return { missionId: 1, missionType, missionTitle: '미션', currentStep, totalStep };
}

describe('홈 "진행중인 미션" 카드에 띄울 항목', () => {
  it('문화 미션은 마지막 문제를 푸는 동안이 3/3이라 그대로 남긴다 — currentStep은 "다음에 풀 퀴즈 번호"다', () => {
    expect(selectVisibleProgressMissions([mission('CULTURE', 1, 3), mission('CULTURE', 3, 3)])).toEqual([mission('CULTURE', 1, 3), mission('CULTURE', 3, 3)]);
  });

  it('협동 미션의 4단계는 완료 화면이라 카드에서 뺀다 — 같은 4/4라도 문화 미션과 뜻이 다르다', () => {
    expect(selectVisibleProgressMissions([mission('COOPERATIVE', 3, 4), mission('COOPERATIVE', 4, 4)])).toEqual([mission('COOPERATIVE', 3, 4)]);
  });

  it('마지막 단계를 넘어선 값은 이미 끝난 미션이다 — "4/3" 같은 배지가 찍히지 않는다', () => {
    expect(selectVisibleProgressMissions([mission('CULTURE', 4, 3), mission('TREASURE', 5, 3)])).toEqual([]);
  });

  it('보물찾기의 0은 "아직 하나도 못 찾음"일 수 있어 남긴다 — 음수만 계약 밖이다', () => {
    expect(selectVisibleProgressMissions([mission('TREASURE', 0, 3), mission('TREASURE', -1, 3)])).toEqual([mission('TREASURE', 0, 3)]);
  });

  it('분모가 없으면 뺀다 — "1/0" 배지를 그릴 수 없다', () => {
    expect(selectVisibleProgressMissions([mission('TREASURE', 1, 0)])).toEqual([]);
  });

  it('진행중인 여러 건은 순서를 바꾸지 않고 그대로 넘긴다 — 카드 캐러셀 순서가 서버 순서다', () => {
    const missions = [mission('TREASURE', 1, 3), mission('COOPERATIVE', 2, 4), mission('CULTURE', 2, 3)];
    expect(selectVisibleProgressMissions(missions)).toEqual(missions);
  });
});
