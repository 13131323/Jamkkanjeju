/**
 * step2 보물 아이콘이 서로 겹치지 않도록 가로로 벌린다.
 *
 * computeTreasurePlacement는 보물 하나만 보고 방위각으로 screenX를, 거리로 iconSize·iconTop을
 * 정한다. 그런데 서버는 한 장소에 보물 셋을 가까이 놓으므로 방위각도 거리도 비슷해져 아이콘이
 * 같은 자리에 겹쳐 그려졌다. 그러면 탭이 맨 위 하나로만 들어가 나머지를 찾을 수 없다.
 *
 * "정확한 방위각"보다 "누를 수 있음"을 우선한다 — 카메라 화면의 아이콘은 측량 도구가 아니라
 * 탭 대상이다. 보장하는 것은 두 가지다: 화면에 보이던 순서(왼쪽에 있던 것이 왼쪽)와,
 * 아이콘이 화면 안에 남는 것. 어느 아이콘이 원래 좌표를 지키는지는 보장하지 않는다.
 */
import type { TreasurePlacement } from './geoPlacement';

/** 아이콘 테두리 사이에 최소로 남길 간격(px). 손가락 폭을 생각해 여유를 둔다 */
export const MIN_ICON_EDGE_GAP_PX = 16;

/**
 * 원래 겹쳐 있던 아이콘을 위아래로도 어긋나게 하는 간격(px).
 *
 * 가로로만 벌리면 아이콘이 한 줄에 붙어 서서 어느 것이 어느 것인지 구분이 안 되고,
 * PinLabel("n번째 보물")도 같은 높이에서 맞붙는다. 계단식으로 내려 서로를 가리지 않게 한다.
 *
 * everSeen sticky(TreasureHuntCamera)가 들어오면서 보물 셋이 동시에 서 있는 시간이 훨씬 길어졌다.
 * 가까운 보물 아이콘은 123px이라 44로는 아래 아이콘이 위 아이콘에 거의 묻혀 44 → 56으로 올렸다.
 * 셋이면 중앙 기준 -56/0/+56이라 아이콘 세 개가 화면 중앙 한 화면 안에 남는다.
 *
 * **간격은 그대로 두되 "누가 어느 칸에 서는지"를 바꿨다.** 예전에는 x 순서대로 칸을 나눠 줘서
 * 왼쪽에서 오른쪽으로 일정하게 내려가는 — 정의상 완벽한 대각선이 됐다. 지금은 보물별 세로 지터
 * (geoPlacement의 verticalJitterPx) 순서로 칸을 나눠 준다. 겹치지 않는다는 보장은 그대로이고,
 * 배열만 x와 무관해져 "정렬 안 된" 모양이 된다.
 */
export const STAGGER_STEP_PX = 56;

interface Slot {
  /** 입력 순서. 결과를 같은 순서로 되돌리기 위해 들고 다닌다 */
  index: number;
  placement: TreasurePlacement;
}

/** 화면 밖으로 나가지 않도록 아이콘 중심을 가둔다 */
function clampToScreen(centerX: number, iconSize: number, screenWidthPx: number): number {
  const half = iconSize / 2;
  // 아이콘이 화면보다 넓으면 가둘 곳이 없다 — 가운데에 두어 최소한 양쪽이 같이 잘리게 한다
  if (iconSize >= screenWidthPx) return screenWidthPx / 2;
  return Math.min(Math.max(centerX, half), screenWidthPx - half);
}

function requiredGap(left: TreasurePlacement, right: TreasurePlacement): number {
  return left.iconSize / 2 + right.iconSize / 2 + MIN_ICON_EDGE_GAP_PX;
}

export function separateTreasurePlacements(placements: TreasurePlacement[], screenWidthPx: number): TreasurePlacement[] {
  const visible: Slot[] = [];
  placements.forEach((placement, index) => {
    if (placement.visible) visible.push({ index, placement });
  });

  if (visible.length === 0) return placements;

  // 한 개뿐이면 벌릴 상대가 없다. 화면 밖으로 나가지 않게 가두기만 한다 —
  // 시야를 벗어난 뒤에도 계속 그리는 보물(TreasureHuntCamera의 everSeen sticky)은 screenX가
  // 화면 밖(음수이거나 화면 폭보다 큰 값)이라, 가두지 않으면 "보이는데 안 보이는" 상태가 된다.
  if (visible.length === 1) {
    const only = visible[0];
    const clampedX = clampToScreen(only.placement.screenX, only.placement.iconSize, screenWidthPx);
    if (clampedX === only.placement.screenX) return placements;
    const single = [...placements];
    single[only.index] = { ...only.placement, screenX: clampedX };
    return single;
  }

  // 원래 x 순서를 유지해야 화면과 방위가 어긋나지 않는다(왼쪽에 보이던 보물이 왼쪽에 남는다).
  const byX = [...visible].sort((a, b) => a.placement.screenX - b.placement.screenX);
  const nextX = byX.map((slot) => slot.placement.screenX);

  // 왼→오: 왼쪽 화면 경계와 앞 아이콘에서 필요한 만큼 밀어낸다.
  for (let i = 0; i < byX.length; i += 1) {
    const half = byX[i].placement.iconSize / 2;
    const floor = i === 0 ? half : nextX[i - 1] + requiredGap(byX[i - 1].placement, byX[i].placement);
    nextX[i] = Math.max(nextX[i], floor);
  }

  // 오→왼: 오른쪽 경계를 넘은 만큼 되돌린다. 한 방향만 하면 마지막 아이콘이 화면 밖으로 나가고,
  // 그걸 개별로 clamp하면 다시 겹친다 — 두 패스를 함께 돌려야 순서·간격·경계가 모두 지켜진다.
  for (let i = byX.length - 1; i >= 0; i -= 1) {
    const half = byX[i].placement.iconSize / 2;
    const ceiling = i === byX.length - 1 ? screenWidthPx - half : nextX[i + 1] - requiredGap(byX[i].placement, byX[i + 1].placement);
    nextX[i] = Math.min(nextX[i], ceiling);
  }

  // 아이콘 합이 화면보다 넓으면 위 두 패스로도 간격을 다 만들 수 없다. 그때는 겹침을 받아들이고
  // 화면 안에 남는 것을 택한다 — 화면 밖 아이콘은 아예 누를 수 없다.
  for (let i = 0; i < byX.length; i += 1) {
    nextX[i] = clampToScreen(nextX[i], byX[i].placement.iconSize, screenWidthPx);
  }

  // 계단은 화면 중앙을 가운데에 두고 위아래로 펼친다. 한 방향으로만 내리면 아이콘이 아래로
  // 쏠려, 화면 중앙에 세운다는 기준(geoPlacement의 centeredIconTop)이 무너진다.
  //
  // 하나라도 밀렸으면 **보이는 아이콘 전부**를 어긋낸다. 밀린 것만 내리면 계단이 한쪽으로 치우쳐
  // 무리의 중심이 화면 중앙에서 벗어난다 — 세로 위치는 이제 거리를 뜻하지 않으므로(중앙 고정)
  // 자리를 지킨 아이콘을 함께 올리고 내려도 잃는 정보가 없다.
  const isStaggered = byX.some((slot, position) => Math.abs(nextX[position] - slot.placement.screenX) > 0.001);
  const staggerCenter = (byX.length - 1) / 2;

  // 계단 칸을 나눠 주는 순서. **x가 아니라 세로 지터 순서**다(STAGGER_STEP_PX 주석 참고).
  // 지터는 보물 id에서 나온 결정론적 값이라 이 순서도 프레임마다 흔들리지 않는다.
  // 값이 같으면 입력 순서로 갈라 정렬을 안정시킨다 — 안 그러면 엔진에 따라 순서가 달라질 수 있다.
  const staggerRank = new Map<number, number>();
  [...byX]
    .sort((a, b) => a.placement.verticalJitterPx - b.placement.verticalJitterPx || a.index - b.index)
    .forEach((slot, rank) => staggerRank.set(slot.index, rank));

  const result = [...placements];
  byX.forEach((slot, position) => {
    // 계단을 쓸 때는 지터를 걷어내고 중앙 기준선에서 다시 쌓는다 — 둘을 함께 더하면
    // 오프셋이 두 번 얹혀 안전 구간(verticalJitter.ts)을 벗어난다.
    const centeredTop = slot.placement.iconTop - slot.placement.verticalJitterPx;
    const staggeredTop = centeredTop + STAGGER_STEP_PX * ((staggerRank.get(slot.index) ?? position) - staggerCenter);

    result[slot.index] = {
      ...slot.placement,
      screenX: nextX[position],
      iconTop: isStaggered ? staggeredTop : slot.placement.iconTop,
      // 계단을 얹었으면 "지금 top에 들어 있는 세로 오프셋"도 그 값으로 갱신한다 —
      // 이 필드는 언제나 `iconTop - 중앙 기준선`이어야 한다.
      verticalJitterPx: isStaggered ? staggeredTop - centeredTop : slot.placement.verticalJitterPx,
    };
  });

  return result;
}
