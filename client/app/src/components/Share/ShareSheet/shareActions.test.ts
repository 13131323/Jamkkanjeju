import { describe, expect, it } from 'vitest';
import { INVITE_SHARE_ACTIONS } from '@/components/Coop/InviteShareSheet/shareMessage';
import { SHARE_ACTIONS } from './shareActions';

/**
 * 시트가 협동 미션 초대에서 공용으로 빠져나오면서 이 목록도 함께 옮겼다.
 * **옮기면서 순서·라벨·경로가 바뀌지 않았다는 근거**가 이 파일이다 — 원 4개의 자리는 시안 실측이고,
 * 초대 화면이 보던 시트와 엽서 화면이 보는 시트가 같아야 한다.
 */
describe('SHARE_ACTIONS', () => {
  it('라인·문자·메일·더보기 순서다 — 시안 순서이고 첫 칸만 브랜드색 원이다', () => {
    expect(SHARE_ACTIONS.map((action) => action.id)).toEqual(['line', 'sms', 'mail', 'more']);
    expect(SHARE_ACTIONS.map((action) => action.label)).toEqual(['라인', '문자', '메일', '더보기']);
  });

  it('더보기만 OS 공유 시트다 — 나머지 셋은 그 앱을 여는 URL이 있어 곧장 연다', () => {
    expect(SHARE_ACTIONS.filter((action) => action.route === 'os-sheet').map((action) => action.id)).toEqual(['more']);
  });

  it('협동 미션 초대가 쓰던 이름이 같은 목록을 가리킨다 — 옛 호출부의 동작이 그대로여야 한다', () => {
    expect(INVITE_SHARE_ACTIONS).toBe(SHARE_ACTIONS);
  });
});
