package com.jamkkanjeju.server.domain.cooperativemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionStatusFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionProgressRequest;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** DB 없이 단계 변경 검증 순서와 참가자별 최초 완료 지급 분기를 확인한다. */
@ExtendWith(MockitoExtension.class)
class SaveCooperativeMissionProgressServiceTest {
    @Mock UserRepository users;
    @Mock CooperativeMissionRepository missions;
    @Mock CooperativeMissionProgressRepository progresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Mock CooperativeMissionRoleProgressRepository roles;
    @Mock MissionRewardStatusRepository statuses;
    @Mock MissionRewardGranter granter;
    CooperativeMissionService service;
    User host = activeUser(15L);
    CooperativeMission mission = rewardedMission();
    CooperativeMissionProgress progress;
    CooperativeMissionParticipant hostParticipant;

    @BeforeEach void setUp() {
        service = new CooperativeMissionService(users, missions, progresses, participants, roles, statuses, granter, CLOCK);
        progress = statusProgress(71L, mission, 2);
        hostParticipant = participant(host, progress, ParticipantStatus.ACCEPTED, ParticipantRole.HOST);
        ReflectionTestUtils.setField(hostParticipant, "id", 101L);
    }

    @Test void 없는사용자는_후속조회하지않는다() {
        error(3, "UNAUTHORIZED");
        verifyNoInteractions(progresses, participants, roles, statuses, granter);
    }

    @Test void 없는진행도와_비활성은_권한조회전에_차단한다() {
        when(users.findById(15L)).thenReturn(Optional.of(host));
        error(3, "COOPERATIVE_MISSION_PROGRESS_NOT_FOUND");
        when(progresses.findByIdForUpdate(71L)).thenReturn(Optional.of(progress));
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        error(3, "COOPERATIVE_MISSION_INACTIVE");
        verifyNoInteractions(participants, roles, statuses, granter);
    }

    @ParameterizedTest @ValueSource(strings = {"NONE", "MEMBER", "PENDING"})
    void 수락된방장만_변경한다(String condition) {
        readyTeam();
        if (!condition.equals("NONE")) {
            var p = participant(host, progress, condition.equals("PENDING") ? ParticipantStatus.PENDING : ParticipantStatus.ACCEPTED,
                    condition.equals("MEMBER") ? ParticipantRole.MEMBER : ParticipantRole.HOST);
            when(participants.findByCooperativeMissionProgressIdAndUserId(71L, 15L)).thenReturn(Optional.of(p));
        }
        error(3, "COOPERATIVE_MISSION_HOST_ONLY");
        verifyNoInteractions(roles, statuses, granter);
    }

    @ParameterizedTest @CsvSource({"1,1", "1,3", "1,4", "2,2", "2,1", "2,0", "2,-1", "2,2147483647", "3,3"})
    void 순차적이지않은_전환은_통합오류다(int current, int next) {
        ReflectionTestUtils.setField(progress, "currentStep", current);
        readyHost(); error(next, "COOPERATIVE_MISSION_STEP_NOT_ALLOWED");
        verify(participants, never()).findAllByCooperativeMissionProgressId(anyLong());
        verifyNoInteractions(roles, statuses, granter);
    }

    @Test void 완료상태는_진행도없음이아닌_단계오류다() {
        readyHost(); progress.complete(JOINED_AT);
        error(3, "COOPERATIVE_MISSION_STEP_NOT_ALLOWED");
        assertThat(progress.getCompletedAt()).isEqualTo(JOINED_AT);
    }

    @Test void 대기검증은_역할검증보다_먼저한다() {
        readyHost(); ReflectionTestUtils.setField(progress, "currentStep", 1);
        var pending = participant(activeUser(16L), progress, ParticipantStatus.PENDING, ParticipantRole.MEMBER);
        when(participants.findAllByCooperativeMissionProgressId(71L)).thenReturn(List.of(hostParticipant, pending));
        error(2, "COOPERATIVE_MISSION_PENDING_PARTICIPANT_EXISTS");
        verifyNoInteractions(roles, statuses, granter);
        assertThat(pending.getParticipantStatus()).isEqualTo(ParticipantStatus.PENDING);
    }

    @Test void 역할없는참가자는_차단하고_여러역할은_허용한다() {
        readyHost(); ReflectionTestUtils.setField(progress, "currentStep", 1);
        when(participants.findAllByCooperativeMissionProgressId(71L)).thenReturn(List.of(hostParticipant));
        error(2, "COOPERATIVE_PARTICIPANT_ROLE_REQUIRED");
        when(roles.findAllByParticipantCooperativeMissionProgressIdOrderByParticipantIdAscRoleCardIdAsc(71L))
                .thenReturn(List.of(role(hostParticipant, 1L, false), role(hostParticipant, 2L, false)));
        save(2);
        assertThat(progress.getCurrentStep()).isEqualTo(2);
        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progress.getCompletedAt()).isNull();
        verifyNoInteractions(statuses, granter);
    }

    @Test void 미인증역할은_완료와_지급을_막는다() {
        readyCompletion(false); error(3, "COOPERATIVE_MISSION_STEP_NOT_ALLOWED");
        assertThat(progress.getCurrentStep()).isEqualTo(2);
        verifyNoInteractions(statuses, granter);
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void 행없음과_전부false는_최초완료때_모두지급한다(boolean existing) {
        readyCompletion(true);
        var key = new MissionRewardStatusId(31L, 15L);
        when(statuses.findById(key)).thenReturn(existing
                ? Optional.of(MissionRewardStatus.builder().mission(mission.getMission()).user(host).build()) : Optional.empty());
        save(3);
        verify(granter).grant(host, mission.getMission(), mission.getArCharacter(), mission.getPoint(), mission.getCoupon(), 3);
        assertThat(progress.getCurrentStep()).isEqualTo(3);
        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.COMPLETED);
        assertThat(progress.getCompletedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        var order = inOrder(users, progresses, participants, roles, statuses, granter);
        order.verify(users).findById(15L);
        order.verify(progresses).findByIdForUpdate(71L);
        order.verify(participants).findByCooperativeMissionProgressIdAndUserId(71L, 15L);
        order.verify(participants).findAllByCooperativeMissionProgressId(71L);
        order.verify(roles).findAllByParticipantCooperativeMissionProgressIdOrderByParticipantIdAscRoleCardIdAsc(71L);
        order.verify(participants).findAllByUserIdAndMissionId(15L, 31L);
        order.verify(statuses).findById(key);
    }

    @ParameterizedTest @ValueSource(ints = {1,2,3,4,5,6,7})
    void 일부라도_기지급이면_남은보상도_주지않는다(int mask) {
        readyCompletion(true);
        var status = MissionRewardStatus.builder().mission(mission.getMission()).user(host).build();
        if ((mask & 1) != 0) status.grantArCharacterReward();
        if ((mask & 2) != 0) status.grantPointReward();
        if ((mask & 4) != 0) status.grantCouponReward();
        when(statuses.findById(new MissionRewardStatusId(31L,15L))).thenReturn(Optional.of(status));
        save(3); verifyNoInteractions(granter);
        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.COMPLETED);
    }

    @Test void 기존수락완료이력은_미지급이어도_재도전이다() {
        readyCompletion(true);
        var old = statusProgress(1L, mission,3); old.complete(JOINED_AT);
        when(participants.findAllByUserIdAndMissionId(15L,31L)).thenReturn(List.of(
                participant(host,old,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER)));
        save(3); verifyNoInteractions(statuses,granter);
    }

    @Test void 현재팀과_진행중과_대기완료이력은_최초완료를_막지않는다() {
        readyCompletion(true);
        var old = statusProgress(1L,mission,3); old.complete(JOINED_AT);
        var other = statusProgress(2L,mission,2);
        when(participants.findAllByUserIdAndMissionId(15L,31L)).thenReturn(List.of(hostParticipant,
                participant(host,old,ParticipantStatus.PENDING,ParticipantRole.MEMBER),
                participant(host,other,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER)));
        save(3); verify(granter).grant(any(),any(),any(),any(),any(),eq(3));
    }

    @Test void 대기참가자는_지급대상에서_제외한다() {
        readyCompletion(true);
        var pending = participant(activeUser(16L),progress,ParticipantStatus.PENDING,ParticipantRole.MEMBER);
        when(participants.findAllByCooperativeMissionProgressId(71L)).thenReturn(List.of(hostParticipant,pending));
        save(3);
        verify(participants,never()).findAllByUserIdAndMissionId(16L,31L);
        verify(granter,times(1)).grant(any(),any(),any(),any(),any(),eq(3));
    }

    @Test void 지급실패는_전파하고_완료시키지않는다() {
        readyCompletion(true);
        doThrow(new IllegalStateException("지급 실패")).when(granter).grant(any(),any(),any(),any(),any(),eq(3));
        assertThatThrownBy(() -> save(3)).isInstanceOf(IllegalStateException.class).hasMessage("지급 실패");
        assertThat(progress.getCurrentStep()).isEqualTo(2);
        assertThat(progress.getCompletedAt()).isNull();
    }

    /** 팀 조회까지의 기본 성공 조건이다. */
    private void readyTeam() {
        when(users.findById(15L)).thenReturn(Optional.of(host));
        when(progresses.findByIdForUpdate(71L)).thenReturn(Optional.of(progress));
    }
    /** 방장 권한까지의 성공 조건이다. */
    private void readyHost() {
        readyTeam();
        when(participants.findByCooperativeMissionProgressIdAndUserId(71L,15L)).thenReturn(Optional.of(hostParticipant));
    }
    /** 완료 판단에 사용할 참가자와 배정 기록을 준비한다. */
    private void readyCompletion(boolean completed) {
        readyHost();
        when(participants.findAllByCooperativeMissionProgressId(71L)).thenReturn(List.of(hostParticipant));
        when(roles.findAllByParticipantCooperativeMissionProgressIdOrderByParticipantIdAscRoleCardIdAsc(71L))
                .thenReturn(List.of(role(hostParticipant,1L,completed)));
    }
    /** 배정 역할 인증 상태를 고정한다. */
    private CooperativeMissionRoleProgress role(CooperativeMissionParticipant p,Long cardId,boolean completed) {
        return CooperativeMissionRoleProgress.builder().participant(p).roleCard(card(cardId))
                .progressStatus(completed ? MissionProgressStatus.COMPLETED : MissionProgressStatus.IN_PROGRESS).build();
    }
    private void save(int step) { service.saveCooperativeMissionProgress(15L,71L,new SaveCooperativeMissionProgressRequest(step)); }
    private void error(int step,String code) {
        assertThatThrownBy(() -> save(step)).isInstanceOfSatisfying(BusinessException.class,
                e -> assertThat(e.getErrorCode().code()).isEqualTo(code));
    }
}
