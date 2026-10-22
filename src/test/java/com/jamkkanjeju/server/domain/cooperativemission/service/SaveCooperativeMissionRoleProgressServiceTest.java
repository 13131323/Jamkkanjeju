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
import com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionRoleProgressRequest;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.exception.CooperativeMissionErrorCode;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 이미지 검증부터 판정·업로드·역할 완료까지 서비스 분기를 DB 없이 확인한다. */
@ExtendWith(MockitoExtension.class)
class SaveCooperativeMissionRoleProgressServiceTest {
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
    private final byte[] bytes={1,2,3};
    private final SaveCooperativeMissionRoleProgressRequest request=new SaveCooperativeMissionRoleProgressRequest(
            new MockMultipartFile("itemImage","fake.gif","image/gif",bytes));
    private final CooperativeMission mission=rewardedMission();
    private final CooperativeMissionProgress team=statusProgress(71L,mission,2);
    private CooperativeMissionRoleProgress role;

    @BeforeEach void setup() {
        service=new CooperativeMissionService(users,missions,teams,participants,roles,cards,statuses,granter,validator,storage,verifier,CLOCK);
        var p=participant(activeUser(15L),team,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER);
        ReflectionTestUtils.setField(p,"id",101L);
        role=CooperativeMissionRoleProgress.builder().participant(p).roleCard(card(1L))
                .progressStatus(MissionProgressStatus.IN_PROGRESS).build();
        TransactionSynchronizationManager.initSynchronization();
    }
    @AfterEach void clear() { TransactionSynchronizationManager.clearSynchronization(); }
    @Test void 이미지실패는_사용자조회전에_중단한다() {
        when(validator.validate(any(),any(),any(),any())).thenThrow(new BusinessException(CooperativeMissionErrorCode.INVALID_IMAGE));
        error("INVALID_IMAGE"); verifyNoInteractions(users,teams,roles,verifier,storage);
    }
    @Test void 사용자없음은_팀조회전에_중단한다() { imageReady(); error("UNAUTHORIZED"); verifyNoInteractions(teams,roles,verifier,storage); }
    @Test void 팀없음은_역할조회전에_중단한다() { userReady(); error("COOPERATIVE_MISSION_PROGRESS_NOT_FOUND"); verifyNoInteractions(roles,verifier,storage); }
    @Test void 비활성미션은_역할조회전에_차단한다() { teamReady(); mission.changeStatus(MissionActivationStatus.INACTIVE); error("COOPERATIVE_MISSION_INACTIVE"); verifyNoInteractions(roles,verifier,storage); }
    @ParameterizedTest @ValueSource(ints={1,3})
    void 수행단계가아니면_차단한다(int step) { teamReady(); ReflectionTestUtils.setField(team,"currentStep",step); error("COOPERATIVE_MISSION_STEP_NOT_ALLOWED"); verifyNoInteractions(roles,verifier,storage); }
    @Test void 완료팀은_수행단계여도_차단한다() { teamReady(); team.complete(JOINED_AT); error("COOPERATIVE_MISSION_STEP_NOT_ALLOWED"); }
    @Test void 배정없으면_새로만들지않는다() { teamReady(); error("COOPERATIVE_ROLE_PROGRESS_NOT_FOUND"); verifyNoInteractions(verifier,storage); verify(roles,never()).saveAndFlush(any()); }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void 타인담당과_대기상태는_차단한다(boolean pending) {
        if(pending)ReflectionTestUtils.setField(role.getParticipant(),"participantStatus",ParticipantStatus.PENDING);
        else ReflectionTestUtils.setField(role.getParticipant(),"user",activeUser(16L));
        roleReady(); error("COOPERATIVE_ROLE_PROGRESS_ACCESS_DENIED"); verifyNoInteractions(verifier,storage);
    }
    @Test void 완료역할은_재판정하지않는다() { role.complete("old",JOINED_AT); roleReady(); error("COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED"); verifyNoInteractions(verifier,storage); }
    @Test void 실패판정은_파일과상태를_변경하지않는다() {
        roleReady(); assertThat(save().isVerified()).isFalse(); verifyNoInteractions(storage); verify(roles,never()).saveAndFlush(any()); unchanged();
        verify(verifier).verify(bytes,"image/png",role.getRoleCard().getRoleName(),role.getRoleCard().getRoleDescription(),role.getRoleCard().getLocationToFind());
    }
    @Test void 성공은_원본과실제형식으로_업로드하고_역할만완료한다() {
        verifiedReady(); when(storage.upload(any(),anyString(),anyString())).thenAnswer(i -> new BlobStorageClient.UploadedBlob(i.getArgument(1),"blob-url"));
        assertThat(save().isVerified()).isTrue();
        verify(storage).upload(eq(bytes),matches("cooperative_mission_role/71/1/[0-9a-f-]{36}\\.png"),eq("image/png"));
        assertThat(role.getItemImgUrl()).isEqualTo("blob-url"); assertThat(role.getProgressStatus()).isEqualTo(MissionProgressStatus.COMPLETED);
        assertThat(role.getCompletedAt()).isEqualTo(LocalDateTime.now(CLOCK)); verify(roles).saveAndFlush(role);
        var order=inOrder(validator,users,teams,roles,verifier,storage);
        order.verify(validator).validate(request.itemImage(),CooperativeMissionErrorCode.INVALID_IMAGE_FORMAT,CooperativeMissionErrorCode.IMAGE_SIZE_EXCEEDED,CooperativeMissionErrorCode.INVALID_IMAGE);
        order.verify(users).findById(15L); order.verify(teams).findByIdForUpdate(71L);
        order.verify(roles).findByParticipantCooperativeMissionProgressIdAndRoleCardId(71L,1L);
        order.verify(verifier).verify(any(),anyString(),anyString(),anyString(),any());
        order.verify(storage).upload(any(),anyString(),anyString()); order.verify(roles).saveAndFlush(role);
        assertThat(team.getCurrentStep()).isEqualTo(2); assertThat(team.getCompletedAt()).isNull(); verifyNoInteractions(statuses,granter);
    }
    @ParameterizedTest @ValueSource(strings={"VERIFY","UPLOAD","SAVE"})
    void 실행장애는_실패판정으로_숨기지않는다(String stage) {
        var failure=new IllegalStateException("내부 장애");
        if(stage.equals("VERIFY")) { roleReady(); when(verifier.verify(any(),anyString(),anyString(),anyString(),any())).thenThrow(failure); }
        else {
            verifiedReady();
            if(stage.equals("UPLOAD"))when(storage.upload(any(),anyString(),anyString())).thenThrow(failure);
            else { when(storage.upload(any(),anyString(),anyString())).thenReturn(new BlobStorageClient.UploadedBlob("new","url")); when(roles.saveAndFlush(any())).thenThrow(failure); }
        }
        assertThatThrownBy(this::save).isSameAs(failure);
        if(!stage.equals("SAVE"))unchanged();
        TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(1));
        if(stage.equals("SAVE"))verify(storage).delete("new"); else verify(storage,never()).delete(anyString());
    }
    private void imageReady() { when(validator.validate(any(),any(),any(),any())).thenReturn(new ImageValidator.ValidatedImage(bytes,ImageValidator.ImageFormat.PNG)); }
    private void userReady() { imageReady(); when(users.findById(15L)).thenReturn(Optional.of(activeUser(15L))); }
    private void teamReady() { userReady(); when(teams.findByIdForUpdate(71L)).thenReturn(Optional.of(team)); }
    private void roleReady() { teamReady(); when(roles.findByParticipantCooperativeMissionProgressIdAndRoleCardId(71L,1L)).thenReturn(Optional.of(role)); }
    private void verifiedReady() { roleReady(); when(verifier.verify(any(),anyString(),anyString(),anyString(),any())).thenReturn(true); }
    private com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionRoleProgressResponse save() { return service.saveCooperativeMissionRoleProgress(15L,71L,1L,request); }
    private void error(String code) { assertThatThrownBy(this::save).isInstanceOfSatisfying(BusinessException.class,e -> assertThat(e.getErrorCode().code()).isEqualTo(code)); }
    private void unchanged() { assertThat(role.getProgressStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS); assertThat(role.getItemImgUrl()).isNull(); assertThat(role.getCompletedAt()).isNull(); }
}
