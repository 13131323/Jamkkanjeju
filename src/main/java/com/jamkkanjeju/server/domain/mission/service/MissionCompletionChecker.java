package com.jamkkanjeju.server.domain.mission.service;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 사용자의 미션 완료 여부 판정 기준. 여러 조회 기능이 같은 기준을 쓰도록 한 곳에 둔다. (home BUISNESS_RULE.md 3절)
 * 레포지토리를 직접 부르지 않고 이미 조회한 진행 기록을 받아 판정만 한다.
 */
@Component
public class MissionCompletionChecker {

    /** 보물찾기: 사용자의 진행도가 COMPLETED이면 완료 */
    public boolean isCompleted(TreasureMissionProgress progress) {
        return progress.getMissionStatus() == MissionProgressStatus.COMPLETED;
    }

    /** 협동: 참가 상태가 ACCEPTED이고 팀 진행도가 COMPLETED이면 완료 */
    public boolean isCompleted(CooperativeMissionParticipant participant) {
        return participant.getParticipantStatus() == ParticipantStatus.ACCEPTED
                && participant.getCooperativeMissionProgress().getMissionStatus() == MissionProgressStatus.COMPLETED;
    }

    public Set<Long> completedTreasureMissionIds(List<TreasureMissionProgress> progresses) {
        return progresses.stream()
                .filter(this::isCompleted)
                .map(progress -> progress.getTreasureMission().getMissionId())
                .collect(Collectors.toSet());
    }

    public Set<Long> completedCooperativeMissionIds(List<CooperativeMissionParticipant> participants) {
        return participants.stream()
                .filter(this::isCompleted)
                .map(participant -> participant.getCooperativeMissionProgress().getCooperativeMission().getMissionId())
                .collect(Collectors.toSet());
    }
}
