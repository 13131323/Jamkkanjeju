package com.jamkkanjeju.server.domain.map.service;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.LocationGuestbookRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.LocationGuestbookRepository.LocationCount;
import com.jamkkanjeju.server.domain.guestbook.repository.RoadGuestbookRepository;
import com.jamkkanjeju.server.domain.home.repository.AcquiredCouponRepository;
import com.jamkkanjeju.server.domain.map.dto.GetClusteredMapContentsResponse;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsRequest;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse.LocationInfo;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse.MissionInfo;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse.ReceivedCoupon;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse.RoadGuestbookInfo;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.mission.repository.LocationMissionReference;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 확장 지도 범위의 장소·길바닥 방명록을 현재 사용자 기준의 상세 또는 간소 응답으로 구성한다. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MapService {

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

        // 4~8. 간소 응답에서는 부가 정보 조회·계산을 호출하지 않는다
        if (request.isClustered()) {
            return clusteredContents(locations, locationIds, viewport);
        }
        return detailedContents(userId, request, locations, locationIds, viewport);
    }

    /** 상세 콘텐츠를 조회하지 않고 장소·미션 참조와 길바닥 방명록 좌표로 간소 응답을 만든다. */
    private GetClusteredMapContentsResponse clusteredContents(List<Location> locations, List<Long> locationIds,
                                                              MapViewport viewport) {
        var roadGuestbooks = roadGuestbookRepository.findPositionsByBounds(
                viewport.minLatitude(), viewport.maxLatitude(), viewport.minLongitude(), viewport.maxLongitude());
        if (locationIds.isEmpty()) {
            return GetClusteredMapContentsResponse.of(List.of(), roadGuestbooks);
        }

        List<LocationMissionReference> references = new ArrayList<>();
        references.addAll(treasureMissionRepository.findReferencesByLocationIdsAndStatus(locationIds, MissionActivationStatus.ACTIVE));
        references.addAll(cooperativeMissionRepository.findReferencesByLocationIdsAndStatus(locationIds, MissionActivationStatus.ACTIVE));
        Map<Long, LocationMissionReference> missions = uniqueMissionsByLocation(references,
                LocationMissionReference::getLocationId,
                reference -> reference.getMissionId() + ":" + reference.getMissionType());

        var items = locations.stream()
                .map(location -> GetClusteredMapContentsResponse.LocationInfo.of(location, missions.get(location.getId())))
                .toList();
        return GetClusteredMapContentsResponse.of(items, roadGuestbooks);
    }

    /** 사용자별 완료·작성·수령 이력과 공통 거리·이미지 정보를 붙여 상세 응답을 만든다. */
    private GetMapContentsResponse detailedContents(Long userId, GetMapContentsRequest request,
                                                    List<Location> locations, List<Long> locationIds,
                                                    MapViewport viewport) {
        var roadGuestbooks = roadGuestbookRepository.findAllByLatitudeBetweenAndLongitudeBetween(
                viewport.minLatitude(), viewport.maxLatitude(), viewport.minLongitude(), viewport.maxLongitude());
        var roadItems = roadGuestbooks.stream().map(RoadGuestbookInfo::from).toList();
        if (locationIds.isEmpty()) {
            return GetMapContentsResponse.of(List.of(), roadItems);
        }

        // 활성 미션 중복을 먼저 확인하여 잘못된 데이터를 선택하거나 부가 조회를 계속하지 않는다
        Map<Long, LocatedMission> missions = detailedMissions(locationIds);
        Set<Long> completedIds = completedMissionIds(userId, missions.values());
        Set<MissionGuestbookKey> writtenGuestbooks = writtenMissionGuestbooks(userId, missions, completedIds);
        Map<Long, Long> guestbookCounts = locationGuestbookRepository.countByLocationIds(locationIds).stream()
                .collect(Collectors.toMap(LocationCount::getLocationId, LocationCount::getGuestbookCount));
        Map<Long, List<ReceivedCoupon>> coupons = receivedCoupons(userId, locationIds);
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
            return LocationInfo.of(location,
                    travelEstimator.estimate(request.userLatitude(), request.userLongitude(), location), missionInfo,
                    guestbookCounts.getOrDefault(location.getId(), 0L), imageUrls.get(location.getContentId()),
                    coupons.get(location.getId()));
        }).toList();
        return GetMapContentsResponse.of(items, roadItems);
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
        return locationGuestbookRepository.findMissionReferencesByUserIdAndLocationIds(userId, locationIds).stream()
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

    /** 다른 장소·다른 미션의 작성 이력을 섞지 않기 위한 조회 결과 식별자이다. */
    private record MissionGuestbookKey(Long locationId, Long missionId) { }
}
