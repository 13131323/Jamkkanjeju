package com.jamkkanjeju.server.domain.cooperativemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionStatusFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusRequest;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.NextMissionSelector;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** 상태 조회의 오류 순서, 정렬·집계와 최초 완료 보상 분기를 DB 없이 검증한다. */
@ExtendWith(MockitoExtension.class)
class GetCooperativeMissionStatusServiceTest {
    @Mock UserRepository users;
    @Mock CooperativeMissionProgressRepository progresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Mock CooperativeRoleCardRepository cards;
    @Mock CooperativeMissionRoleProgressRepository roles;
    @Mock MissionRewardStatusRepository rewards;
    @Mock NextLocationRecommender recommender;
    @Mock NextMissionSelector selector;
    @Mock TourApiClient tour;
    @InjectMocks CooperativeMissionStatusService service;
    final GetCooperativeMissionStatusRequest request = new GetCooperativeMissionStatusRequest(33.0, 126.0);
    final com.jamkkanjeju.server.domain.auth.entity.User user = activeUser(15L);
    final CooperativeMission mission = rewardedMission();

    @Test void 없는사용자는_진행도를_조회하지않는다() {
        error("UNAUTHORIZED");
        verifyNoInteractions(progresses, participants, roles, rewards, recommender);
    }
    @Test void 없는진행도는_참가자를_조회하지않는다() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        error("COOPERATIVE_MISSION_PROGRESS_NOT_FOUND");
        verifyNoInteractions(participants, roles, rewards);
    }
    @Test void 비활성미션은_참가자조회전에_차단한다() {
        var progress = readyProgress(1);
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        error("COOPERATIVE_MISSION_INACTIVE");
        verifyNoInteractions(participants, roles, rewards);
    }
    @Test void 참가자가없으면_역할이나_보상을_조회하지않는다() {
        readyProgress(3);
        error("COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND");
        verifyNoInteractions(roles, rewards, recommender);
    }
    @ParameterizedTest @ValueSource(ints={1,2})
    void 대기자도_조회하고_방장우선정렬과_역할집계를_반환한다(int step) {
        var progress = ready(step, ParticipantStatus.PENDING);
        var host = participant(activeUser(16L), progress, ParticipantStatus.ACCEPTED, ParticipantRole.HOST);
        var later = participant(activeUser(17L), progress, ParticipantStatus.ACCEPTED, ParticipantRole.MEMBER);
        var me = participant(user, progress, ParticipantStatus.PENDING, ParticipantRole.MEMBER);
        ReflectionTestUtils.setField(host, "id", 82L);
        ReflectionTestUtils.setField(me, "id", 81L);
        ReflectionTestUtils.setField(later, "id", 83L);
        ReflectionTestUtils.setField(me, "createdAt", JOINED_AT);
        ReflectionTestUtils.setField(later, "createdAt", JOINED_AT.plusSeconds(1));
        when(participants.findAllByCooperativeMissionProgressId(71L)).thenReturn(List.of(later, me, host));
        var completed = CooperativeMissionRoleProgress.builder().participant(host).roleCard(card(1L)).build();
        completed.complete("proof.jpg", JOINED_AT);
        var pending = CooperativeMissionRoleProgress.builder().participant(me).roleCard(card(2L)).build();
        when(roles.findAllByParticipantCooperativeMissionProgressIdOrderByParticipantIdAscRoleCardIdAsc(71L))
                .thenReturn(List.of(completed,pending));
        when(cards.findAllByOrderByIdAsc()).thenReturn(List.of(card(1L),card(2L)));
        var response=call();
        assertThat(response.participants()).extracting(p->p.participantId()).containsExactly(82L,81L,83L);
        assertThat(response.completedRoleCount()).isEqualTo(1);
        assertThat(response.totalRoleCount()).isEqualTo(2);
        assertThat(response.currentParticipant().participantStatus()).isEqualTo("PENDING");
        verifyNoInteractions(rewards,recommender,selector,tour);
    }
    @Test void 최초완료는_지급true항목만_표시한다() {
        var progress=readyCompleted();
        history(progress);
        var status=MissionRewardStatus.builder().mission(mission.getMission()).user(user).build();
        status.grantPointReward();
        when(rewards.findById(new MissionRewardStatusId(31L,15L))).thenReturn(Optional.of(status));
        var response=call();
        assertThat(response.reward().point()).isEqualTo(200);
        assertThat(response.reward().arCharacter()).isNull();
        assertThat(response.reward().coupon()).isNull();
        verify(rewards,never()).save(any());
    }
    @Test void 지급기록이없으면_최초완료도_빈보상이다() {
        var progress=readyCompleted(); history(progress);
        assertThat(call().reward().point()).isNull();
    }
    @Test void 재도전은_누적지급상태를_읽지않는다() {
        var progress=readyCompleted();
        var first=statusProgress(99L,mission,3); first.complete(JOINED_AT.minusDays(1));
        history(progress,first);
        assertThat(call().reward().point()).isNull();
        verifyNoInteractions(rewards);
    }
    @Test void 완료시각이같으면_작은진행도id가_최초다() {
        var progress=readyCompleted();
        var first=statusProgress(70L,mission,3); first.complete(JOINED_AT);
        history(progress,first);
        assertThat(call().reward().point()).isNull();
        verifyNoInteractions(rewards);
    }
    @Test void 미완료와_대기완료이력은_최초판정에서_제외한다() {
        var progress=readyCompleted();
        var inProgress=statusProgress(1L,mission,1);
        var pending=statusProgress(2L,mission,3); pending.complete(JOINED_AT.minusDays(1));
        when(participants.findAllByUserIdAndMissionId(15L,31L)).thenReturn(List.of(
                participant(user,progress,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER),
                participant(user,inProgress,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER),
                participant(user,pending,ParticipantStatus.PENDING,ParticipantRole.MEMBER)));
        call();
        verify(rewards).findById(new MissionRewardStatusId(31L,15L));
    }
    @Test void 완료팀의_대기자는_보상을_조회하지않는다() {
        var progress=ready(3,ParticipantStatus.PENDING); progress.complete(JOINED_AT);
        assertThat(call().reward().point()).isNull();
        verifyNoInteractions(rewards);
    }
    @Test void 완료장소를_추천에서_제외하고_없는이미지와미션은_null이다() {
        var location=com.jamkkanjeju.server.domain.home.support.HomeFixtures.location(10L,"완료",33,126);
        ReflectionTestUtils.setField(mission,"location",location);
        var progress=readyCompleted(); history(progress);
        var next=com.jamkkanjeju.server.domain.home.support.HomeFixtures.location(11L,"다음",33,127);
        when(recommender.recommend(33,126,10L)).thenReturn(Optional.of(
                new NextLocationRecommender.RecommendedLocation(next,100)));
        var response=call();
        assertThat(response.completedLocation().locationId()).isEqualTo(10L);
        assertThat(response.nextLocation().id()).isEqualTo(11L);
        assertThat(response.nextLocation().locationImageUrl()).isNull();
        assertThat(response.nextLocation().mission()).isNull();
        verify(selector).pick(11L);
        verify(tour).getLocationImageUrl(11L);
    }

    /** 사용자·진행도 조회 결과를 준비한다. */
    private CooperativeMissionProgress readyProgress(int step) {
        var progress=statusProgress(71L,mission,step);
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(progresses.findWithDetailsById(71L)).thenReturn(Optional.of(progress));
        return progress;
    }
    /** 현재 참가자 상태를 지정한다. */
    private CooperativeMissionProgress ready(int step,ParticipantStatus status) {
        var progress=readyProgress(step);
        when(participants.findByCooperativeMissionProgressIdAndUserId(71L,15L)).thenReturn(
                Optional.of(participant(user,progress,status,ParticipantRole.MEMBER)));
        return progress;
    }
    /** 완료 상태와 고정 완료 시각을 준비한다. */
    private CooperativeMissionProgress readyCompleted() {
        var progress=ready(3,ParticipantStatus.ACCEPTED); progress.complete(JOINED_AT); return progress;
    }
    /** 같은 사용자의 완료 참가 이력을 준비한다. */
    private void history(CooperativeMissionProgress... teams) {
        when(participants.findAllByUserIdAndMissionId(15L,31L)).thenReturn(Arrays.stream(teams)
                .map(p->participant(user,p,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER)).toList());
    }
    private com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusResponse call() {
        return service.getCooperativeMissionStatus(15L,71L,request);
    }
    /** 명세 오류 코드를 확인한다. */
    private void error(String code) {
        assertThatThrownBy(this::call).isInstanceOfSatisfying(BusinessException.class,
                e->assertThat(e.getErrorCode().code()).isEqualTo(code));
    }
}
