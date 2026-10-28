package com.jamkkanjeju.server.domain.map.service;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import com.jamkkanjeju.server.domain.guestbook.repository.LocationGuestbookRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.LocationGuestbookRepository.LocationCount;
import com.jamkkanjeju.server.domain.guestbook.repository.RoadGuestbookRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.RoadGuestbookRepository.Position;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.home.repository.AcquiredCouponRepository;
import com.jamkkanjeju.server.domain.map.dto.GetClusteredMapContentsResponse;
import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse;
import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.GuestbookInfo;
import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.RewardDetail;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsRequest;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse.LocationInfo;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse.MissionInfo;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse.ReceivedCoupon;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse.RoadGuestbookInfo;
import com.jamkkanjeju.server.domain.map.dto.GetMapLocationDetailRequest;
import com.jamkkanjeju.server.domain.map.dto.GetMapLocationDetailResponse;
import com.jamkkanjeju.server.domain.map.dto.GetMapLocationDetailResponse.GuestbooksPage;
import com.jamkkanjeju.server.domain.map.dto.GetMapLocationDetailResponse.NearbyMissionInfo;
import com.jamkkanjeju.server.domain.map.dto.GetMapModalRequest;
import com.jamkkanjeju.server.domain.map.dto.GetRoadGuestbookMapModalResponse;
import com.jamkkanjeju.server.domain.map.dto.GetMapSearchRequest;
import com.jamkkanjeju.server.domain.map.dto.GetMapSearchResponse;
import com.jamkkanjeju.server.domain.map.dto.GetMapSearchResponse.LocationsPage;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.exception.MapErrorCode;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import com.jamkkanjeju.server.domain.map.repository.VisitedLocationRepository;
import com.jamkkanjeju.server.domain.map.service.NearbyMissionRecommender.RecommendedMission;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatusId;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.mission.repository.LocationMissionReference;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 지도 홈·장소 상세·검색 결과와 선택한 장소·길바닥 방명록의 모달을 현재 사용자 기준으로 조회한다. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MapService {

    private static final int MODAL_GUESTBOOK_LIMIT = 3;
    private static final int DETAIL_IMAGE_LIMIT = 5;

    private final UserRepository userRepository;
    private final LocationRepository locationRepository;
    private final RoadGuestbookRepository roadGuestbookRepository;
    private final LocationGuestbookRepository locationGuestbookRepository;
    private final TreasureMissionRepository treasureMissionRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final TreasureMissionProgressRepository treasureMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    private final AcquiredCouponRepository acquiredCouponRepository;
    private final MissionCompletionChecker missionCompletionChecker;
    private final TravelEstimator travelEstimator;
    private final TourApiClient tourApiClient;
    private final VisitedLocationRepository visitedLocationRepository;
    private final MissionRewardStatusRepository missionRewardStatusRepository;
    private final NearbyMissionRecommender nearbyMissionRecommender;

    /** 검증된 요청을 받아 플래그에 맞는 상세 또는 간소 DTO 자체를 반환한다. 공통 응답 래퍼는 만들지 않는다. */
    public Object getMapContents(Long userId, GetMapContentsRequest request) {
        // 1. 현재 사용자 확인 (요청값 검증은 DTO의 Bean Validation을 사용한다)
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 사용자 위치와 별개로 화면 범위를 한 번만 확장한다
        MapViewport viewport = MapViewport.expanded(request.leftTopLatitude(), request.leftTopLongitude(),
                request.rightBottomLatitude(), request.rightBottomLongitude());

        // 3. 미션·방명록·쿠폰이 없는 장소도 포함한다
        List<Location> locations = locationRepository.findAllByLatitudeBetweenAndLongitudeBetween(
                viewport.minLatitude(), viewport.maxLatitude(), viewport.minLongitude(), viewport.maxLongitude());
        List<Long> locationIds = locations.stream().map(Location::getId).toList();

        // 4. 응답 형식 분기 (간소 응답에서는 상세 정보 조회·계산을 생략한다)
        if (request.isClustered()) {
            return clusteredContents(locations, locationIds, viewport);
        }

        List<RoadGuestbook> roadGuestbooks = roadGuestbookRepository
                .findAllByGuestbookStatusAndLatitudeBetweenAndLongitudeBetween(
                        GuestbookStatus.ACTIVE, viewport.minLatitude(), viewport.maxLatitude(),
                        viewport.minLongitude(), viewport.maxLongitude());
        List<RoadGuestbookInfo> roadItems = roadGuestbooks.stream().map(RoadGuestbookInfo::from).toList();
        if (locationIds.isEmpty()) {
            return GetMapContentsResponse.of(List.of(), roadItems);
        }

        // 5. 장소별 활성 미션 조회 및 중복 검증
        Map<Long, LocatedMission> missions = detailedMissions(locationIds);

        // 6. 사용자별 완료·작성 여부와 장소별 방명록 수·수령 쿠폰 조회
        Set<Long> completedIds = completedMissionIds(userId, missions.values());
        Set<MissionGuestbookKey> writtenGuestbooks = writtenMissionGuestbooks(userId, missions, completedIds);
        Map<Long, Long> guestbookCounts = locationGuestbookRepository
                .countByLocationIdsAndStatus(locationIds, GuestbookStatus.ACTIVE).stream()
                .collect(Collectors.toMap(LocationCount::getLocationId, LocationCount::getGuestbookCount));
        Map<Long, List<ReceivedCoupon>> coupons = receivedCoupons(userId, locationIds);

        // 7. 장소 대표 이미지 조회 및 거리·시간 구성
        Map<Long, String> imageUrls = locationImageUrls(locations);
        List<LocationInfo> items = locations.stream().map(location -> {
            LocatedMission locatedMission = missions.get(location.getId());
            MissionInfo missionInfo = null;
            if (locatedMission != null) {
                Mission mission = locatedMission.mission();
                boolean completed = completedIds.contains(mission.getId());
                Boolean hasWritten = completed
                        ? writtenGuestbooks.contains(new MissionGuestbookKey(location.getId(), mission.getId())) : null;
                missionInfo = MissionInfo.of(mission, completed, hasWritten);
            }
            TravelEstimate travel = travelEstimator.estimate(request.userLatitude(), request.userLongitude(), location);
            return LocationInfo.of(location, travel, missionInfo,
                    guestbookCounts.getOrDefault(location.getId(), 0L), imageUrls.get(location.getContentId()),
                    coupons.get(location.getId()));
        }).toList();

        // 8. 상세 응답 구성
        return GetMapContentsResponse.of(items, roadItems);
    }

    /** 현재 사용자를 확인하고 선택한 유형의 모달 DTO 자체를 반환한다. */
    public Object getMapModal(Long userId, GetMapModalRequest request) {
        // 1. 현재 사용자 확인 (요청값 검증은 DTO의 Bean Validation을 사용한다)
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2~4. 길바닥 방명록이면 활성 대상 조회 및 거리·시간 계산
        if ("ROAD_GUESTBOOK".equals(request.targetType())) {
            RoadGuestbook roadGuestbook = roadGuestbookRepository
                    .findByGuestbookIdAndGuestbookStatus(request.targetId(), GuestbookStatus.ACTIVE)
                    .orElseThrow(() -> new BusinessException(MapErrorCode.MAP_MODAL_TARGET_NOT_FOUND));
            TravelEstimate travel = travelEstimator.estimate(request.userLatitude(), request.userLongitude(),
                    roadGuestbook.getLatitude(), roadGuestbook.getLongitude());

            // 8~9. 작성자 닉네임·저장된 콘텐츠로 길바닥 방명록 응답 구성
            return GetRoadGuestbookMapModalResponse.of(roadGuestbook, travel);
        }

        // 2~4. 장소 존재 확인 및 실제 사용자 위치 기준 거리·시간 계산
        Location location = locationRepository.findById(request.targetId())
                .orElseThrow(() -> new BusinessException(MapErrorCode.MAP_MODAL_TARGET_NOT_FOUND));
        TravelEstimate travel = travelEstimator.estimate(request.userLatitude(), request.userLongitude(), location);

        // 5. 미션 유형을 합쳐 활성 미션 중복 검증
        ModalMission modalMission = locationModalMission(location.getId());

        // 6. 대표 이미지·방문 여부·미션 완료·항목별 보상 수령 여부 구성 (조회 중 지급하지 않는다)
        String imageUrl = tourApiClient.getLocationImageUrl(location.getContentId());
        boolean visited = visitedLocationRepository.existsByUserIdAndLocationId(userId, location.getId());
        GetLocationMapModalResponse.MissionInfo missionInfo = null;
        if (modalMission != null) {
            Mission mission = modalMission.mission();
            boolean completed = isMissionCompleted(userId, mission);
            MissionRewardStatus rewardStatus = missionRewardStatusRepository
                    .findById(new MissionRewardStatusId(mission.getId(), userId)).orElse(null);
            RewardDetail rewardDetail = RewardDetail.of(
                    modalMission.arCharacter(), modalMission.point(), modalMission.coupon(), rewardStatus);
            missionInfo = GetLocationMapModalResponse.MissionInfo.of(mission, completed, rewardDetail);
        }

        // 7. 같은 ACTIVE 조건으로 전체 개수와 최신 최대 세 건을 별도 조회
        long guestbooksCount = locationGuestbookRepository
                .countByLocationIdsAndStatus(List.of(location.getId()), GuestbookStatus.ACTIVE).stream()
                .mapToLong(LocationCount::getGuestbookCount).sum();
        List<GuestbookInfo> guestbooks = locationGuestbookRepository.findAllByLocationIdAndStatus(
                        location.getId(), GuestbookStatus.ACTIVE, PageRequest.of(0, MODAL_GUESTBOOK_LIMIT)).stream()
                .map(GuestbookInfo::from).toList();

        // 9. 장소 모달 응답 구성
        return GetLocationMapModalResponse.of(location, imageUrl, travel, visited, missionInfo,
                guestbooksCount, guestbooks);
    }

    /** 장소 상세의 기본 정보·주변 미션·방명록 페이지와 현재 장소 미션을 조회한다. */
    public GetMapLocationDetailResponse getMapLocationDetail(Long userId, Long locationId,
                                                            GetMapLocationDetailRequest request) {
        // 1. 현재 사용자 확인
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 장소 존재 확인
        Location location = locationRepository.findById(locationId)
                .orElseThrow(() -> new BusinessException(MapErrorCode.LOCATION_NOT_FOUND));

        // 3. 실제 사용자 위치 기준 거리·시간 및 방문 여부 구성
        TravelEstimate travel = travelEstimator.estimate(request.userLatitude(), request.userLongitude(), location);
        boolean visited = visitedLocationRepository.existsByUserIdAndLocationId(userId, locationId);

        // 4. 장소 설명·상세 이미지 조회 (외부 부가 정보 없음은 null로 유지한다)
        String description = tourApiClient.getLocationOverview(location.getContentId());
        List<String> detailImages = tourApiClient.getLocationDetailImageUrls(location.getContentId(), DETAIL_IMAGE_LIMIT);

        // 5. 활성·미완료 보물찾기와 협동 미션을 합쳐 가까운 최대 세 건 선정
        List<RecommendedMission> recommended = nearbyMissionRecommender
                .recommend(userId, request.userLatitude(), request.userLongitude());

        // 6. 선정된 미션의 보상·지급 상태와 장소 대표 이미지만 조회하여 추천 순서대로 구성
        Map<Long, ModalMission> rewardSettings = recommendedMissionRewards(recommended);
        List<Long> recommendedIds = recommended.stream().map(item -> item.mission().getId()).toList();
        Map<Long, MissionRewardStatus> rewardStatuses = recommendedIds.isEmpty() ? Map.of()
                : missionRewardStatusRepository.findAllByIdUserIdAndIdMissionIdIn(userId, recommendedIds).stream()
                        .collect(Collectors.toMap(status -> status.getId().getMissionId(), Function.identity()));
        Map<Long, String> images = locationImageUrls(recommended.stream().map(RecommendedMission::location).toList());
        List<NearbyMissionInfo> nearbyMissions = recommended.stream().map(item -> {
            ModalMission settings = rewardSettings.get(item.mission().getId());
            RewardDetail reward = RewardDetail.of(settings.arCharacter(), settings.point(), settings.coupon(),
                    rewardStatuses.get(item.mission().getId()));
            GetMapLocationDetailResponse.MissionInfo missionInfo = GetMapLocationDetailResponse.MissionInfo
                    .of(item.mission(), false, reward);
            return NearbyMissionInfo.of(missionInfo, item.location(), images.get(item.location().getContentId()));
        }).toList();

        // 7. ACTIVE 방명록의 요청 페이지와 다음 페이지 존재 여부 조회
        Slice<LocationGuestbook> page = locationGuestbookRepository.findSliceByLocationIdAndStatus(
                locationId, GuestbookStatus.ACTIVE, PageRequest.of(request.page(), request.size()));
        List<GuestbookInfo> guestbooks = page.getContent().stream().map(GuestbookInfo::from).toList();
        GuestbooksPage pageInfo = GuestbooksPage.of(request.page(), request.size(), page.hasNext());

        // 8. 현재 장소의 활성 미션 중복 검증 및 완료·전체 보상 조합
        ModalMission currentMission = locationModalMission(locationId);
        GetMapLocationDetailResponse.MissionInfo locationMission = null;
        if (currentMission != null) {
            Mission mission = currentMission.mission();
            MissionRewardStatus status = rewardStatuses.get(mission.getId());
            if (!recommendedIds.contains(mission.getId())) {
                status = missionRewardStatusRepository.findById(new MissionRewardStatusId(mission.getId(), userId))
                        .orElse(null);
            }
            RewardDetail reward = RewardDetail.of(currentMission.arCharacter(), currentMission.point(),
                    currentMission.coupon(), status);
            locationMission = GetMapLocationDetailResponse.MissionInfo.of(mission, isMissionCompleted(userId, mission), reward);
        }

        // 9. 서비스 계산 결과를 값으로 전달하여 장소 상세 응답 구성
        return GetMapLocationDetailResponse.of(location, travel.distanceMeter(), travel.durationMinutes(), visited,
                description, detailImages, nearbyMissions, guestbooks, pageInfo, locationMission);
    }

    /** 장소 이름의 포함 검색 결과를 ID순으로 조회하고 활성 미션·이미지·거리를 조합한다. */
    public GetMapSearchResponse getMapSearch(Long userId, GetMapSearchRequest request) {
        // 1. 현재 사용자 확인 (검색어 정규화·요청값 검증은 DTO에서 처리한다)
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 장소 ID 오름차순으로 요청 페이지와 다음 페이지 존재 여부 조회
        Slice<Location> page = locationRepository.findByTitleContainingOrderByIdAsc(
                request.keyword(), PageRequest.of(request.page(), request.size()));
        List<Location> locations = page.getContent();
        LocationsPage pageInfo = LocationsPage.of(request.page(), request.size(), page.hasNext());
        if (locations.isEmpty()) {
            return GetMapSearchResponse.of(List.of(), pageInfo);
        }

        // 3~4. 현재 페이지의 활성 보물찾기·협동 미션을 묶어 조회하고 장소별 중복 검증
        List<Long> locationIds = locations.stream().map(Location::getId).toList();
        Map<Long, LocatedMission> missions = detailedMissions(locationIds);

        // 5. 현재 페이지의 대표 이미지와 실제 사용자 위치 기준 거리 구성
        Map<Long, String> imageUrls = locationImageUrls(locations);
        List<GetMapSearchResponse.LocationInfo> items = locations.stream().map(location -> {
            LocatedMission locatedMission = missions.get(location.getId());
            GetMapSearchResponse.MissionInfo mission = locatedMission == null ? null
                    : GetMapSearchResponse.MissionInfo.from(locatedMission.mission());
            TravelEstimate travel = travelEstimator.estimate(request.userLatitude(), request.userLongitude(), location);
            return GetMapSearchResponse.LocationInfo.of(location, imageUrls.get(location.getContentId()),
                    travel.distanceMeter(), mission);
        }).toList();

        // 6. 조회 순서를 유지한 단일 장소 목록과 페이지 정보 반환
        return GetMapSearchResponse.of(items, pageInfo);
    }

    /** 선정된 미션의 보상 설정을 유형별로 묶어서 읽는다. 추천 후보 전체의 보상은 조회하지 않는다. */
    private Map<Long, ModalMission> recommendedMissionRewards(List<RecommendedMission> recommended) {
        List<Long> treasureIds = recommended.stream()
                .filter(item -> item.mission().getMissionType().getType() == MissionTypeCode.TREASURE)
                .map(item -> item.mission().getId()).toList();
        List<Long> cooperativeIds = recommended.stream()
                .filter(item -> item.mission().getMissionType().getType() == MissionTypeCode.COOPERATIVE)
                .map(item -> item.mission().getId()).toList();
        Map<Long, ModalMission> result = new HashMap<>();
        if (!treasureIds.isEmpty()) {
            treasureMissionRepository.findAllWithRewardsByMissionIdIn(treasureIds).forEach(mission ->
                    result.put(mission.getMissionId(), new ModalMission(mission.getMission(),
                            mission.getArCharacter(), mission.getPoint(), mission.getCoupon())));
        }
        if (!cooperativeIds.isEmpty()) {
            cooperativeMissionRepository.findAllWithRewardsByMissionIdIn(cooperativeIds).forEach(mission ->
                    result.put(mission.getMissionId(), new ModalMission(mission.getMission(),
                            mission.getArCharacter(), mission.getPoint(), mission.getCoupon())));
        }
        return result;
    }

    /** 모달·상세의 현재 장소 미션을 보상과 함께 읽고 기존 중복 검증에 전달한다. */
    private ModalMission locationModalMission(Long locationId) {
        List<ModalMission> candidates = new ArrayList<>();
        treasureMissionRepository.findAllWithRewardsByLocationIdAndStatus(locationId, MissionActivationStatus.ACTIVE)
                .forEach(mission -> candidates.add(new ModalMission(mission.getMission(),
                        mission.getArCharacter(), mission.getPoint(), mission.getCoupon())));
        cooperativeMissionRepository.findAllWithRewardsByLocationIdAndStatus(locationId, MissionActivationStatus.ACTIVE)
                .forEach(mission -> candidates.add(new ModalMission(mission.getMission(),
                        mission.getArCharacter(), mission.getPoint(), mission.getCoupon())));
        return uniqueMissionsByLocation(candidates, candidate -> locationId,
                candidate -> candidate.mission().getId() + ":" + candidate.mission().getMissionType().getType())
                .get(locationId);
    }

    /** 모달 대상 미션의 사용자 이력을 조회하여 공통 판정기로 완료 여부를 확인한다. */
    private boolean isMissionCompleted(Long userId, Mission mission) {
        return switch (mission.getMissionType().getType()) {
            case TREASURE -> treasureMissionProgressRepository
                    .findByUserIdAndTreasureMissionMissionId(userId, mission.getId())
                    .map(missionCompletionChecker::isCompleted).orElse(false);
            case COOPERATIVE -> cooperativeMissionParticipantRepository
                    .findAllByUserIdAndMissionId(userId, mission.getId()).stream()
                    .anyMatch(missionCompletionChecker::isCompleted);
            case CULTURE -> false;
        };
    }

    /** 상세 콘텐츠를 조회하지 않고 장소·미션 참조와 길바닥 방명록 좌표로 간소 응답을 만든다. */
    private GetClusteredMapContentsResponse clusteredContents(List<Location> locations, List<Long> locationIds,
                                                              MapViewport viewport) {
        List<Position> roadGuestbooks = roadGuestbookRepository.findPositionsByBounds(
                viewport.minLatitude(), viewport.maxLatitude(), viewport.minLongitude(), viewport.maxLongitude(),
                GuestbookStatus.ACTIVE);
        if (locationIds.isEmpty()) {
            return GetClusteredMapContentsResponse.of(List.of(), roadGuestbooks);
        }

        List<LocationMissionReference> references = new ArrayList<>();
        references.addAll(treasureMissionRepository.findReferencesByLocationIdsAndStatus(locationIds, MissionActivationStatus.ACTIVE));
        references.addAll(cooperativeMissionRepository.findReferencesByLocationIdsAndStatus(locationIds, MissionActivationStatus.ACTIVE));
        Map<Long, LocationMissionReference> missions = uniqueMissionsByLocation(references,
                LocationMissionReference::getLocationId,
                reference -> reference.getMissionId() + ":" + reference.getMissionType());

        List<GetClusteredMapContentsResponse.LocationInfo> items = locations.stream()
                .map(location -> GetClusteredMapContentsResponse.LocationInfo.of(location, missions.get(location.getId())))
                .toList();
        return GetClusteredMapContentsResponse.of(items, roadGuestbooks);
    }

    /** 유형별 활성 미션을 합쳐 장소당 한 건인지 검증한 뒤 공통 미션 정보로 연결한다. */
    private Map<Long, LocatedMission> detailedMissions(List<Long> locationIds) {
        List<LocatedMission> candidates = new ArrayList<>();
        treasureMissionRepository.findAllByLocationIdInAndStatus(locationIds, MissionActivationStatus.ACTIVE)
                .forEach(mission -> candidates.add(new LocatedMission(mission.getLocation().getId(), mission.getMission())));
        cooperativeMissionRepository.findAllByLocationIdInAndStatus(locationIds, MissionActivationStatus.ACTIVE)
                .forEach(mission -> candidates.add(new LocatedMission(mission.getLocation().getId(), mission.getMission())));
        return uniqueMissionsByLocation(candidates, LocatedMission::locationId,
                candidate -> candidate.mission().getId() + ":" + candidate.mission().getMissionType().getType());
    }

    /** 같은 유형의 중복도 포함해 모든 충돌 ID·유형을 기록하고 공통 서버 오류 처리로 전달한다. */
    private <T> Map<Long, T> uniqueMissionsByLocation(List<T> candidates, Function<T, Long> locationOf,
                                                    Function<T, String> descriptionOf) {
        Map<Long, List<T>> grouped = candidates.stream().collect(Collectors.groupingBy(locationOf));
        Map<Long, T> result = new HashMap<>();
        grouped.forEach((locationId, missions) -> {
            if (missions.size() > 1) {
                log.error("지도 장소의 활성 미션 중복: locationId={}, missions={}",
                        locationId, missions.stream().map(descriptionOf).toList());
                throw new IllegalStateException("장소에 연결된 활성 미션이 여러 개입니다. locationId=" + locationId);
            }
            result.put(locationId, missions.getFirst());
        });
        return result;
    }

    /** 표시할 유형별 미션 이력만 묶어서 조회하고 기존 공통 판정기로 완료 ID를 모은다. */
    private Set<Long> completedMissionIds(Long userId, Collection<LocatedMission> missions) {
        List<Long> treasureIds = missions.stream()
                .filter(mission -> mission.mission().getMissionType().getType() == MissionTypeCode.TREASURE)
                .map(mission -> mission.mission().getId()).toList();
        List<Long> cooperativeIds = missions.stream()
                .filter(mission -> mission.mission().getMissionType().getType() == MissionTypeCode.COOPERATIVE)
                .map(mission -> mission.mission().getId()).toList();
        Set<Long> completed = new HashSet<>();
        if (!treasureIds.isEmpty()) {
            completed.addAll(missionCompletionChecker.completedTreasureMissionIds(
                    treasureMissionProgressRepository.findAllByUserIdAndTreasureMissionMissionIdIn(userId, treasureIds)));
        }
        if (!cooperativeIds.isEmpty()) {
            completed.addAll(missionCompletionChecker.completedCooperativeMissionIds(
                    cooperativeMissionParticipantRepository.findAllByUserIdAndMissionIds(userId, cooperativeIds)));
        }
        return completed;
    }

    /** 완료한 미션의 장소에 대해서만 본인의 장소·공통 미션 작성 참조를 조회한다. */
    private Set<MissionGuestbookKey> writtenMissionGuestbooks(Long userId, Map<Long, LocatedMission> missions,
                                                              Set<Long> completedIds) {
        List<Long> locationIds = missions.values().stream()
                .filter(mission -> completedIds.contains(mission.mission().getId()))
                .map(LocatedMission::locationId).toList();
        if (locationIds.isEmpty()) {
            return Set.of();
        }
        return locationGuestbookRepository
                .findMissionReferencesByUserIdAndLocationIdsAndStatus(userId, locationIds, GuestbookStatus.ACTIVE).stream()
                .map(reference -> new MissionGuestbookKey(reference.getLocationId(), reference.getMissionId()))
                .collect(Collectors.toSet());
    }

    /** 실제 획득 기록을 사용처 ID별로 묶는다. 같은 금액의 다른 쿠폰도 합치지 않는다. */
    private Map<Long, List<ReceivedCoupon>> receivedCoupons(Long userId, List<Long> locationIds) {
        return acquiredCouponRepository.findAllByUserIdAndCouponLocationIdIn(userId, locationIds).stream()
                .collect(Collectors.groupingBy(acquired -> acquired.getCoupon().getLocation().getId(),
                        Collectors.mapping(acquired -> ReceivedCoupon.from(acquired.getCoupon()), Collectors.toList())));
    }

    /** 같은 contentId는 한 번만 조회하고 이미지 없음·외부 조회 실패의 null도 요청 내에서 유지한다. */
    private Map<Long, String> locationImageUrls(List<Location> locations) {
        Map<Long, String> images = new HashMap<>();
        locations.stream().map(Location::getContentId).distinct()
                .forEach(contentId -> images.put(contentId, tourApiClient.getLocationImageUrl(contentId)));
        return images;
    }

    /** 유형별 세부 미션에서 가져온 장소 ID와 공통 미션을 연결한다. */
    private record LocatedMission(Long locationId, Mission mission) { }

    /** 모달의 전체 보상을 구성하기 위한 공통 미션과 유형별 보상 설정이다. */
    private record ModalMission(Mission mission, ArCharacter arCharacter, Integer point, Coupon coupon) { }

    /** 다른 장소·다른 미션의 작성 이력을 섞지 않기 위한 조회 결과 식별자이다. */
    private record MissionGuestbookKey(Long locationId, Long missionId) { }
}
