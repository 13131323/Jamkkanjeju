package com.jamkkanjeju.server.domain.cooperativemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.JOINED_AT;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.participant;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeMission;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** DB 없이 URL 참여 요청의 검증 순서, 멱등 처리, 충돌과 신규 저장 분기를 검증한다. */
@ExtendWith(MockitoExtension.class)
class JoinCooperativeMissionServiceTest {
    private static final String TEAM_TOKEN = "join-team-token";

    @Mock UserRepository users;
    @Mock CooperativeMissionRepository missions;
    @Mock CooperativeMissionProgressRepository progresses;
    @Mock CooperativeMissionParticipantRepository participants;
    CooperativeMissionService service;
    final User user = activeUser(15L);
    final CooperativeMission mission = cooperativeMission(31L, null);

    @BeforeEach
    void setUp() {
        service = new CooperativeMissionService(users, missions, progresses, participants,
                com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.CLOCK);
    }

    @Test
    void 없는_사용자는_팀을_조회하지_않는다() {
        error("UNAUTHORIZED");
        verify(users).findByIdForUpdate(15L);
        verifyNoInteractions(missions, progresses, participants);
    }

    @Test
    void 없는토큰과_완료팀토큰은_유효하지않은_초대링크다() {
        when(users.findByIdForUpdate(15L)).thenReturn(Optional.of(user));
        error("INVALID_INVITE_TOKEN");

        var completed = progress(71L, 1);
        completed.complete(JOINED_AT);
        when(progresses.findByTeamTokenForUpdate(TEAM_TOKEN)).thenReturn(Optional.of(completed));
        error("INVALID_INVITE_TOKEN");
        verifyNoInteractions(missions, participants);
    }

    @Test
    void 비활성미션은_기존참가자보다_먼저_차단한다() {
        var progress = ready(1);
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        error("COOPERATIVE_MISSION_INACTIVE");
        verify(participants, never()).findByCooperativeMissionProgressIdAndUserId(any(), any());
        verify(participants, never()).save(any());
    }

    @ParameterizedTest
    @EnumSource(ParticipantStatus.class)
    void 대상팀의_기존참가자는_변경없이_반환한다(ParticipantStatus status) {
        var progress = ready(2);
        var saved = participant(user, progress, status, ParticipantRole.MEMBER);
        ReflectionTestUtils.setField(saved, "id", 81L);
        when(participants.findByCooperativeMissionProgressIdAndUserId(71L, 15L)).thenReturn(Optional.of(saved));

        var response = service.joinCooperativeMission(15L, TEAM_TOKEN);

        assertThat(response.cooperativeMissionProgressId()).isEqualTo(71L);
        assertThat(response.participantId()).isEqualTo(81L);
        assertThat(response.participantStatus()).isEqualTo(status.name());
        assertThat(response.created()).isFalse();
        assertThat(saved.getParticipantStatus()).isEqualTo(status);
        verify(participants, never()).findAllByUserIdAndMissionId(any(), any());
        verify(participants, never()).countByCooperativeMissionProgressId(any());
        verify(participants, never()).save(any());
    }

    @Test
    void 같은미션의_다른_진행중팀_참가는_차단한다() {
        ready(1);
        var another = progress(72L, 1);
        when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(List.of(
                participant(user, another, ParticipantStatus.PENDING, ParticipantRole.MEMBER)));

        error("COOPERATIVE_MISSION_ALREADY_PARTICIPATING");

        verify(participants, never()).countByCooperativeMissionProgressId(any());
        verify(participants, never()).save(any());
    }

    @Test
    void 완료팀_이력은_신규참여를_막지않는다() {
        var progress = ready(1);
        var completed = progress(72L, 2);
        completed.complete(JOINED_AT);
        when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(List.of(
                participant(user, completed, ParticipantStatus.ACCEPTED, ParticipantRole.HOST)));
        when(participants.countByCooperativeMissionProgressId(71L)).thenReturn(1L);
        saveParticipant();

        assertThat(service.joinCooperativeMission(15L, TEAM_TOKEN).created()).isTrue();
        verify(participants).save(any());
        assertThat(progress.getCurrentStep()).isEqualTo(1);
    }

    @Test
    void 첫단계가_아니면_인원조회전에_참여를_마감한다() {
        ready(2);
        error("COOPERATIVE_MISSION_JOIN_CLOSED");
        verify(participants, never()).countByCooperativeMissionProgressId(any());
        verify(participants, never()).save(any());
    }

    @Test
    void 참가자가_6명이면_신규참여를_차단한다() {
        ready(1);
        when(participants.countByCooperativeMissionProgressId(71L)).thenReturn(6L);
        error("COOPERATIVE_MISSION_FULL");
        verify(participants, never()).save(any());
    }

    @Test
    void 신규참가자는_MEMBER_PENDING_합류시각null로_저장한다() {
        ready(1);
        when(participants.countByCooperativeMissionProgressId(71L)).thenReturn(5L);
        saveParticipant();

        var response = service.joinCooperativeMission(15L, TEAM_TOKEN);

        var captor = ArgumentCaptor.forClass(CooperativeMissionParticipant.class);
        var order = inOrder(users, progresses, participants);
        order.verify(users).findByIdForUpdate(15L);
        order.verify(progresses).findByTeamTokenForUpdate(TEAM_TOKEN);
        order.verify(participants).findByCooperativeMissionProgressIdAndUserId(71L, 15L);
        order.verify(participants).findAllByUserIdAndMissionId(15L, 31L);
        order.verify(participants).countByCooperativeMissionProgressId(71L);
        order.verify(participants).save(captor.capture());
        var saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getCooperativeMissionProgress().getId()).isEqualTo(71L);
        assertThat(saved.getParticipantRole()).isEqualTo(ParticipantRole.MEMBER);
        assertThat(saved.getParticipantStatus()).isEqualTo(ParticipantStatus.PENDING);
        assertThat(saved.getJoinedAt()).isNull();
        assertThat(response.participantId()).isEqualTo(81L);
        assertThat(response.participantStatus()).isEqualTo("PENDING");
        assertThat(response.created()).isTrue();
    }

    @Test
    void 참가자_저장실패는_원래예외를_전파한다() {
        ready(1);
        var failure = new IllegalStateException("참가자 저장 실패");
        when(participants.save(any())).thenThrow(failure);
        assertThatThrownBy(() -> service.joinCooperativeMission(15L, TEAM_TOKEN)).isSameAs(failure);
    }

    /** 사용자와 팀 토큰에 해당하는 진행 중인 대상 팀을 준비한다. */
    private CooperativeMissionProgress ready(int step) {
        var progress = progress(71L, step);
        when(users.findByIdForUpdate(15L)).thenReturn(Optional.of(user));
        when(progresses.findByTeamTokenForUpdate(TEAM_TOKEN)).thenReturn(Optional.of(progress));
        return progress;
    }

    /** 지정한 단계의 대상 미션 진행도를 만든다. */
    private CooperativeMissionProgress progress(Long id, int step) {
        var progress = CooperativeMissionProgress.builder().cooperativeMission(mission).currentStep(step)
                .teamToken(TEAM_TOKEN).build();
        ReflectionTestUtils.setField(progress, "id", id);
        return progress;
    }

    /** 저장된 참가자 ID를 고정한다. */
    private void saveParticipant() {
        when(participants.save(any())).thenAnswer(invocation -> {
            CooperativeMissionParticipant saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 81L);
            return saved;
        });
    }

    /** 서비스 오류 코드를 확인한다. */
    private void error(String code) {
        assertThatThrownBy(() -> service.joinCooperativeMission(15L, TEAM_TOKEN))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getErrorCode().code()).isEqualTo(code));
    }
}
