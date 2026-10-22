package com.jamkkanjeju.server.domain.cooperativemission.support;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.image;
import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.service.CooperativeMissionPhotoVerifier;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.ResultActions;

/** 역할 사진 테스트에서 실제 DB·JWT와 외부 Blob 대체 객체를 공유한다. */
public abstract class CooperativeMissionRoleProgressIntegrationSupport extends CooperativeMissionRoleAssignmentIntegrationSupport {
    protected static final String VERIFY_URL="/api/v2/cooperative-missions/{id}/role-progresses/{card}/verification";
    @MockitoBean protected BlobStorageClient storage;
    @MockitoSpyBean protected CooperativeMissionPhotoVerifier verifier;

    @BeforeEach protected void storageReady() {
        clearInvocations(storage);
        when(storage.upload(any(),anyString(),anyString())).thenAnswer(i -> {
            String name=i.getArgument(1);
            return new BlobStorageClient.UploadedBlob(name,"https://example.invalid/"+name);
        });
    }
    /** 장소 없는 수행 단계 팀에 호출자의 미완료 역할을 준비한다. */
    protected Data data() {
        var user=user(); var team=team(user,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false);
        var participant=participantOf(team,user); var card=trackedRoleCard(); assignedRole(participant,card,false);
        return new Data(user,team,participant,card);
    }
    /** 실제 내용과 다른 파일명·MIME으로 내용 기반 검증을 확인한다. */
    protected MockMultipartFile file(byte[] bytes) { return new MockMultipartFile("itemImage","untrusted.gif","application/octet-stream",bytes); }
    /** 실제 JWT로 multipart 사진 요청을 보낸다. */
    protected ResultActions verifyPhoto(User user,Object team,Object card,byte[] bytes) throws Exception {
        return mvc.perform(multipart(VERIFY_URL,team,card).file(file(bytes))
                .header("Authorization","Bearer "+tokens.createAccessToken(user).value()));
    }
    protected ResultActions verifyPhoto(Data data) throws Exception { return verifyPhoto(data.user(),data.team().getId(),data.card().getId(),image("PNG")); }
    protected record Data(User user,CooperativeMissionProgress team,CooperativeMissionParticipant participant,CooperativeRoleCard card) { }
}
