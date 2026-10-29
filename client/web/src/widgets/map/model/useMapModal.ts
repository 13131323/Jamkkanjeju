'use client';

import { useCallback, useState } from 'react';

export type MapModalState =
  // representativeImageUrl: 클릭한 마커가 그린 장소 이미지. 카드가 자기 응답에 장소 이미지가 없을 때 대신 쓴다
  | { type: 'mission'; locationId: number; representativeImageUrl: string | null }
  | { type: 'place'; locationId: number; representativeImageUrl: string | null }
  | { type: 'placeCoupon'; locationId: number; hasMission: boolean; couponLocation: string; couponPrice: number; locationAddress: string | null; locationImageUrl: string | null }
  | { type: 'filteredMission'; missionType: 'treasure' | 'coop' }
  | { type: 'roadGuestbook'; guestbookId: number }
  // 쿠폰 사용 시트(쿠폰사용.png). 마커 클릭이 아니라 app이 넘긴 쿼리 파라미터로 열린다 —
  // 쿠폰 정보는 completion API가 이미 준 값이라 web에서 다시 조회하지 않는다.
  | { type: 'coupon'; couponLocation: string; couponPrice: number; locationAddress: string | null; locationImageUrl: string | null }
  | null;

// map_contents-modal / map_place-modal / map_road-guestbook-modal 오픈 상태 (20지도phase3-map-modal.md)
// 콜백을 useCallback으로 고정해 usePlaceMarkers/useGuestbookMarkers의 effect가 모달 오픈마다 불필요하게 재실행되지 않도록 한다.
export function useMapModal() {
  const [modal, setModal] = useState<MapModalState>(null);

  const openMissionModal = useCallback((locationId: number, representativeImageUrl: string | null) => setModal({ type: 'mission', locationId, representativeImageUrl }), []);
  const openPlaceModal = useCallback((locationId: number, representativeImageUrl: string | null) => setModal({ type: 'place', locationId, representativeImageUrl }), []);
  // PlaceFilterChips에서 보물찾기/협동미션 칩 클릭 시 자동으로 여는 목록 모달(FilteredMissionModalCard).
  const openFilteredMissionModal = useCallback((missionType: 'treasure' | 'coop') => setModal({ type: 'filteredMission', missionType }), []);
  // 길바닥 방명록 마커 클릭 시 여는 모달(RoadGuestbookDetailModal) — targetType=ROAD_GUESTBOOK, 장소와 무관하게 방명록 id로 연다.
  const openRoadGuestbookModal = useCallback((guestbookId: number) => setModal({ type: 'roadGuestbook', guestbookId }), []);
  const openCouponModal = useCallback((payload: Omit<Extract<MapModalState, { type: 'coupon' }>, 'type'>) => setModal({ type: 'coupon', ...payload }), []);
  const openPlaceCouponModal = useCallback((payload: Omit<Extract<MapModalState, { type: 'placeCoupon' }>, 'type'>) => setModal({ type: 'placeCoupon', ...payload }), []);
  const closeModal = useCallback(() => setModal(null), []);

  return { modal, openMissionModal, openPlaceModal, openFilteredMissionModal, openRoadGuestbookModal, openCouponModal, openPlaceCouponModal, closeModal };
}
