package com.jamkkanjeju.server.domain.mypage.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.map.repository.VisitedLocationRepository;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 필수 사용자 확인과 보상 조회의 생략·일괄 호출을 검증한다. */
@ExtendWith(MockitoExtension.class)
class TravelEndingElementsServiceTest {
    @Mock UserRepository users;
    @Mock VisitedLocationRepository visits;
    @Mock CultureMissionProgressRepository culture;
    @Mock TreasureMissionProgressRepository treasure;
    @Mock CooperativeMissionParticipantRepository cooperative;
    @Mock MissionRewardStatusRepository rewards;
    @Mock MissionCompletionChecker completion;
    @InjectMocks TravelEndingElementsService service;

    @Test
    void 사용자가없으면인증오류이며_후속조회를중단한다() {
        assertThatThrownBy(() -> service.getTravelEndingElements(15L))
                .extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(visits, culture, treasure, cooperative, rewards);
    }

    @Test
    void 빈목록이어도저장된포인트를유지하고_보상은조회하지않는다() {
        when(users.findById(15L)).thenReturn(Optional.of(User.builder().point(321).build()));
        var response = service.getTravelEndingElements(15L);
        assertThat(response.point()).isEqualTo(321);
        assertThat(response.visitedLocations()).isEmpty();
        assertThat(response.completedMissions()).isEmpty();
        verifyNoInteractions(rewards);
    }

    @Test
    void 최종유효미션만모아서보상상태를한번조회한다() {
        when(users.findById(15L)).thenReturn(Optional.of(User.builder().build()));
        when(culture.findAllWithRewardsByUserIdAndMissionStatus(15L, MissionProgressStatus.COMPLETED))
                .thenReturn(List.of(progress(1L, MissionActivationStatus.ACTIVE, true),
                        progress(2L, MissionActivationStatus.INACTIVE, true),
                        progress(3L, MissionActivationStatus.ACTIVE, false)));
        var response = service.getTravelEndingElements(15L);
        assertThat(response.completedMissions()).extracting(item -> item.missionId()).containsExactly(1L);
        verify(rewards).findAllByIdUserIdAndIdMissionIdIn(15L, List.of(1L));
        verifyNoMoreInteractions(rewards);
        verify(users, never()).save(any());
    }

    private CultureMissionProgress progress(Long id, MissionActivationStatus active, boolean dated) {
        Mission mission = Mission.builder().id(id).missionType(MissionType.builder()
                .type(MissionTypeCode.CULTURE).title("문화 미션").build()).build();
        return CultureMissionProgress.builder().cultureMission(CultureMission.builder().mission(mission).status(active).build())
                .missionStatus(MissionProgressStatus.COMPLETED)
                .lastCompletedAt(dated ? LocalDateTime.of(2026, 10, 1, 12, 0) : null).build();
    }
}
