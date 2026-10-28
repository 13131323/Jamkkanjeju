import { useEffect, useRef } from 'react';
import { resolveTreasureDistanceHint } from '@packages/shared';
import { useToast } from '@/components/Toast/Toast';
import { TREASURE_PLACE_SUMMARY_BOTTOM_GAP } from '@/components/Treasure/TreasurePlaceSummaryCard/TreasurePlaceSummaryCard';

/**
 * 카드 위에 더 얹는 여백(px).
 *
 * Toast가 기본으로 두는 TOAST_GAP(16)만으로는 두 줄짜리 카드와 토스트가 서로 붙어 한 덩어리로
 * 읽힌다. 둘 다 화면 아래에 겹쳐 있는 안내라 시각적으로 갈라 놓아야 한다.
 *
 * 16 → 8로 줄였다. 토스트 패딩·글자를 디자인 값(12·16 / 14)으로 되돌리면서 토스트 자체가
 * 높아졌는데, 합계 32(TOAST_GAP 16 + 이 값 16)를 그대로 두면 둘 사이가 과하게 벌어진다.
 * 8이면 합계 24로, 두 안내가 붙어 보이지 않으면서 카드와의 거리도 좁아진다.
 */
const SUMMARY_CARD_EXTRA_GAP = 8;

/**
 * 토스트가 비켜 가야 하는 높이 — 화면 아래에 깔린 장소 소개 카드가 차지하는 만큼.
 *
 * 카드 높이를 상수가 아니라 **실측값**으로 받는다. 카드는 minHeight로만 74를 보장하고 문구가
 * 두 줄이거나 폰트 배율이 크면 그보다 높아지는데, 상수로 계산하면 그 차이만큼 토스트가
 * 카드를 덮는다. 카드가 onLayout으로 알려 준 높이를 그대로 쓰면 항상 카드 바로 위에 선다.
 */
function summaryCardClearance(cardHeight: number): number {
  return cardHeight + TREASURE_PLACE_SUMMARY_BOTTOM_GAP + SUMMARY_CARD_EXTRA_GAP;
}

/**
 * 반경 밖에 있을 때 접근 안내 토스트를 띄운다.
 * prompt §9 '현재 위치와 보물의 좌표를 기반으로 "500m에 들어오면 카메라를 켤 수 있어요"와 같은 toast message 제공'
 *
 * 반경 **안**으로 들어오면 문구가 없어(null) 토스트가 사라지고, 대신 step1 시트가 올라온다 —
 * 두 안내가 같은 자리에서 겹치지 않게 하려는 것이다. 경계 판정은
 * resolveTreasureDistanceHint(@packages/shared)가 들고 있다.
 *
 * 다만 "새로 띄우지 않는다"만으로는 겹침을 막지 못한다. 토스트는 한 번 뜨면 2.4초를 채우므로
 * 그 사이에 반경으로 들어서면 시트가 토스트 위로 올라와 둘이 함께 보였다. 그래서 안내가 필요
 * 없어진 순간(enabled=false 또는 반경 진입)에 떠 있는 토스트를 직접 내린다.
 *
 * 위치는 1초마다 갱신되므로, 같은 문구를 반복해 띄우지 않도록 마지막으로 보여준 문구를 기억해
 * **바뀔 때만** 한 번 띄운다.
 */
export function useTreasureDistanceToast(distanceMeters: number | null, enabled: boolean, summaryCardHeight: number | null = null) {
  const { show, hide } = useToast();
  const lastShownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      // 화면을 벗어나면 다음 진입 때 현재 구간 문구를 한 번 다시 보여준다
      lastShownRef.current = null;
      // step1 시트가 올라오거나 카메라로 넘어간 경우다 — 남은 토스트가 그 위에 겹치지 않게 내린다
      hide();
      return;
    }
    if (distanceMeters === null) return;

    const message = resolveTreasureDistanceHint(distanceMeters);
    // 반경 안(=문구 없음)으로 들어오면 기억을 비워, 다시 밖으로 나갔을 때 안내가 한 번 더 뜨게 한다
    if (message === null) {
      lastShownRef.current = null;
      // 반경 안에서는 안내할 것이 없다. 밖에서 띄운 토스트가 남아 있으면 여기서 내린다
      hide();
      return;
    }
    if (message === lastShownRef.current) return;

    lastShownRef.current = message;
    // 카드가 없으면 비켜 갈 것도 없다 — 기본 여백으로 두면 토스트가 화면 아래에 제자리로 붙는다
    show(message, { variant: 'guide', bottomClearance: summaryCardHeight === null ? undefined : summaryCardClearance(summaryCardHeight) });
  }, [distanceMeters, enabled, summaryCardHeight, show, hide]);
}
