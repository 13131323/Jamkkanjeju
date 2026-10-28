import { describe, expect, it } from 'vitest';
import { objectParticle, resolveRewardModalText } from './rewardModalText';

describe('objectParticle', () => {
  it('받침이 있으면 을을 붙인다', () => {
    expect(objectParticle('쿠폰')).toBe('을');
    expect(objectParticle('포인트가 아닌 것')).toBe('을');
  });

  it('받침이 없으면 를을 붙인다', () => {
    expect(objectParticle('보물이')).toBe('를');
    expect(objectParticle('AR 캐릭터')).toBe('를');
    expect(objectParticle('3,000포인트')).toBe('를');
  });

  it('한글이 아닌 글자로 끝나면 판단 근거가 없어 를로 둔다', () => {
    expect(objectParticle('AR')).toBe('를');
    expect(objectParticle('300')).toBe('를');
  });
});

describe('resolveRewardModalText', () => {
  it('처음 찾은 보물은 순번을 제목에 넣고 보상 이름을 설명에 넣는다', () => {
    expect(resolveRewardModalText('found', 2, 'AR 캐릭터 보물이')).toEqual({
      title: '2번째 보물을 찾았어요',
      description: '보물을 찾아 AR 캐릭터 보물이를 획득했습니다.',
      ctaText: '보상 확인',
    });
  });

  it('이미 찾은 보물은 제목만 바뀌고 보상 설명은 같다', () => {
    const alreadyFound = resolveRewardModalText('already-found', 2, '3,000원 쿠폰');

    expect(alreadyFound.title).toBe('이미 찾은 보물이에요');
    expect(alreadyFound.description).toBe('보물을 찾아 3,000원 쿠폰을 획득했습니다.');
    expect(alreadyFound.ctaText).toBe('보상 확인');
  });

  it('모두 찾으면 인증샷 안내로 바뀌고 CTA가 촬영으로 이어진다', () => {
    expect(resolveRewardModalText('all-found', 3, 'AR 캐릭터 보물이')).toEqual({
      title: '보물을 모두 찾았어요',
      description: '마지막으로 보물이와 함께\n인증샷을 남겨주세요',
      ctaText: '보물이와 사진 찍기',
    });
  });

  it('모두 찾은 화면은 보상 이름·순번에 좌우되지 않는다', () => {
    const a = resolveRewardModalText('all-found', 1, '포인트');
    const b = resolveRewardModalText('all-found', 3, 'AR 캐릭터 돌멩이');

    expect(a).toEqual(b);
  });
});
