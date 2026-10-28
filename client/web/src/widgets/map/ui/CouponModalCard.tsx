'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { toCouponUsageConditions } from '@packages/shared';
import { isCouponUsed, markCouponUsed, subscribeUsedCoupons, usedCouponServerSnapshot } from '@entities/coupon';
import { toHttpsImageUrl } from '@shared/lib/imageUrl';
import { SHEET_BOTTOM_PADDING } from '../model/sheetLayout';

export type CouponModalPayload = {
  /** 쿠폰 사용처. 서버의 couponLocation */
  couponLocation: string;
  couponPrice: number;
  /** 사용처와 이름이 일치한 LOCATION의 주소. 일치 장소가 없으면 null */
  locationAddress: string | null;
  /** 사용처 장소의 TourAPI 대표 이미지. 없으면 null */
  locationImageUrl: string | null;
};

type CouponModalCardProps = CouponModalPayload & {
  /** 시트가 내려가 있는 상태인지. 상태는 MapView가 들고 있다(마커 탭도 같은 값을 바꾼다) */
  isCollapsed: boolean;
  /** 아래로 끌어 내렸을 때. 닫지 않고 손잡이만 남긴다 */
  onCollapse: () => void;
  /** 손잡이를 위로 끌어 올렸을 때. 마커 탭과 같은 결과다 */
  onExpand: () => void;
};

// PlaceModalCard와 같은 값 — 두 시트가 같은 제스처 세기로 반응해야 한다.
// 이 시트에서만 결과가 다르다: 닫히는 게 아니라 내려간다(아래 주석 참고).
const DRAG_THRESHOLD_PX = 80;

/**
 * 내려간 상태에서 화면 아래에 남겨 둘 높이(px).
 *
 * 완전히 밀어내지 않는 이유는 두 가지다 — 시트가 사라진 것처럼 보이면 사용자가 "닫혔다"고 읽고,
 * 다시 올릴 손잡이가 없어져 마커 탭이 유일한 복구 경로가 된다. 손잡이 줄(패딩 12 + 바 4 + 12)
 * 정도만 남긴다.
 */
const COLLAPSED_PEEK_PX = 28;

/**
 * 쿠폰 사용 바텀시트(쿠폰사용.png).
 *
 * 앱의 보물찾기 완료 화면에서 "사용하러 가기"로 들어온다. 지도 위에 뜨는 시트라
 * PlaceModalCard와 같은 껍데기(핸들·포인터 드래그·슬라이드업)를 그대로 쓴다.
 *
 * 다만 **드래그의 결과가 다르다**. PlaceModalCard는 끌어내리면 닫히지만(마커를 다시 누르면
 * 같은 모달이 다시 열린다) 이 시트는 닫으면 되돌아올 길이 없다 — 쿼리 파라미터로 한 번 열린
 * 시트라 열림 effect가 다시 돌지 않는다. 그래서 여기서는 닫지 않고 **내려간다**:
 * 지도와 사용처 마커가 온전히 보이고, 마커를 누르거나 손잡이를 올리면 다시 올라온다.
 *
 * 쿠폰 정보는 app이 쿼리 파라미터로 넘긴다 — completion API가 이미 준 값이라
 * web에서 다시 조회하지 않는다.
 */
export function CouponModalCard({ couponLocation, couponPrice, locationAddress, locationImageUrl, isCollapsed, onCollapse, onExpand }: CouponModalCardProps) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  // 원격 대표 이미지는 404·만료로 실패할 수 있다. 그대로 두면 브라우저가 깨진 이미지 아이콘을 그린다 —
  // 실패하면 이미지가 아예 없을 때와 같은 회색 판으로 되돌린다.
  const [hasImageError, setHasImageError] = useState(false);

  // localStorage는 React 밖의 상태다. effect에서 setState로 읽으면 cascading render가 되고
  // 서버 렌더에는 저장소가 없어 hydration이 어긋난다 — 외부 저장소 구독으로 읽는다.
  const getSnapshot = useCallback(() => isCouponUsed(couponLocation, couponPrice), [couponLocation, couponPrice]);
  const isUsed = useSyncExternalStore(subscribeUsedCoupons, getSnapshot, usedCouponServerSnapshot);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragStartYRef.current = e.clientY;
    setIsDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartYRef.current === null) return;
    const delta = e.clientY - dragStartYRef.current;
    // 펼친 상태에서는 아래로만, 내린 상태에서는 위로만 따라간다 — 반대 방향으로 끌면 시트가
    // 화면 밖으로 나가거나 위로 뜬다.
    setDragY(isCollapsed ? Math.min(0, delta) : Math.max(0, delta));
  }

  function handlePointerUp() {
    if (!isCollapsed && dragY > DRAG_THRESHOLD_PX) {
      onCollapse();
    } else if (isCollapsed && dragY < -DRAG_THRESHOLD_PX) {
      onExpand();
    }
    setDragY(0);
    setIsDragging(false);
    dragStartYRef.current = null;
  }

  function handleUseCoupon() {
    // 저장이 구독자에게 알리므로 여기서 따로 상태를 바꾸지 않는다
    markCouponUsed(couponLocation, couponPrice);
  }

  // translateY의 100%는 **시트 자기 높이** 기준이라, 높이를 측정하지 않고도 "손잡이만 남기고 내리기"를
  // calc으로 그대로 쓸 수 있다(내용 길이에 따라 시트 높이가 달라지는 화면이라 측정은 리사이즈 관찰까지 끌고 온다).
  const sheetTransform = !isVisible ? 'translateY(100%)' : isCollapsed ? `translateY(calc(100% - ${COLLAPSED_PEEK_PX}px + ${dragY}px))` : `translateY(${dragY}px)`;

  return (
    <>
      {/* 바깥 탭을 받던 투명 레이어는 걷어냈다 — 지도를 통째로 덮어 시트가 떠 있는 동안 지도를 끌 수
          없었다. 지금은 지도 탭이 내리는 신호다(MapView의 useDismissOnMapGesture). 닫지 않고 내리는
          이유는 그대로다 — 닫으면 되돌아올 길이 없고, 마커 탭이 되올리는 유일한 경로다. */}
      <div
        className={`bg-cool-neutral-white absolute inset-x-0 bottom-0 z-20 flex max-h-[70%] flex-col rounded-t-xl shadow-[4px_4px_14px_rgba(0,0,0,0.12)] ${
          isDragging ? '' : 'transition-transform duration-300 ease-out'
        }`}
        style={{ transform: sheetTransform }}
      >
        {/* 손잡이 줄만 드래그 영역이면 잡을 곳이 28px뿐이라 끌기가 잘 인식되지 않았다 —
            제목까지 드래그 영역에 넣는다. 그래서 제목은 스크롤 밖 고정이고 스크롤은 사진부터 시작한다.
            드래그 중 제목 글자가 선택되지 않게 select-none을 건다 */}
        <div
          className="shrink-0 px-4 pt-3 select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="flex justify-center">
            <div className="bg-warm-neutral-100 h-1 w-10 rounded-full" />
          </div>

          <div className="flex flex-col gap-1 pt-4">
            <span className="text-label-md text-warm-neutral-600 font-medium">{couponLocation}</span>
            {/* 디자인 문구는 "천원 할인"이지만 서버는 금액을 숫자로 준다 — 한글 수사로 되돌릴 규칙이 없어 숫자 표기를 쓴다 */}
            <h2 className="text-heading-h3 text-warm-neutral-900 font-bold">보물찾기 완료 {couponPrice.toLocaleString('ko-KR')}원 할인 쿠폰</h2>
          </div>
        </div>

        <div className="flex grow flex-col gap-4 overflow-y-auto px-4 pt-4">
          {/* TourAPI 대표 이미지라 없을 수 있다. 빈 자리를 남기지 않고 회색 판으로 둔다 */}
          {locationImageUrl && !hasImageError ? (
            // 외부 이미지 도메인을 next.config에 등록하지 않아도 되도록 img를 그대로 쓴다
            // eslint-disable-next-line @next/next/no-img-element
            <img src={toHttpsImageUrl(locationImageUrl)} alt="" aria-hidden="true" onError={() => setHasImageError(true)} className="h-45 w-full rounded-lg object-cover" />
          ) : (
            <div className="bg-warm-neutral-100 h-45 w-full rounded-lg" />
          )}

          {locationAddress && (
            <div className="bg-warm-neutral-50 flex items-center gap-1.5 rounded-lg px-3 py-2.5">
              <PinIcon />
              <span className="text-label-md text-warm-neutral-700 font-medium">{locationAddress}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-label-lg text-warm-neutral-900 font-bold">사용조건</span>
            <ul className="flex flex-col gap-1.5">
              {toCouponUsageConditions(couponPrice).map((condition) => (
                <li key={condition} className="text-body-sm text-warm-neutral-700 flex gap-2">
                  <span aria-hidden="true">·</span>
                  <span>{condition}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-4" style={{ paddingBottom: SHEET_BOTTOM_PADDING }}>
          {/* 지도 모달의 CTA와 같은 pill 버튼 — MissionListItem의 "미션 시작"을 그대로 쓴다.
              이 시트만 rounded-lg 각진 버튼이라 같은 지도 위에서 모양이 갈렸다. 색도 그 CTA의
              tertiary-800에 맞춘다. 높이는 장소 상세의 "미션 시작하기"와 같은 h-12로 맞춰 둔다
              (padding으로 높이를 만들면 글자 크기에 따라 버튼마다 높이가 갈린다).
              누르면 되돌릴 수 없으므로 disabled로 바꿔 두 번 눌리지 않게 한다 */}
          <button
            type="button"
            onClick={handleUseCoupon}
            disabled={isUsed}
            className={`text-label-md text-cool-neutral-white flex h-12 w-full items-center justify-center rounded-full font-medium ${isUsed ? 'bg-warm-neutral-300' : 'bg-tertiary-800'}`}
          >
            {isUsed ? '쿠폰 사용 완료' : '쿠폰 사용하기'}
          </button>
        </div>
      </div>
    </>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M7 1.5c-2.2 0-4 1.75-4 3.9 0 2.8 4 7.1 4 7.1s4-4.3 4-7.1c0-2.15-1.8-3.9-4-3.9Z" stroke="currentColor" strokeWidth="1.2" className="text-warm-neutral-500" />
      <circle cx="7" cy="5.4" r="1.4" className="fill-warm-neutral-500" />
    </svg>
  );
}
