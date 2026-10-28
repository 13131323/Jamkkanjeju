import { describe, expect, it } from 'vitest';
import { resolveMissionNavigateTarget } from './missionNavigateTarget';

/**
 * 홈 배너("시작하기")와 홈 상단 "진행중인 미션" 카드(">")가 같은 NAVIGATE 메시지를 쓰고
 * resume 플래그로만 갈린다. 기본값이 뒤집히면 배너가 인트로를 건너뛰어 아직 시작하지 않은
 * 미션의 진행 화면이 열린다 — 그래서 기본 경로를 못박아 둔다.
 */
describe('resolveMissionNavigateTarget', () => {
  it('resume이 없으면 인트로로 보낸다 (배너 "시작하기")', () => {
    expect(resolveMissionNavigateTarget('treasure-mission')).toEqual({ pathname: '/mission/intro', mission: 'treasure' });
    expect(resolveMissionNavigateTarget('culture-mission')).toEqual({ pathname: '/mission/intro', mission: 'culture' });
    expect(resolveMissionNavigateTarget('coop-mission')).toEqual({ pathname: '/mission/intro', mission: 'coop' });
  });

  it('resume이 false여도 인트로다', () => {
    expect(resolveMissionNavigateTarget('treasure-mission', false)).toEqual({ pathname: '/mission/intro', mission: 'treasure' });
  });

  it('resume이면 보물찾기·문화는 진행 화면으로 바로 보낸다', () => {
    expect(resolveMissionNavigateTarget('treasure-mission', true)).toEqual({ pathname: '/mission/treasure' });
    expect(resolveMissionNavigateTarget('culture-mission', true)).toEqual({ pathname: '/mission/culture' });
  });

  it('협동 미션 이어하기는 인트로가 아니라 협동 미션 화면으로 보낸다', () => {
    // 방을 여는 요청(POST .../progress)이 협동 흐름 자체로 옮겨 가서 인트로를 거칠 이유가 없다.
    // 단계가 더 앞서 있으면 그 화면이 currentStep을 보고 해당 단계로 바꿔 끼운다.
    expect(resolveMissionNavigateTarget('coop-mission', true)).toEqual({ pathname: '/mission/together' });
  });
});
