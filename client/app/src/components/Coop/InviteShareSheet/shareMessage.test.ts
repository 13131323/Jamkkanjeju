import { describe, expect, it } from 'vitest';
import { buildInviteShareMessage, buildLineShareUrl, buildMailShareUrl, buildSmsShareUrl, INVITE_SHARE_ACTIONS, INVITE_SHARE_HEADLINE } from './shareMessage';

const INVITE_URL = 'https://tamnalog.app/invite?token=abc';

describe('buildInviteShareMessage', () => {
  it('안내 문구 다음 줄에 링크를 붙인다', () => {
    expect(buildInviteShareMessage(INVITE_URL)).toBe(`${INVITE_SHARE_HEADLINE}\n${INVITE_URL}`);
  });

  it('링크 앞뒤 공백은 떼고 붙인다 — 공백이 섞이면 링크로 인식되지 않는 앱이 있다', () => {
    expect(buildInviteShareMessage(`  ${INVITE_URL}  `)).toBe(`${INVITE_SHARE_HEADLINE}\n${INVITE_URL}`);
  });

  it('링크가 없으면 빈 문자열이다 — 들어올 방법이 없는 글은 보내지 않는다', () => {
    expect(buildInviteShareMessage('')).toBe('');
    expect(buildInviteShareMessage('   ')).toBe('');
  });
});

describe('buildLineShareUrl', () => {
  it('라인 텍스트 공유 주소 뒤에 인코딩한 본문만 붙인다 — 쿼리 전체가 본문이라 키 이름이 없다', () => {
    expect(buildLineShareUrl(INVITE_URL)).toBe(`https://line.me/R/msg/text/?${encodeURIComponent(`${INVITE_SHARE_HEADLINE}\n${INVITE_URL}`)}`);
  });

  it('https로 연다 — 커스텀 스킴이면 Android 11+에서 패키지 가시성 선언이 필요해진다', () => {
    expect(buildLineShareUrl(INVITE_URL).startsWith('https://line.me/R/msg/text/?')).toBe(true);
  });

  it('본문은 인코딩한다 — 줄바꿈과 물음표가 그대로 나가면 URL이 잘려 본문이 반만 간다', () => {
    const url = buildLineShareUrl(INVITE_URL);
    expect(url).toContain('%0A');
    expect(url).toContain('token%3Dabc');
    expect(url).not.toContain('token=abc');
    // 주소의 `?`는 하나뿐이어야 한다 — 본문 속 `?`가 인코딩되지 않으면 라인이 본문을 거기서 끊는다
    expect(url.split('?')).toHaveLength(2);
  });

  it('링크가 없으면 빈 문자열이다 — 문자·메일과 같은 규칙이다', () => {
    expect(buildLineShareUrl('')).toBe('');
    expect(buildLineShareUrl('   ')).toBe('');
  });
});

describe('buildSmsShareUrl', () => {
  it('Android는 `?body=`로 본문을 붙인다', () => {
    expect(buildSmsShareUrl(INVITE_URL, 'android')).toBe(`sms:?body=${encodeURIComponent(`${INVITE_SHARE_HEADLINE}\n${INVITE_URL}`)}`);
  });

  it('iOS는 `&body=`라야 본문이 채워진다 — 같은 문자열을 쓰면 iOS에서 빈 문자가 열린다', () => {
    expect(buildSmsShareUrl(INVITE_URL, 'ios')).toBe(`sms:&body=${encodeURIComponent(`${INVITE_SHARE_HEADLINE}\n${INVITE_URL}`)}`);
  });

  it('본문은 인코딩한다 — 줄바꿈과 물음표가 그대로 나가면 URL이 잘린다', () => {
    const url = buildSmsShareUrl(INVITE_URL, 'android');
    expect(url).toContain('%0A');
    expect(url).not.toContain('token=abc');
    expect(url).toContain('token%3Dabc');
  });

  it('링크가 없으면 빈 문자열이다 — 호출부가 열지 않고 넘길 수 있어야 한다', () => {
    expect(buildSmsShareUrl('   ', 'android')).toBe('');
    expect(buildSmsShareUrl('', 'ios')).toBe('');
  });
});

describe('buildMailShareUrl', () => {
  it('받는 사람은 비우고 제목과 본문만 채운다 — 시트는 상대 주소를 모른다', () => {
    expect(buildMailShareUrl(INVITE_URL)).toBe(`mailto:?subject=${encodeURIComponent(INVITE_SHARE_HEADLINE)}&body=${encodeURIComponent(`${INVITE_SHARE_HEADLINE}\n${INVITE_URL}`)}`);
  });

  it('링크가 없으면 빈 문자열이다', () => {
    expect(buildMailShareUrl('  ')).toBe('');
  });
});

describe('INVITE_SHARE_ACTIONS', () => {
  it('순서 그대로 4개다 — 라인·문자·메일·더보기', () => {
    expect(INVITE_SHARE_ACTIONS.map((action) => action.id)).toEqual(['line', 'sms', 'mail', 'more']);
    expect(INVITE_SHARE_ACTIONS.map((action) => action.label)).toEqual(['라인', '문자', '메일', '더보기']);
  });

  it('id가 겹치지 않는다 — 시트가 id로 동작과 글리프를 가른다', () => {
    const ids = INVITE_SHARE_ACTIONS.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('라인·문자·메일이 앱을 직접 연다 — 더보기만 OS 공유 시트가 유일한 경로다', () => {
    const direct = INVITE_SHARE_ACTIONS.filter((action) => action.route === 'direct').map((action) => action.id);
    expect(direct).toEqual(['line', 'sms', 'mail']);
    const osSheet = INVITE_SHARE_ACTIONS.filter((action) => action.route === 'os-sheet').map((action) => action.id);
    expect(osSheet).toEqual(['more']);
  });

  it('모든 줄에 실행 경로가 있다 — 눌러도 아무 일이 없는 자리는 두지 않는다', () => {
    for (const action of INVITE_SHARE_ACTIONS) {
      expect(action.route === 'direct' || action.route === 'os-sheet').toBe(true);
      expect(action.label).not.toBe('');
    }
  });

  it('카카오톡은 목록에 없다 — 임의 텍스트를 보내는 공개 URL scheme이 없어 뺐다', () => {
    expect(INVITE_SHARE_ACTIONS.some((action) => action.label.includes('카카오'))).toBe(false);
  });
});
