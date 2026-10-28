'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import iconCollaborationAsset from '@shared/lib/images/icon-mission-collaboration.png';
import iconCouponStoreAsset from '@shared/lib/images/icon-coupon-store.png';
import iconTreasureAsset from '@shared/lib/images/icon-mission-treasure.png';
import openChestAsset from '@shared/lib/images/treasure-chest-open.png';
import type { PlaceFilter } from '@features/place-filter';
import { subscribeUsedCoupons, usedCouponsVersion } from '@entities/coupon';
import type { PlaceLocationMission } from '@entities/place';
import type { Bounds, Coordinates } from '@shared/config/geo';
import { createClusterElement, createContentPinElement, createPlaceMarkerElement, type ClusterColorScheme } from './markerElements';
import { DETAIL_ENTRY_LEVEL, WIDE_SPLIT_ENTRY_LEVEL, type MapZoomTier } from './useMapZoomTier';
import { selectPlaceCoupon } from './placeCouponSelection';
import { usePlaceGroups } from './usePlaceGroups';

const iconTreasureSrc = iconTreasureAsset.src;
const iconCollaborationSrc = iconCollaborationAsset.src;
const iconCouponStoreSrc = iconCouponStoreAsset.src;
/** 이미 완료한 보물미션 — 보물찾기 step1이 '찾음'에 쓰는 열린 상자와 같은 에셋(useTreasureMarkers) */
const openChestSrc = openChestAsset.src;

// 할 일이 끝난 마커는 전체를 흐리게 하지 않고 **안쪽 아이콘 색만 어둡게** 한다.
// 마커 자체가 옅어지면 지도 위에서 그 자리가 잘 읽히지 않는다 — 핀은 그대로 두고 아이콘만 죽인다.
// 검정 50% 오버레이와 같은 결과다(brightness는 sRGB 값을 그대로 곱한다). 아이콘 위에 판을
// 덧대지 않아도 되므로 필터로 둔다.
const DONE_ICON_FILTER = 'brightness(0.5)';

// 로컬장소 마커는 방명록 마커보다 항상 위에 보이도록 z-index를 높게 둔다 (17지도phase2추가수정.md)
const PLACE_MARKER_Z_INDEX = 10;

// 원마커 클릭 시 확대해서 진입할 목표 레벨(WIDE_SPLIT_ENTRY_LEVEL / DETAIL_ENTRY_LEVEL)은
// 티어 경계와 같은 곳에서 관리한다 — useMapZoomTier.ts 참고.

// 원마커 크기: 6~7은 176px 고정, 8은 132px, 9는 88px — 줌아웃할수록 자연스럽게 작아지도록 (19지도phase3 이후 요청사항)
function clusterSize(level: number): number {
  if (level <= 7) return 176;
  if (level === 8) return 132;
  return 88;
}

// wide 티어(8~9) 원마커 색상: 필터가 'all'이면 primary, 필터로 미션 종류가 고정되면 그 미션 색상을 그대로 사용
function wideColorScheme(filter: PlaceFilter): ClusterColorScheme {
  if (filter === 'treasure') return 'tertiary';
  if (filter === 'coop') return 'sunny-yellow';
  return 'primary';
}

// 보물찾기/협동미션은 미션별 아이콘, 미션 없는 장소는 빈 아이콘 자리 (17지도phase2추가수정.md)
// 완료한 보물미션만 열린 상자로 바꾼다 — 보물찾기 step1이 찾은 보물에 쓰는 그 마커를 그대로 쓴다.
// 새 '완료' 표현(반투명·회색조 등)을 따로 만들지 않는 이유는 useTreasureMarkers와 같다.
function missionIconSrc(mission: PlaceLocationMission | null): string | undefined {
  if (mission?.type === 'TREASURE') return mission.isCompleted ? openChestSrc : iconTreasureSrc;
  if (mission?.type === 'COOPERATIVE') return iconCollaborationSrc;
  return undefined;
}

/** 이미 끝낸 협동미션인가. 보물미션과 달리 완료용 에셋이 없어 같은 아이콘을 어둡게 해서 구분한다 */
function isDoneCoopMission(mission: PlaceLocationMission | null): boolean {
  return mission?.type === 'COOPERATIVE' && mission.isCompleted;
}

// 쿠폰 마커 탭 시 CouponModalCard에 넘길 값. locationAddress는 서버가 그대로 준 필수값이라
// string이지만, useMapModal의 MapModalState는 app 진입 경로(주소가 없을 수 있음)와 모양을 맞추려
// string | null을 받는다 — 여기서 string을 넘겨도 그대로 들어간다.
export type PlaceCouponClickPayload = { couponLocation: string; couponPrice: number; locationAddress: string; locationImageUrl: string | null };

export type PlaceMarkerHandlers = {
  // 개별 마커(detail 티어) 중 미션 있는 장소 클릭 시 map_contents-modal
  // representativeImageUrl은 마커에 그린 장소 이미지 — map/modals 응답엔 장소 이미지가 없어 카드가 이걸 받아 쓴다
  onMissionClick: (locationId: number, representativeImageUrl: string | null) => void;
  // 개별 마커 중 미션 없는 장소 클릭 시 map_place-modal (20지도phase3-map-modal.md)
  onPlaceClick: (locationId: number, representativeImageUrl: string | null) => void;
  // 쿠폰 사용처 마커 클릭 시 CouponModalCard를 연다 — 쿠폰 여부가 미션 유무보다 우선한다.
  onCouponClick: (payload: PlaceCouponClickPayload) => void;
  // 대분류 원마커(wide/wideSplit) 클릭 시 그 좌표로 이동하며 한 단계 확대(줌인)한다.
  onClusterClick: (coords: Coordinates, targetLevel: number) => void;
};

// 마커 하나를 그리는 데 필요한 것. signature가 같으면 이미 그려진 오버레이를 그대로 둔다.
type MarkerSpec = {
  key: string;
  signature: string;
  coords: Coordinates;
  xAnchor: number;
  yAnchor: number;
  create: () => HTMLElement;
};

type DrawnMarker = { overlay: kakao.maps.CustomOverlay; signature: string };

// 지도를 조금만 움직여도 bounds가 새로 만들어져 장소 목록 참조가 바뀐다. 그때마다 오버레이를 전부 지우고 다시
// 만들면 <img>가 새로 생겨 사진이 다시 로드되며 깜빡인다. 그래서 key(장소 id 등)로 이미 그려진 마커를 알아보고,
// 내용(signature)이 그대로면 손대지 않는다 — 새로 들어온 것만 만들고, 사라진 것만 지운다.
export function usePlaceMarkers(
  map: kakao.maps.Map | null,
  bounds: Bounds | null,
  filter: PlaceFilter,
  tier: MapZoomTier,
  level: number,
  handlers: PlaceMarkerHandlers,
) {
  const result = usePlaceGroups(bounds, filter, tier, level, map !== null);
  const markersRef = useRef<Map<string, DrawnMarker>>(new Map());
  const drawnMapRef = useRef<kakao.maps.Map | null>(null);
  // 마커는 오래 살아남으므로 클릭 핸들러가 만들 때의 값을 붙들지 않게 ref로 읽는다.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  // usedCoupons 저장소가 바뀌면(다른 마커/시트에서 쿠폰을 사용 완료해도) 이 마커들도 다시 그려
  // 흐림 표시를 갱신해야 한다 — result가 그대로여도 재실행되도록 버전 값을 effect 의존성에 넣는다.
  // (흐림 여부는 signature에 들어 있어, 바뀐 마커만 다시 그려진다)
  const usedCouponsVersionValue = useSyncExternalStore(subscribeUsedCoupons, usedCouponsVersion, () => 0);

  useEffect(() => {
    if (!map) return;

    // 다른 지도 인스턴스에 붙어 있던 오버레이는 재사용할 수 없다
    if (drawnMapRef.current !== map) {
      markersRef.current.forEach(({ overlay }) => overlay.setMap(null));
      markersRef.current = new Map();
      drawnMapRef.current = map;
    }

    const specs: MarkerSpec[] = [];

    if (result.tier === 'wide') {
      const size = clusterSize(level);
      const colorScheme = wideColorScheme(filter);

      for (const group of result.groups) {
        specs.push({
          key: `wide:${group.key}`,
          signature: JSON.stringify([group.coords.lat, group.coords.lng, group.count, size, colorScheme]),
          coords: group.coords,
          xAnchor: 0.5,
          yAnchor: 0.5,
          create: () => {
            const el = createClusterElement(group.count, undefined, size, colorScheme);
            el.addEventListener('click', () => {
              handlersRef.current.onClusterClick(group.coords, WIDE_SPLIT_ENTRY_LEVEL);
            });
            return el;
          },
        });
      }
    } else if (result.tier === 'wideSplit') {
      const size = clusterSize(level);

      for (const cluster of result.clusters) {
        const colorScheme = cluster.missionType === 'treasure' ? 'tertiary' : 'sunny-yellow';
        specs.push({
          key: `split:${cluster.key}`,
          signature: JSON.stringify([cluster.coords.lat, cluster.coords.lng, cluster.count, size, colorScheme]),
          coords: cluster.coords,
          xAnchor: 0.5,
          yAnchor: 0.5,
          create: () => {
            const el = createClusterElement(cluster.count, undefined, size, colorScheme);
            el.addEventListener('click', () => {
              handlersRef.current.onClusterClick(cluster.coords, DETAIL_ENTRY_LEVEL);
            });
            return el;
          },
        });
      }
    } else {
      for (const place of result.places) {
        // 쿠폰 사용처가 미션 유무보다 먼저 갈린다 — 쿠폰이 있으면 미션이 있어도 쿠폰 마커 하나만
        // 그린다(usePlaceGroups가 이미 이 둘을 겹치지 않게 나눠 넘긴다).
        // 보물찾기/협동미션은 ContentPinMarker(미션별 아이콘), 미션 없는 장소는 클러스터링된 방명록 마커와 동일한
        // PlaceMarker 형태(사진박스+카운트배지+이름라벨)를 쓴다.
        const couponSelection = selectPlaceCoupon(place.locationTitle, place.receivedCoupons);

        specs.push({
          key: `place:${place.id}`,
          // 그려지는 모양과 클릭 때 넘기는 값에 쓰이는 것을 전부 담는다 — 하나라도 바뀌면 그 마커만 다시 그린다
          signature: JSON.stringify([
            place.coords.lat,
            place.coords.lng,
            place.locationTitle,
            place.guestbooksCount,
            place.representativeImageUrl,
            place.mission?.type ?? null,
            // 완료 여부로 아이콘이 갈리므로(missionIconSrc) 미션을 끝내고 돌아오면 이 마커만 다시 그려진다
            place.mission?.isCompleted ?? null,
            couponSelection ? [couponSelection.allUsed, couponSelection.coupon.couponPrice, couponSelection.coupon.locationAddress] : null,
          ]),
          coords: place.coords,
          xAnchor: 0.5,
          yAnchor: 1,
          create: () => {
            const el = couponSelection
              ? createContentPinElement(iconCouponStoreSrc)
              : place.mission === null
                ? createPlaceMarkerElement(place.locationTitle, place.guestbooksCount, place.representativeImageUrl ?? undefined)
                : createContentPinElement(missionIconSrc(place.mission));

            // 쿠폰을 전부 써버린 사용처와 이미 끝낸 협동미션은 핀 안쪽 아이콘만 어둡게 한다(핀 자체는 그대로).
            // 보물미션은 여기 해당하지 않는다 — 완료 표시로 쓸 에셋(열린 상자)이 따로 있어 아이콘 자체가 바뀐다.
            if (couponSelection?.allUsed || isDoneCoopMission(place.mission)) {
              const iconImage = el.querySelector('img');
              if (iconImage) iconImage.style.filter = DONE_ICON_FILTER;
            }

            el.addEventListener('click', () => {
              const { onCouponClick, onPlaceClick, onMissionClick } = handlersRef.current;
              if (couponSelection) {
                onCouponClick({
                  couponLocation: place.locationTitle,
                  couponPrice: couponSelection.coupon.couponPrice,
                  locationAddress: couponSelection.coupon.locationAddress,
                  locationImageUrl: place.representativeImageUrl,
                });
              } else if (place.mission === null) {
                onPlaceClick(place.id, place.representativeImageUrl);
              } else {
                onMissionClick(place.id, place.representativeImageUrl);
              }
            });
            return el;
          },
        });
      }
    }

    const previous = markersRef.current;
    const next = new Map<string, DrawnMarker>();

    for (const spec of specs) {
      const drawn = previous.get(spec.key);
      previous.delete(spec.key);

      if (drawn && drawn.signature === spec.signature) {
        next.set(spec.key, drawn);
        continue;
      }

      drawn?.overlay.setMap(null);
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(spec.coords.lat, spec.coords.lng),
        content: spec.create(),
        xAnchor: spec.xAnchor,
        yAnchor: spec.yAnchor,
        zIndex: PLACE_MARKER_Z_INDEX,
      });
      overlay.setMap(map);
      next.set(spec.key, { overlay, signature: spec.signature });
    }

    // 이번 목록에 없는 마커(화면을 벗어났거나 필터·줌 단계로 사라진 것)만 지운다
    previous.forEach(({ overlay }) => overlay.setMap(null));
    markersRef.current = next;
  }, [map, result, filter, level, usedCouponsVersionValue]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach(({ overlay }) => overlay.setMap(null));
      markersRef.current = new Map();
    };
  }, []);
}
