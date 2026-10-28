package com.jamkkanjeju.server.domain.mission.service;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** 사용자가 미션을 완료했는지 판정한다. 미션 완료 여부가 필요한 모든 기능이 같은 기준으로 쓴다. */
@Component
public class MissionCompletionChecker {

    /** 사용자가 보물찾기 미션을 완료했는지 판정한다. */
    public boolean isCompleted(TreasureMissionProgress progress) {
        return progress.getMissionStatus() == MissionProgressStatus.COMPLETED;
    }

    /** 사용자가 참가한 협동 미션을 팀과 함께 완료했는지 판정한다. */
    public boolean isCompleted(CooperativeMissionParticipant participant) {
        return participant.getParticipantStatus() == ParticipantStatus.ACCEPTED
                && participant.getCooperativeMissionProgress().getMissionStatus() == MissionProgressStatus.COMPLETED;
    }

    /** 사용자가 완료한 보물찾기 미션 ID를 모은다. */
    public Set<Long> completedTreasureMissionIds(List<TreasureMissionProgress> progresses) {
        return progresses.stream()
                .filter(this::isCompleted)
                .map(progress -> progress.getTreasureMission().getMissionId())
                .collect(Collectors.toSet());
    }

    /** 사용자가 완료한 협동 미션 ID를 모은다. */
    public Set<Long> completedCooperativeMissionIds(List<CooperativeMissionParticipant> participants) {
        return participants.stream()
                .filter(this::isCompleted)
                .map(participant -> participant.getCooperativeMissionProgress().getCooperativeMission().getMissionId())
                .collect(Collectors.toSet());
    }
}
