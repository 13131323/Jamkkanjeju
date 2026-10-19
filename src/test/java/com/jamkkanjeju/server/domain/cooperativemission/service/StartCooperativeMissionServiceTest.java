package com.jamkkanjeju.server.domain.cooperativemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeMission;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** DB 없이 협동 미션 검증 순서·신규·이어하기·실패 분기를 검증한다. */
@ExtendWith(MockitoExtension.class)
class StartCooperativeMissionServiceTest {
    @Mock UserRepository users;
    @Mock CooperativeMissionRepository missions;
    @Mock CooperativeMissionProgressRepository progresses;
    @Mock CooperativeMissionParticipantRepository participants;
    CooperativeMissionService service;
    final com.jamkkanjeju.server.domain.auth.entity.User user = activeUser(15L);
    final CooperativeMission mission = cooperativeMission(31L, null);

    @BeforeEach
    void setUp() {
        service = new CooperativeMissionService(users, missions, progresses, participants, CLOCK);
    }

    @Test
    void 없는_사용자는_잠금조회에서_중단한다() {
        error("UNAUTHORIZED");
        verify(users).findByIdForUpdate(15L);
        verifyNoInteractions(missions, progresses, participants);
    }

    @Test
    void 미션이_없으면_참가조회와_생성을_하지_않는다() {
        when(users.findByIdForUpdate(15L)).thenReturn(Optional.of(user));
        error("COOPERATIVE_MISSION_NOT_FOUND");
        verifyNoInteractions(progresses, participants);
    }

    @Test
    void 비활성이면_참가조회와_생성을_하지_않는다() {
        ready();
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        error("COOPERATIVE_MISSION_INACTIVE");
        verifyNoInteractions(progresses, participants);
    }

    @Test
    void 신규_팀_저장후_고정시각의_방장을_연결한다() {
        ready();
        saveProgress();
        var response = service.startCooperativeMission(15L, 31L);
        assertThat(response.cooperativeMissionProgressId()).isEqualTo(72L);
        assertThat(response.created()).isTrue();
        var captor = ArgumentCaptor.forClass(CooperativeMissionParticipant.class);
        var order = inOrder(users, missions, participants, progresses);
        order.verify(users).findByIdForUpdate(15L);
        order.verify(missions).findById(31L);
        order.verify(participants).findAllByUserIdAndMissionId(15L, 31L);
        order.verify(progresses).save(any());
        order.verify(participants).save(captor.capture());
        var host = captor.getValue();
        assertThat(host.getUser()).isSameAs(user);
        assertThat(host.getParticipantRole()).isEqualTo(ParticipantRole.HOST);
        assertThat(host.getParticipantStatus()).isEqualTo(ParticipantStatus.ACCEPTED);
        assertThat(host.getJoinedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        var progress = host.getCooperativeMissionProgress();
        assertThat(progress.getCooperativeMission()).isSameAs(mission);
        assertThat(progress.getCurrentStep()).isEqualTo(1);
        assertThat(progress.getMissionStatus().name()).isEqualTo("IN_PROGRESS");
        assertThat(progress.getCompletedAt()).isNull();
        assertThat(progress.getTeamToken()).matches("[A-Za-z0-9_-]{43}").hasSizeLessThanOrEqualTo(100);
        assertThat(Base64.getUrlDecoder().decode(progress.getTeamToken())).hasSize(32);
        assertThat(response.teamToken()).isEqualTo(progress.getTeamToken());
    }

    @ParameterizedTest
    @CsvSource({"PENDING,HOST", "PENDING,MEMBER", "ACCEPTED,HOST", "ACCEPTED,MEMBER"})
    void 역할과_무관하게_기존팀을_변경없이_이어간다(ParticipantStatus status, ParticipantRole role) {
        ready();
        var progress = progress(71L, mission);
        var participant = participant(user, progress, status, role);
        when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(List.of(participant));
        var response = service.startCooperativeMission(15L, 31L);
        assertThat(response.cooperativeMissionProgressId()).isEqualTo(71L);
        assertThat(response.created()).isFalse();
        assertThat(response.teamToken()).isEqualTo(
                status == ParticipantStatus.ACCEPTED && role == ParticipantRole.HOST
                        ? progress.getTeamToken()
                        : null);
        assertThat(progress.getCurrentStep()).isEqualTo(2);
        assertThat(progress.getTeamToken()).isEqualTo("existing-team-token-71");
        assertThat(progress.getCompletedAt()).isNull();
        assertThat(participant.getParticipantStatus()).isEqualTo(status);
        assertThat(participant.getParticipantRole()).isEqualTo(role);
        assertThat(participant.getJoinedAt()).isEqualTo(status == ParticipantStatus.PENDING ? null : JOINED_AT);
        verifyNoInteractions(progresses);
        verify(participants, never()).save(any());
    }

    @Test
    void 완료이력만_있으면_기존팀을_유지하고_새팀을_만든다() {
        ready();
        var old = progress(71L, mission);
        old.complete(JOINED_AT);
        when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(
                List.of(participant(user, old, ParticipantStatus.ACCEPTED, ParticipantRole.HOST)));
        saveProgress();
        assertThat(service.startCooperativeMission(15L, 31L).cooperativeMissionProgressId()).isEqualTo(72L);
        assertThat(old.getMissionStatus().name()).isEqualTo("COMPLETED");
        assertThat(old.getCompletedAt()).isEqualTo(JOINED_AT);
        assertThat(old.getCurrentStep()).isEqualTo(2);
    }

    @Test
    void 완료와_진행중_기록이_섞이면_진행중팀만_이어간다() {
        ready();
        var old = progress(70L, mission);
        old.complete(JOINED_AT);
        var current = progress(71L, mission);
        when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(List.of(
                participant(user, old, ParticipantStatus.ACCEPTED, ParticipantRole.HOST),
                participant(user, current, ParticipantStatus.PENDING, ParticipantRole.MEMBER)));
        assertThat(service.startCooperativeMission(15L, 31L).cooperativeMissionProgressId()).isEqualTo(71L);
        verifyNoInteractions(progresses);
        verify(participants, never()).save(any());
    }

    @Test
    void 진행도_저장실패는_참가자를_저장하지_않는다() {
        ready();
        var failure = new IllegalStateException("진행도 저장 실패");
        when(progresses.save(any())).thenThrow(failure);
        assertThatThrownBy(() -> service.startCooperativeMission(15L, 31L)).isSameAs(failure);
        verify(participants, never()).save(any());
    }

    @Test
    void 참가자_저장실패는_원래예외를_전파한다() {
        ready();
        saveProgress();
        var failure = new IllegalStateException("참가자 저장 실패");
        when(participants.save(any())).thenThrow(failure);
        assertThatThrownBy(() -> service.startCooperativeMission(15L, 31L)).isSameAs(failure);
    }

    /** 현재 사용자와 활성 미션을 준비한다. */
    private void ready() {
        when(users.findByIdForUpdate(15L)).thenReturn(Optional.of(user));
        when(missions.findById(31L)).thenReturn(Optional.of(mission));
    }

    /** DB 생성 ID를 고정해 신규 저장 결과를 준비한다. */
    private void saveProgress() {
        when(progresses.save(any())).thenAnswer(invocation -> {
            CooperativeMissionProgress progress = invocation.getArgument(0);
            ReflectionTestUtils.setField(progress, "id", 72L);
            return progress;
        });
        when(participants.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    /** 서비스 오류 코드를 확인한다. */
    private void error(String code) {
        assertThatThrownBy(() -> service.startCooperativeMission(15L, 31L))
                .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode().code()).isEqualTo(code));
    }
}
