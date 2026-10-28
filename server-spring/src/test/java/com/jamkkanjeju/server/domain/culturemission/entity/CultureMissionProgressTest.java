package com.jamkkanjeju.server.domain.culturemission.entity;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.LAST_COMPLETED_AT;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.cultureMission;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.progress;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import org.junit.jupiter.api.Test;

class CultureMissionProgressTest {

    private final CultureMission cultureMission = cultureMission(31L, MissionActivationStatus.ACTIVE);

    @Test
    void 진행_값을_생략하면_진행_중_1번_퀴즈_정답_0개_완료_시각_없음으로_시작한다() {
        CultureMissionProgress progress = CultureMissionProgress.builder()
                .user(activeUser(15L))
                .cultureMission(cultureMission)
                .build();

        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progress.getCurrentQuizIndex()).isEqualTo(1);
        assertThat(progress.getCorrectCount()).isZero();
        assertThat(progress.getLastCompletedAt()).isNull();
    }

    @Test
    void 완료한_진행도를_재시작하면_진행_중_1번_퀴즈_정답_0개로_되돌린다() {
        CultureMissionProgress progress = progress(7L, activeUser(15L), cultureMission,
                MissionProgressStatus.COMPLETED, 4, 3, LAST_COMPLETED_AT);

        progress.restart();

        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progress.getCurrentQuizIndex()).isEqualTo(1);
        assertThat(progress.getCorrectCount()).isZero();
    }

    @Test
    void 재시작해도_마지막_완료_시각은_유지한다() {
        CultureMissionProgress progress = progress(7L, activeUser(15L), cultureMission,
                MissionProgressStatus.COMPLETED, 4, 3, LAST_COMPLETED_AT);

        progress.restart();

        assertThat(progress.getLastCompletedAt()).isEqualTo(LAST_COMPLETED_AT);
    }
}
