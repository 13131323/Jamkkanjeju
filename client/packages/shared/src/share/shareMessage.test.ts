import { describe, expect, it } from 'vitest';
import { buildLineShareUrl, buildMailShareUrl, buildShareMessage, buildSmsShareUrl, type ShareContent } from './shareMessage';

const INVITE: ShareContent = { headline: '함께 귤나무를 키워요!', url: 'https://tamnalog.app/invite?token=abc' };
/** 엽서는 서버가 만들어 둔 이미지 주소를 그대로 공유한다(쿼리에 서명이 붙는 형태를 가정) */
const POSTCARD: ShareContent = { headline: '제주 여행 엽서를 보내요', url: 'https://cdn.tamnalog.app/postcard/42.png?sig=xyz' };

describe('buildShareMessage', () => {
  it('안내 문구 다음 줄에 링크를 붙인다', () => {
    expect(buildShareMessage(INVITE)).toBe(`${INVITE.headline}\n${INVITE.url}`);
  });

  it('무엇을 공유하든 같은 규칙이다 — 초대 링크든 엽서 이미지 주소든 조립이 갈라지지 않는다', () => {
    expect(buildShareMessage(POSTCARD)).toBe(`${POSTCARD.headline}\n${POSTCARD.url}`);
  });

  it('링크 앞뒤 공백은 떼고 붙인다 — 공백이 섞이면 링크로 인식되지 않는 앱이 있다', () => {
    expect(buildShareMessage({ ...INVITE, url: `  ${INVITE.url}  ` })).toBe(`${INVITE.headline}\n${INVITE.url}`);
  });

  it('링크가 없으면 빈 문자열이다 — 들어올 방법이 없는 글은 보내지 않는다', () => {
    expect(buildShareMessage({ ...INVITE, url: '' })).toBe('');
    expect(buildShareMessage({ ...INVITE, url: '   ' })).toBe('');
  });

  it('안내 문구가 비면 링크만 남는다 — 빈 줄로 시작하면 메신저에서 주소가 잘린 것처럼 보인다', () => {
    expect(buildShareMessage({ headline: '', url: INVITE.url })).toBe(INVITE.url);
    expect(buildShareMessage({ headline: '   ', url: INVITE.url })).toBe(INVITE.url);
  });
});

describe('buildLineShareUrl', () => {
  it('라인 텍스트 공유 주소 뒤에 인코딩한 본문만 붙인다 — 쿼리 전체가 본문이라 키 이름이 없다', () => {
    expect(buildLineShareUrl(INVITE)).toBe(`https://line.me/R/msg/text/?${encodeURIComponent(`${INVITE.headline}\n${INVITE.url}`)}`);
  });

  it('https로 연다 — 커스텀 스킴이면 Android 11+에서 패키지 가시성 선언이 필요해진다', () => {
    expect(buildLineShareUrl(POSTCARD).startsWith('https://line.me/R/msg/text/?')).toBe(true);
  });

  it('본문은 인코딩한다 — 줄바꿈과 물음표가 그대로 나가면 URL이 잘려 본문이 반만 간다', () => {
    const url = buildLineShareUrl(INVITE);
    expect(url).toContain('%0A');
    expect(url).toContain('token%3Dabc');
    expect(url).not.toContain('token=abc');
    // 주소의 `?`는 하나뿐이어야 한다 — 본문 속 `?`가 인코딩되지 않으면 라인이 본문을 거기서 끊는다
    expect(url.split('?')).toHaveLength(2);
  });

  it('링크가 없으면 빈 문자열이다 — 문자·메일과 같은 규칙이다', () => {
    expect(buildLineShareUrl({ ...INVITE, url: '' })).toBe('');
  });
});

describe('buildSmsShareUrl', () => {
  it('Android는 `?body=`로 본문을 붙인다', () => {
    expect(buildSmsShareUrl(INVITE, 'android')).toBe(`sms:?body=${encodeURIComponent(`${INVITE.headline}\n${INVITE.url}`)}`);
  });

  it('iOS는 `&body=`라야 본문이 채워진다 — 같은 문자열을 쓰면 iOS에서 빈 문자가 열린다', () => {
    expect(buildSmsShareUrl(INVITE, 'ios')).toBe(`sms:&body=${encodeURIComponent(`${INVITE.headline}\n${INVITE.url}`)}`);
  });

  it('문자 본문도 headline을 그대로 쓴다 — 화면이 넘긴 문구가 경로마다 달라지지 않는다', () => {
    expect(decodeURIComponent(buildSmsShareUrl(POSTCARD, 'android').replace('sms:?body=', ''))).toBe(`${POSTCARD.headline}\n${POSTCARD.url}`);
  });

  it('링크가 없으면 빈 문자열이다 — 호출부가 열지 않고 넘길 수 있어야 한다', () => {
    expect(buildSmsShareUrl({ ...INVITE, url: '   ' }, 'android')).toBe('');
    expect(buildSmsShareUrl({ ...INVITE, url: '' }, 'ios')).toBe('');
  });
});

describe('buildMailShareUrl', () => {
  it('받는 사람은 비우고 제목과 본문만 채운다 — 공유하는 쪽은 상대 주소를 모른다', () => {
    expect(buildMailShareUrl(INVITE)).toBe(`mailto:?subject=${encodeURIComponent(INVITE.headline)}&body=${encodeURIComponent(`${INVITE.headline}\n${INVITE.url}`)}`);
  });

  it('제목을 따로 주면 그것을 쓴다 — 본문 문구와 제목을 다르게 쓰고 싶은 화면이 있다', () => {
    const content: ShareContent = { ...POSTCARD, mailSubject: '잠깐제주 여행 엽서' };
    expect(buildMailShareUrl(content)).toBe(`mailto:?subject=${encodeURIComponent('잠깐제주 여행 엽서')}&body=${encodeURIComponent(`${POSTCARD.headline}\n${POSTCARD.url}`)}`);
  });

  it('링크가 없으면 빈 문자열이다', () => {
    expect(buildMailShareUrl({ ...INVITE, url: '  ' })).toBe('');
  });
});
