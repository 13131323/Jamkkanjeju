'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GuestbookWriteButton } from '@entities/guestbook';
import { useDisplayLocation } from '@entities/location';
import { PlaceFilterChips, useFilterState, useMissionCounts } from '@features/place-filter';
import { JEJU_CENTER, type Coordinates } from '@shared/config/geo';
import { GuestbookDetailModal } from '@widgets/guestbook-feed';
import { NavMenuButton } from '@widgets/nav-menu';
import { useNormalizedRoadGuestbook } from '../model/buildNormalizedRoadGuestbook';
import { parseCouponParams } from '../model/couponParams';
import { parseEntryCoords, parseMissionListParam } from '../model/mapEntryParams';
import { useCouponLocationCoords } from '../model/useCouponLocationCoords';
import { useCouponLocationMarker } from '../model/useCouponLocationMarker';
import { useEntryCoords } from '../model/useEntryCoords';
import { useGuestbookMarkers } from '../model/useGuestbookMarkers';
import { useKakaoMap } from '../model/useKakaoMap';
import { useMapBounds } from '../model/useMapBounds';
import { useMapFollow } from '../model/useMapFollow';
import { useDismissOnMapGesture } from '../model/useDismissOnMapGesture';
import { useMapModal } from '../model/useMapModal';
import { TREASURE_MODE_INITIAL_LEVEL, useMapZoomTier } from '../model/useMapZoomTier';
import { usePlaceMarkers, type PlaceCouponClickPayload } from '../model/usePlaceMarkers';
import { useTreasureLocationBridge } from '../model/useTreasureLocationBridge';
import { useTreasureLocationMarker } from '../model/useTreasureLocationMarker';
import { useTreasureMarkers } from '../model/useTreasureMarkers';
import { useTreasureMarkersBridge } from '../model/useTreasureMarkersBridge';
import { useUserLocationMarker } from '../model/useUserLocationMarker';
import { CouponModalCard } from './CouponModalCard';
import { FilteredMissionModalCard } from './FilteredMissionModalCard';
import { MissionModalCard } from './MissionModalCard';
import { PlaceModalCard } from './PlaceModalCard';

export function MapView({ isMenuOpen, onOpenMenu }: { isMenuOpen: boolean; onOpenMenu: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 보물찾기(TreasureHunt) step1 지도 모드 — 앱 WebView가 '/map?mode=treasure'로 진입한다
  // (docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §4 "미결 사항").
  const isTreasureMode = searchParams.get('mode') === 'treasure';
  const containerRef = useRef<HTMLDivElement>(null);

  // 진입 파라미터는 쿼리 문자열로 기억한다 — searchParams 객체 정체성이 렌더마다 바뀌어도
  // effect가 다시 돌지 않고, 사용자가 시트를 닫은 뒤 리렌더가 나도 다시 열리지 않는다.
  const entryQuery = searchParams.toString();
  const entryParams = useMemo(() => new URLSearchParams(entryQuery), [entryQuery]);
  const entryCoords = useMemo(() => parseEntryCoords(entryParams), [entryParams]);
  // useKakaoMap보다 먼저 호출해야 진입 시점의 중심·레벨이 이 좌표를 반영한다(useEntryCoords 주석).
  useEntryCoords(entryCoords);

  // step1은 클러스터 티어에서 열려야 한다 — 기본 진입 레벨(3)은 detail이라 보물이 처음부터
  // 개별 마커로 흩어진다(useMapZoomTier의 TREASURE_MODE_INITIAL_LEVEL 주석 참고)
  const { map, error } = useKakaoMap(containerRef, isTreasureMode ? TREASURE_MODE_INITIAL_LEVEL : undefined);
  const { coords } = useDisplayLocation();
  // GET /api/v1/map/* 는 사용자 좌표가 필수 쿼리라 위치 권한이 없으면 제주 중심으로 대체한다.
  const center = coords ?? JEJU_CENTER;
  const { isFollowing, resumeFollowing, stopFollowing } = useMapFollow(map);
  const { tier: zoomTier, level: zoomLevel } = useMapZoomTier(map);
  // wide/wideSplit 둘 다 좌표+미션유형만 있으면 되는 가벼운 응답(isClustered=true)으로 충분하다
  // (usePlaceGroups.ts 참고) — detail 티어만 상세 응답이 필요하다.
  const isClustered = zoomTier !== 'detail';
  const { filter, setFilter } = useFilterState();
  const bounds = useMapBounds(map);
  const missionCounts = useMissionCounts(bounds, isClustered);
  const { modal, openMissionModal, openPlaceModal, openFilteredMissionModal, openRoadGuestbookModal, openCouponModal, closeModal } = useMapModal();

  // app의 보물찾기 완료 화면에서 "사용하러 가기"로 들어온 경우 쿠폰 시트를 열어 준다.
  const couponParams = useMemo(() => parseCouponParams(entryParams), [entryParams]);
  useEffect(() => {
    if (!couponParams) return;
    // 시트에 필요한 값만 넘긴다 — locationId는 지도를 옮길지 정하는 데만 쓰고 시트는 보지 않는다.
    openCouponModal({
      couponLocation: couponParams.couponLocation,
      couponPrice: couponParams.couponPrice,
      locationAddress: couponParams.locationAddress,
      locationImageUrl: couponParams.locationImageUrl,
    });
  }, [couponParams, openCouponModal]);

  /**
   * 쿠폰 시트가 내려가 있는지.
   *
   * useMapModal에 얹지 않았다. 그 상태는 "어느 모달이 열려 있나"(한 번에 하나)를 답하는 union이고,
   * 접힘은 그 모달이 열려 있는 동안의 표시 상태라 다른 모달에는 없는 개념이다. 섞으면 union이
   * 모달별 표시 상태까지 떠안는다. 반대로 이 값은 시트(드래그)와 마커 탭 **두 곳**이 함께 읽어야 해서
   * CouponModalCard 안에 둘 수도 없다 — 두 소비자의 공통 부모인 여기가 유일한 자리다.
   */
  const [isCouponSheetCollapsed, setIsCouponSheetCollapsed] = useState(false);
  // 시트가 떠 있어도 지도는 그대로 끌 수 있다. 바깥 탭을 받던 투명 레이어가 지도를 덮고 있던 것을
  // 걷어내고, 닫기를 지도 제스처로 옮겼다(useDismissOnMapGesture).
  // 쿠폰 시트만 닫기가 아니라 접기다 — 마커를 다시 누르면 올라온다(CouponModalCard 주석).
  const isCouponSheetOpen = modal?.type === 'coupon' && !isCouponSheetCollapsed;
  const dismissSheet = useCallback(() => {
    if (isCouponSheetOpen) {
      setIsCouponSheetCollapsed(true);
      return;
    }
    closeModal();
  }, [isCouponSheetOpen, closeModal]);
  useDismissOnMapGesture(map, modal !== null, dismissSheet);

  // 쿠폰 사용처를 마커로 찍고 지도를 그 자리로 옮긴다. 시트만 열고 지도는 사용자 위치에 남아 있으면
  // "어디로 가라는 건지"가 화면에 없다.
  const couponCoords = useCouponLocationCoords(couponParams?.locationId ?? null, couponParams?.locationAddress ?? null);
  const couponMarkerHandlers = useMemo(
    () => ({
      onFocus: stopFollowing,
      // 마커 탭은 시트를 되올린다. 다른 마커를 눌러 쿠폰 모달이 밀려난 뒤라면 다시 열기까지 한다 —
      // 쿼리 파라미터로 여는 effect는 다시 돌지 않아, 여기서 열지 않으면 되돌아올 길이 없다.
      onPress: () => {
        if (couponParams) {
          openCouponModal({
            couponLocation: couponParams.couponLocation,
            couponPrice: couponParams.couponPrice,
            locationAddress: couponParams.locationAddress,
            locationImageUrl: couponParams.locationImageUrl,
          });
        }
        setIsCouponSheetCollapsed(false);
      },
    }),
    [couponParams, openCouponModal, stopFollowing],
  );
  useCouponLocationMarker(map, couponCoords, couponParams?.locationImageUrl ?? null, couponMarkerHandlers);

  // 지도에 찍힌 쿠폰 사용처 마커(usePlaceMarkers) 탭 — app 완료 화면 진입(위 couponMarkerHandlers)과
  // 같은 시트를 연다. 값은 그 장소 데이터에서 직접 만들어 넘긴다(별도 조회 없음).
  const handlePlaceCouponClick = useCallback(
    (payload: PlaceCouponClickPayload) => {
      openCouponModal(payload);
      setIsCouponSheetCollapsed(false);
    },
    [openCouponModal],
  );

  // app의 완료 화면 "근처에서 할 수 있는 보물 찾기 > 더보기"가 `/map?missions=treasure`로 들어온다.
  // 필터 칩 클릭 경로(handleFilterChange)와 **같은 상태**를 쓴다 — 칩도 함께 선택되고, 시트도 같은
  // FilteredMissionModalCard다.
  //
  // 칩 클릭과 다른 점 하나: 개수가 0이어도 연다. 칩 클릭은 배지에 0이 이미 보이므로 열지 않는 게
  // 맞지만, URL 진입은 "더보기를 눌렀는데 아무 일도 안 일어난" 화면이 된다. 0개일 때는 시트가
  // "근처 보물 0개"로 뜨는 것이 사용자에게 유일한 답이다. (개수는 bounds가 잡힌 뒤에야 알 수 있어
  // 진입 시점에 세는 것 자체가 불가능하기도 하다)
  const missionListParam = useMemo(() => parseMissionListParam(entryParams), [entryParams]);
  useEffect(() => {
    if (!missionListParam) return;
    setFilter(missionListParam);
    openFilteredMissionModal(missionListParam);
  }, [missionListParam, setFilter, openFilteredMissionModal]);

  const treasurePoint = useTreasureLocationBridge(isTreasureMode);
  const [showDevTools, setShowDevTools] = useState(false);
  const devToolsHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devToolsHoldTriggeredRef = useRef(false);
  const treasureMarkers = useTreasureMarkersBridge(isTreasureMode);

  // treasure 모드에서는 기존 사용자 위치 마커(📍+주소 라벨) 대신 빨간 원+방향 삼각형 마커를 그린다.
  useUserLocationMarker(map, isTreasureMode ? null : coords, isFollowing);
  useTreasureLocationMarker(map, treasurePoint);
  // 장소·방명록 마커는 treasure 모드 디자인에 없다.
  // 두 훅 모두 map이 null이면 아무것도 그리지 않으므로 map을 끊어 그대로 끈다.
  const markerMap = isTreasureMode ? null : map;
  // 대분류 원마커(wide/wideSplit) 클릭 시 그 좌표로 이동하며 한 단계 확대한다 (usePlaceMarkers.ts 참고).
  // 보물찾기 대표 마커도 같은 콜백을 쓴다 — 같은 지도에서 같은 제스처가 같게 동작해야 한다.
  const handleClusterClick = useCallback(
    (coords: Coordinates, targetLevel: number) => {
      if (!map) return;
      map.setCenter(new window.kakao.maps.LatLng(coords.lat, coords.lng));
      map.setLevel(targetLevel);
    },
    [map],
  );
  // 보물 마커는 앱이 브릿지로 좌표·찾음 여부를 보내준다.
  // 예전에는 "treasure 모드 지도에 현재 위치 마커 하나뿐"이었지만, prompt §9에서 step1 지도에
  // 보물 아이콘과 개수 배지가 추가됐다(TreasureHunt_step1 "Group 113").
  // zoomTier를 넘겨 축소에서는 장소 대표 마커 1개, 확대(detail)에서는 보물별 개별 마커로 갈린다.
  useTreasureMarkers(map, treasureMarkers, zoomTier, handleClusterClick);
  usePlaceMarkers(markerMap, bounds, filter, zoomTier, zoomLevel, {
    onMissionClick: openMissionModal,
    onPlaceClick: openPlaceModal,
    onCouponClick: handlePlaceCouponClick,
    onClusterClick: handleClusterClick,
  });
  useGuestbookMarkers(markerMap, bounds, zoomLevel, openRoadGuestbookModal);

  if (error) {
    return <div>지도를 불러오지 못했어요.</div>;
  }

  function startDevToolsHold() {
    if (process.env.NODE_ENV === 'production') return;
    devToolsHoldTriggeredRef.current = false;
    devToolsHoldTimerRef.current = setTimeout(() => {
      devToolsHoldTriggeredRef.current = true;
      setShowDevTools((prev) => !prev);
    }, 1000);
  }

  function cancelDevToolsHold() {
    if (devToolsHoldTimerRef.current) {
      clearTimeout(devToolsHoldTimerRef.current);
      devToolsHoldTimerRef.current = null;
    }
  }

  // 보물찾기/협동미션 필터 칩 클릭 시 해당 필터로 전환하면서 FilteredMissionModalCard를 함께 연다.
  // 칩에 표시되는 개수(bounds 기준)가 0이면 보여줄 게 없으니 모달은 열지 않는다.
  function handleFilterChange(next: typeof filter) {
    setFilter(next);
    if ((next === 'treasure' || next === 'coop') && missionCounts[next] > 0) {
      openFilteredMissionModal(next);
    }
  }

  function handleMapControlClick() {
    // 1초 꾹 누르기(dev 툴 토글)로 트리거된 경우, 뒤이어 발생하는 click에서는 지도 리셋 동작을 막는다.
    if (devToolsHoldTriggeredRef.current) {
      devToolsHoldTriggeredRef.current = false;
      return;
    }
    // setLevel이 zoom_changed를 유발해 useMapFollow가 follow를 꺼버리므로, resumeFollowing을 반드시 뒤에 호출해 follow 상태를 최종적으로 켠 채로 둔다 (17지도phase2추가수정.md)
    map?.setLevel(5);
    resumeFollowing();
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* 보물찾기 step1은 앱이 헤더·CTA를 네이티브로 얹는 전체화면 지도라, 웹 지도 화면의
          검색바·필터칩·캐릭터 이미지·방명록 버튼은 디자인에 없다. treasure 모드에서는 전부 숨긴다. */}
      {!isTreasureMode && (
        <>
          <button
            type="button"
            onClick={() => router.push('/map/search')}
            className="border-cool-neutral-200 bg-cool-neutral-white text-label-md text-warm-neutral-300 absolute right-4 left-4 z-10 flex h-10 items-center gap-2.5 rounded-full border px-3.5 font-medium"
            style={{ top: `calc(var(--safe-area-top) + 54px)` }}
          >
            <SearchIcon />
            <span>장소, 미션, 콘텐츠 검색</span>
          </button>

          {/* 칩 줄은 스크롤할 때 화면 가장자리까지 흐르도록 전체 너비로 두고, 기존 좌우 여백(16px)은 PlaceFilterChips 안쪽 패딩으로 옮겼다. */}
          <div className="absolute right-0 left-0 z-10" style={{ top: `calc(var(--safe-area-top) + 106px)` }}>
            <PlaceFilterChips value={filter} onChange={handleFilterChange} bounds={bounds} isClustered={isClustered} />
          </div>

          <div className="absolute right-4 z-10 flex items-center gap-2" style={{ top: `calc(var(--safe-area-top) + 162px)` }}>
            <button
              type="button"
              aria-label="지도 컨트롤"
              onClick={handleMapControlClick}
              onPointerDown={startDevToolsHold}
              onPointerUp={cancelDevToolsHold}
              onPointerLeave={cancelDevToolsHold}
              disabled={!coords}
              className="bg-cool-neutral-white flex h-[38px] w-[38px] items-center justify-center rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.08),0_3px_6px_-4px_rgba(0,0,0,0.12)] disabled:opacity-40"
            >
              <CrosshairIcon />
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && showDevTools && (
            <span className="absolute right-4 z-10 bg-white px-1.5 py-0.5 text-xs" style={{ top: `calc(var(--safe-area-top) + 204px)` }}>
              zoom tier: {zoomTier} (level: {zoomLevel})
            </span>
          )}

          <NavMenuButton isOpen={isMenuOpen} onClick={onOpenMenu} tooltipLabel="메뉴" className="absolute bottom-6 left-4 z-10" style={{ bottom: `calc(24px + var(--safe-area-bottom))` }} />
          {/* 화면 끝에서 떠 있는 요소는 디자인 여백(24px)에 안전영역을 더한다.
              --safe-area-bottom은 앱 WebView에서 항상 0이다(하단 inset은 앱 루트 레이아웃이 네이티브에서 처리).
              브라우저·iOS 단독 실행에서 홈 인디케이터가 있을 때만 값이 들어온다 */}
          {/* <Image src={navImage} alt="" aria-hidden="true" width={100} height={116} className="absolute left-4 z-10 object-contain" style={{ bottom: `calc(24px + var(--safe-area-bottom))` }} /> */}

          <GuestbookWriteButton className="absolute right-4 z-10" style={{ bottom: `calc(24px + var(--safe-area-bottom))` }} />
        </>
      )}

      {modal?.type === 'mission' && <MissionModalCard locationId={modal.locationId} markerImageUrl={modal.representativeImageUrl} coords={coords} onClose={closeModal} />}
      {modal?.type === 'place' && <PlaceModalCard locationId={modal.locationId} markerImageUrl={modal.representativeImageUrl} coords={coords} onClose={closeModal} />}
      {modal?.type === 'filteredMission' && <FilteredMissionModalCard missionType={modal.missionType} bounds={bounds} coords={coords} onClose={closeModal} />}
      {modal?.type === 'roadGuestbook' && <RoadGuestbookDetailModal guestbookId={modal.guestbookId} coords={coords} onClose={closeModal} />}
      {modal?.type === 'coupon' && (
        <CouponModalCard
          couponLocation={modal.couponLocation}
          couponPrice={modal.couponPrice}
          locationAddress={modal.locationAddress}
          locationImageUrl={modal.locationImageUrl}
          isCollapsed={isCouponSheetCollapsed}
          onCollapse={() => setIsCouponSheetCollapsed(true)}
          onExpand={() => setIsCouponSheetCollapsed(false)}
        />
      )}
    </div>
  );
}

// 길바닥 방명록 마커 클릭 시 여는 모달 — RoadGuestbookPlaceModalCard(바텀시트)를 대체해 방명록 페이지(travel-note)와 동일한
// 캐러셀형 GuestbookDetailModal UI를 쓴다. 마커 클릭은 방명록 1개만 알려주므로(클러스터링 없음) 1장짜리 캐러셀로 연다.
function RoadGuestbookDetailModal({ guestbookId, coords, onClose }: { guestbookId: number; coords: Coordinates | null; onClose: () => void }) {
  const { data: guestbook, isLoading } = useNormalizedRoadGuestbook(guestbookId, coords, JEJU_CENTER);
  if (isLoading || !guestbook) return null;

  return <GuestbookDetailModal guestbooks={[guestbook]} initialId={guestbook.key} onClose={onClose} />;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" className="text-warm-neutral-300" />
      <path d="M16 16l-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-warm-neutral-300" />
    </svg>
  );
}

function CrosshairIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.6" className="text-cool-neutral-900" />
      <circle cx="9" cy="9" r="1.9" className="fill-warm-neutral-900" />
      <path d="M9 0v3M9 15v3M0 9h3M15 9h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-cool-neutral-900" />
    </svg>
  );
}
