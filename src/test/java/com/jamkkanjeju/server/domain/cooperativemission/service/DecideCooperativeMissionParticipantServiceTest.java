package com.jamkkanjeju.server.domain.cooperativemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeMission;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.dto.DecideCooperativeMissionParticipantRequest.Decision;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** DB 없이 수락·거절의 검증 순서와 상태 변경·보호 분기를 검증한다. */
@ExtendWith(MockitoExtension.class)
class DecideCooperativeMissionParticipantServiceTest {
    @Mock UserRepository users;
    @Mock CooperativeMissionRepository missions;
    @Mock CooperativeMissionProgressRepository progresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Mock CooperativeMissionRoleProgressRepository roleProgresses;
    @Mock MissionRewardStatusRepository rewardStatuses;
    @Mock MissionRewardGranter rewardGranter;
    CooperativeMissionService service;
    CooperativeMission mission;
    CooperativeMissionProgress progress;

    @BeforeEach
    void setUp() {
        service = new CooperativeMissionService(users, missions, progresses, participants,
                roleProgresses, rewardStatuses, rewardGranter, CLOCK);
        mission = cooperativeMission(31L, null);
        progress = CooperativeMissionProgress.builder().cooperativeMission(mission).currentStep(1)
                .teamToken("test-token").build();
    }

    @Test
    void 없는진행도는_참가자를_조회하지않는다() {
        error("COOPERATIVE_MISSION_PROGRESS_NOT_FOUND", Decision.ACCEPT);
        verifyNoInteractions(participants);
    }

    @Test
    void 완료진행도는_참가자를_조회하지않는다() {
        progress.complete(JOINED_AT);
        readyProgress();
        error("COOPERATIVE_MISSION_PROGRESS_NOT_FOUND", Decision.ACCEPT);
        verifyNoInteractions(participants);
    }

    @Test
    void 비활성미션은_방장조회전에_차단한다() {
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        readyProgress();
        error("COOPERATIVE_MISSION_INACTIVE", Decision.REJECT);
        verifyNoInteractions(participants);
    }

    @Test
    void 참가자가_없는_요청자는_방장오류다() {
        readyProgress();
        error("COOPERATIVE_MISSION_HOST_ONLY", Decision.ACCEPT);
        verify(participants, never()).findByIdAndCooperativeMissionProgressId(any(), any());
    }

    @ParameterizedTest
    @CsvSource({"MEMBER,ACCEPTED", "MEMBER,PENDING", "HOST,PENDING"})
    void 수락된방장이_아니면_차단한다(ParticipantRole role, ParticipantStatus status) {
        readyProgress();
        when(participants.findByCooperativeMissionProgressIdAndUserId(71L, 15L))
                .thenReturn(Optional.of(participant(activeUser(15L), progress, status, role)));
        error("COOPERATIVE_MISSION_HOST_ONLY", Decision.ACCEPT);
        verify(participants, never()).findByIdAndCooperativeMissionProgressId(any(), any());
    }

    @ParameterizedTest
    @ValueSource(ints = {2, 3})
    void 초대단계를_지나면_대상을_조회하지않는다(int step) {
        for (int i = 1; i < step; i++) progress.moveToNextStep();
        readyHost();
        error("COOPERATIVE_MISSION_JOIN_CLOSED", Decision.REJECT);
        verify(participants, never()).findByIdAndCooperativeMissionProgressId(any(), any());
    }

    @Test
    void 없는대상은_참여요청없음이다() {
        readyHost();
        error("COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND", Decision.ACCEPT);
    }

    @Test
    void 방장을_대상으로_처리하지않는다() {
        readyHost();
        target(ParticipantStatus.ACCEPTED, ParticipantRole.HOST);
        error("COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND", Decision.REJECT);
    }

    @ParameterizedTest
    @EnumSource(ParticipantStatus.class)
    void 수락은_대기자만_변경하고_재요청시각은_유지한다(ParticipantStatus status) {
        readyHost();
        var target = target(status, ParticipantRole.MEMBER);
        service.decideCooperativeMissionParticipant(15L, 71L, 81L, Decision.ACCEPT);
        assertThat(target.getParticipantStatus()).isEqualTo(ParticipantStatus.ACCEPTED);
        assertThat(target.getJoinedAt()).isEqualTo(status == ParticipantStatus.PENDING
                ? LocalDateTime.now(CLOCK) : JOINED_AT);
        var order = inOrder(progresses, participants);
        order.verify(progresses).findByIdForUpdate(71L);
        order.verify(participants).findByCooperativeMissionProgressIdAndUserId(71L, 15L);
        order.verify(participants).findByIdAndCooperativeMissionProgressId(81L, 71L);
        verify(participants, never()).countByCooperativeMissionProgressId(any());
        verify(participants, never()).save(any());
        verify(participants, never()).delete(any());
    }

    @Test
    void 대기자_거절은_해당행만_삭제한다() {
        readyHost();
        var target = target(ParticipantStatus.PENDING, ParticipantRole.MEMBER);
        service.decideCooperativeMissionParticipant(15L, 71L, 81L, Decision.REJECT);
        verify(participants).delete(target);
        assertThat(target.getParticipantStatus()).isEqualTo(ParticipantStatus.PENDING);
        assertThat(target.getJoinedAt()).isNull();
    }

    @Test
    void 수락된팀원은_거절할수없다() {
        readyHost();
        var target = target(ParticipantStatus.ACCEPTED, ParticipantRole.MEMBER);
        error("COOPERATIVE_MISSION_PARTICIPANT_ALREADY_ACCEPTED", Decision.REJECT);
        assertThat(target.getJoinedAt()).isEqualTo(JOINED_AT);
    }

    /** 진행도 잠금 조회 결과를 준비한다. */
    private void readyProgress() {
        when(progresses.findByIdForUpdate(71L)).thenReturn(Optional.of(progress));
    }

    /** 같은 팀의 수락된 방장을 준비한다. */
    private void readyHost() {
        readyProgress();
        when(participants.findByCooperativeMissionProgressIdAndUserId(71L, 15L))
                .thenReturn(Optional.of(participant(activeUser(15L), progress,
                        ParticipantStatus.ACCEPTED, ParticipantRole.HOST)));
    }

    /** 지정된 역할·상태의 처리 대상을 준비한다. */
    private CooperativeMissionParticipant target(ParticipantStatus status, ParticipantRole role) {
        var target = participant(activeUser(16L), progress, status, role);
        when(participants.findByIdAndCooperativeMissionProgressId(81L, 71L)).thenReturn(Optional.of(target));
        return target;
    }

    /** 도메인 오류와 실패 시 삭제·생성 호출이 없음을 확인한다. */
    private void error(String code, Decision decision) {
        assertThatThrownBy(() -> service.decideCooperativeMissionParticipant(15L, 71L, 81L, decision))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode().code()).isEqualTo(code));
        verify(participants, never()).delete(any());
        verify(participants, never()).save(any());
    }
}
