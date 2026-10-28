import type { GeneratedApi } from '@packages/shared';

export type RewardBadge = { label: string; isReceived: boolean };

// 미션의 전체 보상(rewardDetail)에서 화면에 보여줄 배지 목록을 뽑는다. 설정되지 않은 보상 항목은 null이라 걸러낸다.
export function toRewardBadges(rewardDetail: GeneratedApi.FullRewardDetailResponse): RewardBadge[] {
  const badges: RewardBadge[] = [];

  if (rewardDetail.point) {
    badges.push({ label: `${rewardDetail.point.amount}P`, isReceived: rewardDetail.point.isReceived });
  }
  if (rewardDetail.coupon) {
    badges.push({ label: '쿠폰', isReceived: rewardDetail.coupon.isReceived });
  }
  if (rewardDetail.arCharacter) {
    badges.push({ label: rewardDetail.arCharacter.name, isReceived: rewardDetail.arCharacter.isReceived });
  }

  return badges;
}
