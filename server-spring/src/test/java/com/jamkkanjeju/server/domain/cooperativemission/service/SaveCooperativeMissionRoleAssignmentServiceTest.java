package com.jamkkanjeju.server.domain.cooperativemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionStatusFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionRoleAssignmentRequest;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** DB 없이 배정 검증 순서와 생성·유지·복합키 교체를 확인한다. */
@ExtendWith(MockitoExtension.class)
class SaveCooperativeMissionRoleAssignmentServiceTest {
    @Mock UserRepository users;
    @Mock CooperativeMissionRepository missions;
    @Mock CooperativeMissionProgressRepository teams;
    @Mock CooperativeMissionParticipantRepository participants;
    @Mock CooperativeMissionRoleProgressRepository roles;
    @Mock CooperativeRoleCardRepository cards;
    @Mock MissionRewardStatusRepository statuses;
    @Mock MissionRewardGranter granter;
    @Mock ImageValidator imageValidator;
    @Mock BlobStorageClient blobStorageClient;
    @Mock CooperativeMissionPhotoVerifier photoVerifier;
    CooperativeMissionService service;
    User host=activeUser(15L);
    CooperativeMission mission=rewardedMission();
    CooperativeMissionProgress team=statusProgress(71L,mission,1);
    CooperativeRoleCard card=card(1L);
    CooperativeMissionParticipant hostParticipant;
    CooperativeMissionParticipant target;

    @BeforeEach void setUp() {
        service=new CooperativeMissionService(users,missions,teams,participants,roles,cards,statuses,granter,
                imageValidator,blobStorageClient,photoVerifier,CLOCK);
        hostParticipant=identified(host,101L,ParticipantRole.HOST,ParticipantStatus.ACCEPTED);
        target=identified(activeUser(16L),102L,ParticipantRole.MEMBER,ParticipantStatus.ACCEPTED);
    }

    @Test void 없는사용자는_팀조회를_하지않는다() {
        error("UNAUTHORIZED"); verifyNoInteractions(teams,participants,cards,roles,statuses,granter);
    }
    @Test void 없는팀은_권한조회전에_실패한다() {
        when(users.findById(15L)).thenReturn(Optional.of(host));
        error("COOPERATIVE_MISSION_PROGRESS_NOT_FOUND"); verifyNoInteractions(participants,cards,roles);
    }
    @Test void 비활성은_권한조회전에_실패한다() {
        readyTeam(); mission.changeStatus(MissionActivationStatus.INACTIVE);
        error("COOPERATIVE_MISSION_INACTIVE"); verifyNoInteractions(participants,cards,roles);
    }
    @ParameterizedTest @ValueSource(strings={"NONE","MEMBER","PENDING"})
    void 수락된방장이_아니면_배정을_조회하지않는다(String type) {
        readyTeam();
        if(!type.equals("NONE")) when(participants.findByCooperativeMissionProgressIdAndUserId(71L,15L))
                .thenReturn(Optional.of(identified(host,101L,type.equals("MEMBER") ? ParticipantRole.MEMBER : ParticipantRole.HOST,
                        type.equals("PENDING") ? ParticipantStatus.PENDING : ParticipantStatus.ACCEPTED)));
        error("COOPERATIVE_MISSION_HOST_ONLY"); verifyNoInteractions(cards,roles);
    }
    @ParameterizedTest @ValueSource(ints={2,3})
    void 첫단계가_아니면_통합단계오류다(int step) {
        readyHost(); ReflectionTestUtils.setField(team,"currentStep",step);
        error("COOPERATIVE_MISSION_STEP_NOT_ALLOWED"); verifyNoInteractions(cards,roles);
    }
    @Test void 첫단계라도_완료상태면_동일배정검사전에_차단한다() {
        readyHost(); team.complete(JOINED_AT);
        error("COOPERATIVE_MISSION_STEP_NOT_ALLOWED"); verifyNoInteractions(cards,roles);
    }
    @Test void 없는카드는_대상조회전에_실패한다() {
        readyHost(); error("COOPERATIVE_ROLE_CARD_NOT_FOUND");
        verify(participants,never()).findByIdAndCooperativeMissionProgressId(anyLong(),anyLong()); verifyNoInteractions(roles);
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void 없는대상과_대기대상은_배정조회전에_실패한다(boolean pending) {
        readyCard();
        if(pending)when(participants.findByIdAndCooperativeMissionProgressId(102L,71L))
                .thenReturn(Optional.of(identified(activeUser(16L),102L,ParticipantRole.MEMBER,ParticipantStatus.PENDING)));
        error("COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND"); verifyNoInteractions(roles);
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void 방장과_수락팀원_모두_처음배정할수있다(boolean hostTarget) {
        if(hostTarget)target=identified(host,102L,ParticipantRole.HOST,ParticipantStatus.ACCEPTED);
        readyTarget(); save();
        var capture=ArgumentCaptor.forClass(CooperativeMissionRoleProgress.class); verify(roles).save(capture.capture());
        var row=capture.getValue();
        assertThat(row.getParticipant()).isSameAs(target); assertThat(row.getRoleCard()).isSameAs(card);
        assertThat(row.getId()).isEqualTo(new CooperativeMissionRoleProgressId(102L,1L));
        assertThat(row.getProgressStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(row.getItemImgUrl()).isNull(); assertThat(row.getCompletedAt()).isNull();
        var order=inOrder(users,teams,participants,cards,roles);
        order.verify(users).findById(15L); order.verify(teams).findByIdForUpdate(71L);
        order.verify(participants).findByCooperativeMissionProgressIdAndUserId(71L,15L);
        order.verify(cards).findById(1L); order.verify(participants).findByIdAndCooperativeMissionProgressId(102L,71L);
        order.verify(roles).findByParticipantCooperativeMissionProgressIdAndRoleCardId(71L,1L);
        order.verify(roles).save(row);
        verify(roles,never()).delete(any()); verify(roles,never()).flush(); verifyNoInteractions(statuses,granter);
        assertThat(team.getCurrentStep()).isEqualTo(1);
    }
    @Test void 동일배정은_상태와시각을_그대로_유지한다() {
        readyTarget(); var row=existing(target);
        ReflectionTestUtils.setField(row,"createdAt",JOINED_AT); ReflectionTestUtils.setField(row,"updatedAt",JOINED_AT);
        when(roles.findByParticipantCooperativeMissionProgressIdAndRoleCardId(71L,1L)).thenReturn(Optional.of(row));
        save(); verify(roles,never()).save(any()); verify(roles,never()).delete(any()); verify(roles,never()).flush();
        assertThat(row.getCreatedAt()).isEqualTo(JOINED_AT); assertThat(row.getUpdatedAt()).isEqualTo(JOINED_AT);
        assertThat(row.getItemImgUrl()).isEqualTo("proof.jpg"); assertThat(row.getCompletedAt()).isEqualTo(JOINED_AT);
    }
    @Test void 교체는_원래PK를_유지하며_인증필드를_복사한다() {
        readyTarget(); var old=existing(hostParticipant);
        when(roles.findByParticipantCooperativeMissionProgressIdAndRoleCardId(71L,1L)).thenReturn(Optional.of(old));
        save();
        var capture=ArgumentCaptor.forClass(CooperativeMissionRoleProgress.class);
        var order=inOrder(roles); order.verify(roles).findByParticipantCooperativeMissionProgressIdAndRoleCardId(71L,1L);
        order.verify(roles).delete(old); order.verify(roles).flush(); order.verify(roles).save(capture.capture());
        var replacement=capture.getValue();
        assertThat(old.getId()).isEqualTo(new CooperativeMissionRoleProgressId(101L,1L));
        assertThat(replacement.getId()).isEqualTo(new CooperativeMissionRoleProgressId(102L,1L));
        assertThat(replacement.getProgressStatus()).isEqualTo(old.getProgressStatus());
        assertThat(replacement.getItemImgUrl()).isEqualTo(old.getItemImgUrl());
        assertThat(replacement.getCompletedAt()).isEqualTo(old.getCompletedAt());
        verifyNoInteractions(statuses,granter);
    }
    @ParameterizedTest @ValueSource(strings={"DELETE","FLUSH","SAVE"})
    void 교체실패는_숨기지않고_전파한다(String stage) {
        readyTarget(); var old=existing(hostParticipant);
        when(roles.findByParticipantCooperativeMissionProgressIdAndRoleCardId(71L,1L)).thenReturn(Optional.of(old));
        var failure=new IllegalStateException("교체 실패");
        switch(stage) {
            case "DELETE" -> doThrow(failure).when(roles).delete(old);
            case "FLUSH" -> doThrow(failure).when(roles).flush();
            case "SAVE" -> doThrow(failure).when(roles).save(any());
        }
        assertThatThrownBy(this::save).isSameAs(failure);
        assertThat(team.getCurrentStep()).isEqualTo(1); verifyNoInteractions(statuses,granter);
    }
    /** 식별자가 있는 참가자를 만든다. */
    private CooperativeMissionParticipant identified(User user,Long id,ParticipantRole role,ParticipantStatus status) {
        var p=participant(user,team,status,role); ReflectionTestUtils.setField(p,"id",id); return p;
    }
    /** 교체·유지 때 인증 정보 보존을 확인할 기존 기록이다. */
    private CooperativeMissionRoleProgress existing(CooperativeMissionParticipant p) {
        return CooperativeMissionRoleProgress.builder().participant(p).roleCard(card).progressStatus(MissionProgressStatus.COMPLETED)
                .itemImgUrl("proof.jpg").completedAt(JOINED_AT).build();
    }
    private void readyTeam() {
        when(users.findById(15L)).thenReturn(Optional.of(host)); when(teams.findByIdForUpdate(71L)).thenReturn(Optional.of(team));
    }
    private void readyHost() {
        readyTeam(); when(participants.findByCooperativeMissionProgressIdAndUserId(71L,15L)).thenReturn(Optional.of(hostParticipant));
    }
    private void readyCard() { readyHost(); when(cards.findById(1L)).thenReturn(Optional.of(card)); }
    private void readyTarget() { readyCard(); when(participants.findByIdAndCooperativeMissionProgressId(102L,71L)).thenReturn(Optional.of(target)); }
    private void save() { service.saveCooperativeMissionRoleAssignment(15L,71L,1L,new SaveCooperativeMissionRoleAssignmentRequest(102L)); }
    private void error(String code) {
        assertThatThrownBy(this::save).isInstanceOfSatisfying(BusinessException.class,e -> assertThat(e.getErrorCode().code()).isEqualTo(code));
    }
}
