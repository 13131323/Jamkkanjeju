package com.jamkkanjeju.server.domain.mission.service;

import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 추천 장소에서 수행할 활성 미션을 미션 종류와 관계없이 선택한다. */
@Component
@RequiredArgsConstructor
public class NextMissionSelector {

    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final TreasureMissionRepository treasureMissionRepository;

    /** 장소에 연결된 활성 협동·보물찾기 미션 중 하나를 무작위로 고른다. 없으면 빈 값이다. */
    public Optional<Mission> pick(Long locationId) {
        List<Mission> candidates = new ArrayList<>();
        cooperativeMissionRepository.findAllByLocationIdAndStatus(locationId, MissionActivationStatus.ACTIVE)
                .forEach(cooperativeMission -> candidates.add(cooperativeMission.getMission()));
        treasureMissionRepository.findAllByLocationIdAndStatus(locationId, MissionActivationStatus.ACTIVE)
                .forEach(treasureMission -> candidates.add(treasureMission.getMission()));
        if (candidates.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(candidates.get(ThreadLocalRandom.current().nextInt(candidates.size())));
    }
}
