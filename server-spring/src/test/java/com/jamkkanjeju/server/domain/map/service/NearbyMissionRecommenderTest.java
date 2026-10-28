package com.jamkkanjeju.server.domain.map.service;

import static com.jamkkanjeju.server.domain.map.support.MapLocationDetailFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.repository.*;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** 활성 후보를 두 유형 합계 가까운 세 건으로 선정하고 공통 완료 기준을 적용하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class NearbyMissionRecommenderTest {
    @Mock TreasureMissionRepository treasures;
    @Mock CooperativeMissionRepository cooperatives;
    @Mock TreasureMissionProgressRepository progresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Spy MissionCompletionChecker completion = new MissionCompletionChecker();
    @Spy TravelEstimator travel = new TravelEstimator();
    @InjectMocks NearbyMissionRecommender recommender;

    @Test
    void 두_유형을_합친_거리순으로_3건만_반환한다() {
        when(treasures.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(treasure(1, 4), treasure(2, 2)));
        when(cooperatives.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(cooperative(3, 1), cooperative(4, 3)));
        assertThat(recommender.recommend(15L, 0, 0)).extracting(item -> item.mission().getId())
                .containsExactly(3L, 2L, 4L);
        verify(progresses).findAllByUserIdAndTreasureMissionMissionIdIn(15L, List.of(1L, 2L));
        verify(participants).findAllByUserIdAndMissionIds(15L, List.of(3L, 4L));
    }

    @Test
    void 한_유형만_있어도_가까운_3건을_반환한다() {
        when(treasures.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(treasure(1, 4), treasure(2, 2), treasure(3, 1), treasure(4, 3)));
        assertThat(recommender.recommend(15L, 0, 0)).extracting(item -> item.mission().getId())
                .containsExactly(3L, 2L, 4L);
        verifyNoInteractions(participants);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2})
    void 후보가_부족하면_있는만큼만_반환한다(int count) {
        List<TreasureMission> candidates = IntStream.range(0, count).mapToObj(i -> treasure(i + 1, i + 1)).toList();
        when(treasures.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE)).thenReturn(candidates);
        assertThat(recommender.recommend(15L, 0, 0)).hasSize(count);
        if (count == 0) verifyNoInteractions(progresses, participants);
    }

    @Test
    void 사용자_좌표를_바꾸면_사용자와_가까운_미션부터_반환한다() {
        when(treasures.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(treasure(1, 0), treasure(2, 9)));
        assertThat(recommender.recommend(15L, 0, 10)).extracting(item -> item.mission().getId()).containsExactly(2L, 1L);
    }

    @Test
    void 완료된_보물찾기를_제외하고_공통ID_중복을_제거한다() {
        TreasureMission completed = treasure(1, 1);
        TreasureMission remaining = treasure(2, 2);
        when(treasures.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(completed, remaining, remaining));
        when(progresses.findAllByUserIdAndTreasureMissionMissionIdIn(15L, List.of(1L, 2L, 2L)))
                .thenReturn(List.of(TreasureMissionProgress.builder().treasureMission(completed)
                        .missionStatus(MissionProgressStatus.COMPLETED).build()));
        assertThat(recommender.recommend(15L, 0, 0)).extracting(item -> item.mission().getId()).containsExactly(2L);
    }

    @ParameterizedTest
    @CsvSource({"PENDING,COMPLETED,1", "ACCEPTED,COMPLETED,0", "ACCEPTED,IN_PROGRESS,1"})
    void 협동_완료는_참가상태와_팀완료를_같이_본다(ParticipantStatus status, MissionProgressStatus teamStatus, int count) {
        CooperativeMission mission = cooperative(3, 1);
        when(cooperatives.findAllByStatusAndLocationIsNotNull(MissionActivationStatus.ACTIVE)).thenReturn(List.of(mission));
        CooperativeMissionProgress team = CooperativeMissionProgress.builder().cooperativeMission(mission)
                .missionStatus(teamStatus).teamToken("unit-team").build();
        when(participants.findAllByUserIdAndMissionIds(15L, List.of(3L))).thenReturn(List.of(
                CooperativeMissionParticipant.builder().cooperativeMissionProgress(team).participantStatus(status).build()));
        assertThat(recommender.recommend(15L, 0, 0)).hasSize(count);
    }
}
