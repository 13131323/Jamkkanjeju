/**
 * 보물 획득 모달의 문구·CTA. Penpot "step-3" 열의 두 모달 보드가 기준이다
 * (`재오픈` 296x331, `Container` 296x331).
 *
 * 에셋(`require('@assets/...')`)을 들이지 않는 순수 모듈로 떼어 둔다 — vitest에는 Metro의 에셋
 * 로더가 없어서, 이미지를 들고 있는 모듈을 import하면 테스트가 "Cannot find module"로 죽는다
 * (constants/treasureSpots.ts를 가른 것과 같은 이유).
 */

/** 모달이 보여 줄 상태. 호출부가 진행도를 보고 고른다 */
export type TreasureRewardModalVariant =
  /** 방금 찾은 보물 — 아직 남은 보물이 있다 */
  | 'found'
  /** 이미 찾아 둔 보물을 다시 누른 경우 */
  | 'already-found'
  /** 이 보물로 세 개를 모두 채웠다 — 남은 일은 인증샷뿐이다 */
  | 'all-found';

export interface TreasureRewardModalText {
  title: string;
  /** 두 줄로 끊어 그린다. 디자인도 줄바꿈이 들어간 두 줄이다 */
  description: string;
  ctaText: string;
}

/**
 * 목적격 조사. "보물이**를**" / "쿠폰**을**"처럼 받침 유무로 갈린다.
 *
 * 보상 이름은 서버가 주는 값이라(캐릭터 이름 등) 미리 정해 둘 수 없다. "를(을)"처럼 둘 다
 * 적어 두면 디자인과 달라지므로 마지막 글자의 종성을 보고 고른다.
 * 한글이 아닌 글자로 끝나면 판단 근거가 없어 '를'로 둔다.
 */
export function objectParticle(word: string): '을' | '를' {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangulSyllable) return '를';

  // 한글 음절 = ((초성 * 21) + 중성) * 28 + 종성. 나머지가 0이면 받침이 없다.
  return (code - 0xac00) % 28 === 0 ? '를' : '을';
}

/**
 * 모달 문구를 만든다.
 *
 * @param treasureOrder 보물 순번(1-based). 제목의 "N번째"에 쓴다.
 * @param rewardLabel 이 보물로 받는 보상 이름(예: "AR 캐릭터 보물이", "3,000원 쿠폰").
 */
export function resolveRewardModalText(variant: TreasureRewardModalVariant, treasureOrder: number, rewardLabel: string): TreasureRewardModalText {
  if (variant === 'all-found') {
    return {
      title: '보물을 모두 찾았어요',
      description: '마지막으로 보물이와 함께\n인증샷을 남겨주세요',
      ctaText: '보물이와 사진 찍기',
    };
  }

  return {
    title: variant === 'already-found' ? '이미 찾은 보물이에요' : `${treasureOrder}번째 보물을 찾았어요`,
    // 디자인은 "보물을 찾아 AR 캐릭터 / 보물이를 획득했습니다."로 두 줄이다. 보상 이름 길이가
    // 제각각이라 줄바꿈 위치를 못 박지 않고, 폭(248 - 좌우 24)에 맡겨 자연스럽게 넘긴다.
    description: `보물을 찾아 ${rewardLabel}${objectParticle(rewardLabel)} 획득했습니다.`,
    ctaText: '보상 확인',
  };
}
