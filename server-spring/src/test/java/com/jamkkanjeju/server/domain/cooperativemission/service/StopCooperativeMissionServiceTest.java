package com.jamkkanjeju.server.domain.cooperativemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionStatusFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** 중단 권한·단계·승계 순서와 삭제 범위를 DB 없이 검증한다. */
@ExtendWith(MockitoExtension.class)
class StopCooperativeMissionServiceTest {
    @Mock UserRepository users;
    @Mock CooperativeMissionRepository missions;
    @Mock CooperativeMissionProgressRepository teams;
    @Mock CooperativeMissionParticipantRepository participants;
    @Mock CooperativeMissionRoleProgressRepository roles;
    @Mock CooperativeRoleCardRepository cards;
    @Mock MissionRewardStatusRepository statuses;
    @Mock MissionRewardGranter granter;
    @Mock ImageValidator validator;
    @Mock BlobStorageClient storage;
    @Mock CooperativeMissionPhotoVerifier verifier;
    CooperativeMissionService service;
    CooperativeMission mission=rewardedMission();
    CooperativeMissionProgress team=statusProgress(71L,mission,1);
    CooperativeMissionParticipant host;

    @BeforeEach void setup() {
        service=new CooperativeMissionService(users,missions,teams,participants,roles,cards,statuses,granter,validator,storage,verifier,CLOCK);
        host=identified(15L,101L,ParticipantRole.HOST,ParticipantStatus.ACCEPTED);
    }
    @AfterEach void noUnrelatedChanges() { verifyNoInteractions(missions,roles,cards,statuses,granter,validator,storage,verifier); }
    @Test void 사용자없음은_팀조회전에_중단한다() { error("UNAUTHORIZED"); verifyNoInteractions(teams,participants); }
    @Test void 팀없음은_참가자조회전에_중단한다() { userReady(); error("COOPERATIVE_MISSION_PROGRESS_NOT_FOUND"); verifyNoInteractions(participants); }
    @Test void 비활성은_참가자조회전에_중단한다() {
        teamReady(); mission.changeStatus(MissionActivationStatus.INACTIVE); error("COOPERATIVE_MISSION_INACTIVE"); verifyNoInteractions(participants);
    }
    @Test void 미참가자는_완료팀이어도_권한오류를_먼저반환한다() {
        teamReady(); team.complete(JOINED_AT); error("COOPERATIVE_MISSION_LEAVE_ACCESS_DENIED"); noDelete();
    }
    @ParameterizedTest @ValueSource(ints={2,3})
    void 첫단계가아니면_삭제승계하지않는다(int step) {
        ready(List.of(host)); ReflectionTestUtils.setField(team,"currentStep",step); error("COOPERATIVE_MISSION_STEP_NOT_ALLOWED"); noDelete();
    }
    @Test void 첫단계여도_완료팀은_삭제하지않는다() {
        ready(List.of(host)); team.complete(JOINED_AT); error("COOPERATIVE_MISSION_STEP_NOT_ALLOWED"); noDelete();
    }
    @ParameterizedTest @ValueSource(strings={"ACCEPTED","PENDING"})
    void 팀원은_상태와무관하게_본인만삭제한다(String status) {
        var member=identified(15L,102L,ParticipantRole.MEMBER,ParticipantStatus.valueOf(status));
        var otherHost=identified(16L,101L,ParticipantRole.HOST,ParticipantStatus.ACCEPTED);
        ready(List.of(otherHost,member)); stop(); verify(participants).delete(member); verify(teams,never()).delete(any());
        assertThat(otherHost.getParticipantRole()).isEqualTo(ParticipantRole.HOST);
        var order=inOrder(users,teams,participants); order.verify(users).findById(15L); order.verify(teams).findByIdForUpdate(71L);
        order.verify(participants).findAllByProgressIdForUpdate(71L); order.verify(participants).delete(member);
    }
    @ParameterizedTest @ValueSource(strings={"HOST","MEMBER","PENDING"})
    void 마지막참가자는_팀삭제로_전체정리한다(String type) {
        var last=identified(15L,101L,type.equals("HOST") ? ParticipantRole.HOST : ParticipantRole.MEMBER,
                type.equals("PENDING") ? ParticipantStatus.PENDING : ParticipantStatus.ACCEPTED);
        ready(List.of(last)); stop(); verify(teams).delete(team); verify(participants).deleteAll(List.of(last)); verify(participants,never()).delete(any());
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void 방장은_합류시각과ID로_한명에게만_권한을승계한다(boolean sameTime) {
        var first=identified(16L,103L,ParticipantRole.MEMBER,ParticipantStatus.ACCEPTED);
        var second=identified(17L,102L,ParticipantRole.MEMBER,ParticipantStatus.ACCEPTED);
        var pending=identified(18L,100L,ParticipantRole.MEMBER,ParticipantStatus.PENDING);
        ReflectionTestUtils.setField(first,"joinedAt",JOINED_AT.minusDays(1));
        ReflectionTestUtils.setField(second,"joinedAt",sameTime ? JOINED_AT.minusDays(1) : JOINED_AT);
        ready(List.of(pending,second,host,first)); stop();
        var successor=sameTime ? second : first;
        assertThat(successor.getParticipantRole()).isEqualTo(ParticipantRole.HOST);
        assertThat((sameTime ? first : second).getParticipantRole()).isEqualTo(ParticipantRole.MEMBER);
        assertThat(pending.getParticipantRole()).isEqualTo(ParticipantRole.MEMBER);
        assertThat(successor.getParticipantStatus()).isEqualTo(ParticipantStatus.ACCEPTED);
        assertThat(successor.getJoinedAt()).isEqualTo(JOINED_AT.minusDays(1));
        verify(participants).delete(host); verify(teams,never()).delete(any());
        assertThat(team.getCurrentStep()).isEqualTo(1); assertThat(team.getCompletedAt()).isNull();
    }
    @Test void 수락된승계후보없이_대기자만남으면_팀을해산한다() {
        var pending=identified(16L,102L,ParticipantRole.MEMBER,ParticipantStatus.PENDING);
        ready(List.of(host,pending)); stop(); verify(teams).delete(team);
        verify(participants).deleteAll(List.of(host,pending)); verify(participants,never()).delete(any());
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void 삭제실패는_정상처리로_숨기지않는다(boolean dissolve) {
        ready(dissolve ? List.of(host) : List.of(host,identified(16L,102L,ParticipantRole.MEMBER,ParticipantStatus.ACCEPTED)));
        var failure=new IllegalStateException("삭제 실패");
        if(dissolve)doThrow(failure).when(teams).delete(team); else doThrow(failure).when(participants).delete(host);
        assertThatThrownBy(this::stop).isSameAs(failure);
    }
    /** 시각과 식별자를 고정한 참가자를 만든다. */
    private CooperativeMissionParticipant identified(Long userId,Long id,ParticipantRole role,ParticipantStatus status) {
        var p=participant(activeUser(userId),team,status,role); ReflectionTestUtils.setField(p,"id",id); return p;
    }
    private void userReady() { when(users.findById(15L)).thenReturn(Optional.of(activeUser(15L))); }
    private void teamReady() { userReady(); when(teams.findByIdForUpdate(71L)).thenReturn(Optional.of(team)); }
    private void ready(List<CooperativeMissionParticipant> rows) { teamReady(); when(participants.findAllByProgressIdForUpdate(71L)).thenReturn(rows); }
    private void stop() { service.stopCooperativeMission(15L,71L); }
    private void noDelete() { verify(teams,never()).delete(any()); verify(participants,never()).delete(any()); verify(participants,never()).deleteAll(any()); }
    private void error(String code) { assertThatThrownBy(this::stop).isInstanceOfSatisfying(BusinessException.class,e -> assertThat(e.getErrorCode().code()).isEqualTo(code)); }
}
