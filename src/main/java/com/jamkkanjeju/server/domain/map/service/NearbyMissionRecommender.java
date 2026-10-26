package com.jamkkanjeju.server.domain.map.service;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 완료하지 않은 활성 보물찾기·협동 미션을 합쳐 사용자와 가까운 미션을 추천한다. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NearbyMissionRecommender {

    private static final int RECOMMEND_LIMIT = 3;

    private final TreasureMissionRepository treasureMissionRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final TreasureMissionProgressRepository treasureMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    private final MissionCompletionChecker missionCompletionChecker;
    private final TravelEstimator travelEstimator;

    /** 두 유형을 합쳐 미완료 후보 중 사용자 위치와 가까운 순서로 최대 세 건을 반환한다. */
    // TODO: 추후 정식 추천 로직으로 교체한다.
    public List<RecommendedMission> recommend(Long userId, double latitude, double longitude) {
        // 1. 장소가 연결된 활성 후보 조회
        List<TreasureMission> treasures = treasureMissionRepository
                .findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE);
        List<CooperativeMission> cooperatives = cooperativeMissionRepository
                .findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE);

        // 2. 후보 미션의 사용자 완료 이력을 공통 판정기로 확인
        List<Long> treasureIds = treasures.stream().map(TreasureMission::getMissionId).toList();
        List<Long> cooperativeIds = cooperatives.stream().map(CooperativeMission::getMissionId).toList();
        Set<Long> completedTreasureIds = treasureIds.isEmpty() ? Set.of()
                : missionCompletionChecker.completedTreasureMissionIds(treasureMissionProgressRepository
                        .findAllByUserIdAndTreasureMissionMissionIdIn(userId, treasureIds));
        Set<Long> completedCooperativeIds = cooperativeIds.isEmpty() ? Set.of()
                : missionCompletionChecker.completedCooperativeMissionIds(cooperativeMissionParticipantRepository
                        .findAllByUserIdAndMissionIds(userId, cooperativeIds));

        // 3. 미완료 후보의 거리를 한 번씩 계산하고 공통 미션 ID 중복 제거
        Map<Long, RecommendedMission> candidates = new LinkedHashMap<>();
        treasures.stream().filter(mission -> !completedTreasureIds.contains(mission.getMissionId()))
                .forEach(mission -> candidates.putIfAbsent(mission.getMissionId(),
                        candidate(mission.getMission(), mission.getLocation(), latitude, longitude)));
        cooperatives.stream().filter(mission -> !completedCooperativeIds.contains(mission.getMissionId()))
                .forEach(mission -> candidates.putIfAbsent(mission.getMissionId(),
                        candidate(mission.getMission(), mission.getLocation(), latitude, longitude)));

        // 4. 유형 구분 없이 가까운 순서로 최대 세 건 선정
        return candidates.values().stream().sorted(Comparator.comparingDouble(RecommendedMission::distanceMeter))
                .limit(RECOMMEND_LIMIT).toList();
    }

    /** 기존 공통 거리 계산으로 추천 후보의 사용자 기준 거리를 구한다. */
    private RecommendedMission candidate(Mission mission, Location location, double latitude, double longitude) {
        return new RecommendedMission(mission, location,
                travelEstimator.distanceMeter(latitude, longitude, location.getLatitude(), location.getLongitude()));
    }

    /** 선정한 공통 미션과 연결 장소·사용자 기준 비교 거리이다. */
    public record RecommendedMission(Mission mission, Location location, double distanceMeter) {
    }
}
