package com.jamkkanjeju.server.domain.home.service;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse.MissionRecommendInfo;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 홈 추천 미션 선정. 홈 서비스의 데이터 조합 로직과 분리한다. (BUISNESS_RULE.md 3절)
 * 유형별로 최대 한 건씩 보물찾기, 협동, 문화 순서로 담고, 후보가 없는 유형은 뺀다.
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MissionRecommender {

    private final CultureMissionRepository cultureMissionRepository;
    private final TreasureMissionRepository treasureMissionRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final TravelEstimator travelEstimator;

    /**
     * @param completedTreasureMissionIds    사용자가 완료한 보물찾기 미션 ID (추천에서 제외)
     * @param completedCooperativeMissionIds 사용자가 완료한 협동 미션 ID (추천에서 제외)
     */
    public List<MissionRecommendInfo> recommend(double latitude, double longitude,
                                                Set<Long> completedTreasureMissionIds,
                                                Set<Long> completedCooperativeMissionIds) {
        List<MissionRecommendInfo> recommends = new ArrayList<>();

        List<TreasureMission> treasureCandidates = treasureMissionRepository
                .findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE).stream()
                .filter(treasureMission -> !completedTreasureMissionIds.contains(treasureMission.getMissionId()))
                .toList();
        findNearest(treasureCandidates, TreasureMission::getLocation, latitude, longitude)
                .ifPresent(nearest -> recommends.add(
                        toRecommend(nearest.getMission(), nearest.getLocation(), latitude, longitude)));

        List<CooperativeMission> cooperativeCandidates = cooperativeMissionRepository
                .findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE).stream()
                .filter(cooperativeMission -> !completedCooperativeMissionIds.contains(cooperativeMission.getMissionId()))
                .toList();
        findNearest(cooperativeCandidates, CooperativeMission::getLocation, latitude, longitude)
                .ifPresent(nearest -> recommends.add(
                        toRecommend(nearest.getMission(), nearest.getLocation(), latitude, longitude)));

        // 문화 미션은 장소가 없으므로 무작위로 한 건을 고른다.
        List<CultureMission> cultureCandidates = cultureMissionRepository.findAllByStatus(MissionActivationStatus.ACTIVE);
        if (!cultureCandidates.isEmpty()) {
            CultureMission picked = cultureCandidates.get(ThreadLocalRandom.current().nextInt(cultureCandidates.size()));
            recommends.add(MissionRecommendInfo.of(picked.getMission(), null, null, null));
        }

        return recommends;
    }

    private <T> Optional<T> findNearest(List<T> candidates, Function<T, Location> locationOf,
                                        double latitude, double longitude) {
        return candidates.stream().min(Comparator.comparingDouble(candidate -> {
            Location location = locationOf.apply(candidate);
            return travelEstimator.distanceMeter(latitude, longitude, location.getLatitude(), location.getLongitude());
        }));
    }

    private MissionRecommendInfo toRecommend(Mission mission, Location location, double latitude, double longitude) {
        TravelEstimate estimate = travelEstimator.estimate(latitude, longitude, location);
        return MissionRecommendInfo.of(mission, location, estimate.distanceMeter(), estimate.durationMinutes());
    }
}
