package com.jamkkanjeju.server.domain.mission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeMission;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeProgress;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.participant;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.treasureMission;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.treasureProgress;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import java.util.List;
import org.junit.jupiter.api.Test;

class MissionCompletionCheckerTest {

    private final MissionCompletionChecker checker = new MissionCompletionChecker();
    private final User user = activeUser(15L);

    @Test
    void 보물찾기는_COMPLETED만_완료로_판단한다() {
        assertThat(checker.isCompleted(treasureProgress(user, treasureMission(21L, null, 3), 3,
                MissionProgressStatus.COMPLETED))).isTrue();
        assertThat(checker.isCompleted(treasureProgress(user, treasureMission(21L, null, 3), 1,
                MissionProgressStatus.IN_PROGRESS))).isFalse();
    }

    @Test
    void 협동은_ACCEPTED이고_팀이_COMPLETED일_때만_완료로_판단한다() {
        CooperativeMission mission = cooperativeMission(31L, null);

        assertThat(checker.isCompleted(participant(user,
                cooperativeProgress(1L, mission, 3, MissionProgressStatus.COMPLETED),
                ParticipantStatus.ACCEPTED))).isTrue();
    }

    @Test
    void 협동은_PENDING_참가자나_IN_PROGRESS_팀이면_완료가_아니다() {
        CooperativeMission mission = cooperativeMission(31L, null);

        assertThat(checker.isCompleted(participant(user,
                cooperativeProgress(1L, mission, 3, MissionProgressStatus.COMPLETED),
                ParticipantStatus.PENDING))).isFalse();
        assertThat(checker.isCompleted(participant(user,
                cooperativeProgress(2L, mission, 2, MissionProgressStatus.IN_PROGRESS),
                ParticipantStatus.ACCEPTED))).isFalse();
    }

    @Test
    void 완료한_공통_미션_ID만_반환하고_같은_미션의_여러_완료_기록은_하나로_모은다() {
        assertThat(checker.completedTreasureMissionIds(List.of(
                treasureProgress(user, treasureMission(21L, null, 3), 3, MissionProgressStatus.COMPLETED),
                treasureProgress(user, treasureMission(22L, null, 3), 1, MissionProgressStatus.IN_PROGRESS))))
                .containsExactly(21L);

        CooperativeMission completedTwice = cooperativeMission(31L, null);
        List<CooperativeMissionParticipant> participants = List.of(
                participant(user, cooperativeProgress(1L, completedTwice, 3, MissionProgressStatus.COMPLETED),
                        ParticipantStatus.ACCEPTED),
                participant(user, cooperativeProgress(2L, completedTwice, 3, MissionProgressStatus.COMPLETED),
                        ParticipantStatus.ACCEPTED),
                participant(user, cooperativeProgress(3L, cooperativeMission(32L, null), 1,
                        MissionProgressStatus.IN_PROGRESS), ParticipantStatus.ACCEPTED));
        assertThat(checker.completedCooperativeMissionIds(participants)).containsExactly(31L);
    }

    @Test
    void 진행_기록이_없으면_빈_집합을_반환한다() {
        assertThat(checker.completedTreasureMissionIds(List.of())).isEmpty();
        assertThat(checker.completedCooperativeMissionIds(List.of())).isEmpty();
    }
}
