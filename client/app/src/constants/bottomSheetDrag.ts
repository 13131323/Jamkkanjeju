/**
 * 하단 시트를 손으로 끌어내려 닫는 제스처의 공통 문턱값.
 *
 * 협동 미션의 촬영 가이드 시트(PhotoGuideSheet)가 먼저 쓰던 값을 여기로 옮겼다.
 * 보물찾기 step1 시트도 "협동미션에서 한 것처럼" 닫혀야 해서 두 곳이 같은 값을 봐야 하는데,
 * 각자 상수를 들고 있으면 한쪽만 조정됐을 때 같은 손짓이 화면마다 다르게 반응한다.
 *
 * gesture-handler 대신 내장 PanResponder를 쓰는 이유는 쓰는 곳이 이 두 시트뿐이라
 * 의존성을 늘릴 이유가 없어서다(PhotoGuideSheet의 원래 주석 그대로).
 */

/** 이만큼 끌어내리면 놓는 순간 닫힌다 */
export const SHEET_DRAG_CLOSE_DISTANCE = 100;

/** 짧게 튕겨 내려도 닫히도록 하는 속도 문턱 */
export const SHEET_DRAG_CLOSE_VELOCITY = 0.8;

/** 세로로 이만큼 움직여야 드래그로 인정한다 — 탭이 드래그로 오인되지 않게 */
export const SHEET_DRAG_START_DISTANCE = 4;

/**
 * 손을 놓았을 때 닫아야 하는지.
 *
 * 거리와 속도를 OR로 보는 이유: 천천히 많이 끌어내린 손짓과 짧게 빠르게 튕긴 손짓 모두
 * "닫으려는 의도"다. 거리만 보면 플릭이 무시되고, 속도만 보면 느리게 끝까지 끌어내린 손짓이 무시된다.
 */
export function shouldCloseOnDragRelease(dy: number, vy: number): boolean {
  return dy > SHEET_DRAG_CLOSE_DISTANCE || vy > SHEET_DRAG_CLOSE_VELOCITY;
}

/**
 * 드래그로 인정할 만한 움직임인지(가로 스크롤·탭과 구분).
 *
 * 아래로 향한 움직임만 본다 — 시트는 제자리보다 위로 올라갈 자리가 없다.
 * 세로 성분이 가로보다 커야 한다는 조건이 없으면 지도를 좌우로 쓸어도 시트가 따라 내려온다.
 */
export function shouldStartSheetDrag(dy: number, dx: number): boolean {
  return dy > SHEET_DRAG_START_DISTANCE && Math.abs(dy) > Math.abs(dx);
}
