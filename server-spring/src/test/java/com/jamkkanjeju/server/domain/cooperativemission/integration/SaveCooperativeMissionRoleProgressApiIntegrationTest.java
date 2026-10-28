package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.PictureFixtures.image;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRoleProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionRoleProgressIntegrationSupport;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import java.time.LocalDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** HTTP·실제 JPA·임시 MySQL을 연결하여 역할 사진의 저장·오류·보존·롤백을 확인한다. */
@Transactional
class SaveCooperativeMissionRoleProgressApiIntegrationTest extends CooperativeMissionRoleProgressIntegrationSupport {
    @MockitoSpyBean CooperativeMissionRoleProgressRepository roles;

    @ParameterizedTest @ValueSource(strings={"JPEG","PNG","WEBP"})
    void 실제형식으로_역할만완료하고_폴링에반영한다(String format) throws Exception {
        var d=data(); var otherCard=trackedRoleCard(); assignedRole(d.participant(),otherCard,false);
        var member=member(user(),d.team(),ParticipantStatus.ACCEPTED); var memberCard=trackedRoleCard(); assignedRole(member,memberCard,false);
        var otherUser=user(); var otherTeam=team(otherUser,d.team().getCooperativeMission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false);
        assignedRole(participantOf(otherTeam,otherUser),d.card(),false);
        clear(); var before=snapshot(d.team().getId()).subList(0,2); var rewards=rewardSnapshot(d.user());
        var otherBefore=snapshot(otherTeam.getId()); var otherRoleBefore=assignmentRows(d.team().getId(),otherCard.getId());
        verifyPhoto(d.user(),d.team().getId(),d.card().getId(),image(format)).andExpect(status().isOk())
                .andExpect(content().json("{\"isVerified\":true}")); clear();
        var row=assignmentRows(d.team().getId(),d.card().getId()).getFirst();
        String ext=format.equals("JPEG") ? "jpg" : format.toLowerCase();
        assertThat(row.get("item_img_url").toString()).matches("https://example\\.invalid/cooperative_mission_role/"+d.team().getId()+"/"+d.card().getId()+"/[0-9a-f-]{36}\\."+ext);
        assertThat(row.get("progress_status")).isEqualTo("COMPLETED");
        assertThat(row.get("completed_at")).isEqualTo(LocalDateTime.now(CLOCK));
        assertThat(snapshot(d.team().getId()).subList(0,2)).isEqualTo(before);
        assertThat(rewardSnapshot(d.user())).isEqualTo(rewards); assertThat(snapshot(otherTeam.getId())).isEqualTo(otherBefore);
        assertThat(assignmentRows(d.team().getId(),otherCard.getId())).isEqualTo(otherRoleBefore);
        mvc.perform(get("/api/v2/cooperative-missions/{id}/progress",d.team().getId()).param("latitude","33.4").param("longitude","126.5")
                .header("Authorization","Bearer "+tokens.createAccessToken(d.user()).value()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completedRoleCount").value(1)).andExpect(jsonPath("$.totalRoleCount").value(3))
                .andExpect(jsonPath("$.roleProgresses[?(@.roleCardId == "+d.card().getId()+")].itemImgUrl")
                        .value(org.hamcrest.Matchers.hasItem(row.get("item_img_url").toString())));
        verifyPhoto(member.getUser(),d.team().getId(),memberCard.getId(),image(format)).andExpect(status().isOk());
        verifyPhoto(d.user(),d.team().getId(),otherCard.getId(),image(format)).andExpect(status().isOk());
        assertThat(snapshot(d.team().getId()).subList(0,2)).isEqualTo(before);
        assertThat(rewardSnapshot(d.user())).isEqualTo(rewards);
        var completed=snapshot(d.team().getId());
        error(verifyPhoto(d),409,"COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED"); assertThat(snapshot(d.team().getId())).isEqualTo(completed);
        verify(storage,times(3)).upload(eq(image(format)),anyString(),eq("image/"+format.toLowerCase()));
    }

    @ParameterizedTest @ValueSource(strings={"MISSING_TEAM","MISSING_ROLE","INACTIVE","FIRST","THIRD","COMPLETED","OTHER","PENDING","ALREADY"})
    void 도메인오류는_상태를보존하고_판정업로드하지않는다(String kind) throws Exception {
        var d=data(); var caller=d.user(); Object team=d.team().getId(), card=d.card().getId();
        int status=404; String code;
        switch(kind) {
            case "MISSING_TEAM" -> { team=Long.MAX_VALUE; code="COOPERATIVE_MISSION_PROGRESS_NOT_FOUND"; }
            case "MISSING_ROLE" -> { card=Long.MAX_VALUE; code="COOPERATIVE_ROLE_PROGRESS_NOT_FOUND"; }
            case "INACTIVE" -> { d.team().getCooperativeMission().changeStatus(MissionActivationStatus.INACTIVE); code="COOPERATIVE_MISSION_INACTIVE"; }
            case "FIRST","THIRD","COMPLETED" -> {
                if(kind.equals("COMPLETED"))d.team().complete(JOINED_AT); else ReflectionTestUtils.setField(d.team(),"currentStep",kind.equals("FIRST") ? 1 : 3);
                status=409; code="COOPERATIVE_MISSION_STEP_NOT_ALLOWED";
            }
            case "OTHER","PENDING" -> {
                if(kind.equals("OTHER"))caller=user(); else ReflectionTestUtils.setField(d.participant(),"participantStatus",ParticipantStatus.PENDING);
                status=403; code="COOPERATIVE_ROLE_PROGRESS_ACCESS_DENIED";
            }
            default -> {
                var role=em.find(CooperativeMissionRoleProgress.class,new CooperativeMissionRoleProgressId(d.participant().getId(),d.card().getId())); role.complete("old-url",JOINED_AT);
                status=409; code="COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED";
            }
        }
        clear(); var before=snapshot(d.team().getId()); var rewards=rewardSnapshot(d.user());
        error(verifyPhoto(caller,team,card,image("PNG")),status,code);
        assertThat(snapshot(d.team().getId())).isEqualTo(before); assertThat(rewardSnapshot(d.user())).isEqualTo(rewards);
        verifyNoInteractions(verifier,storage);
    }

    @ParameterizedTest @ValueSource(strings={"MISSING","EMPTY","FORMAT","CORRUPT","SIZE","PATH","NO_TOKEN","NO_USER"})
    void 요청오류와_인증오류는_명세응답이며_저장하지않는다(String kind) throws Exception {
        var d=data(); clear(); var before=snapshot(d.team().getId()); int status=400; String code="INVALID_REQUEST";
        var request=multipart(VERIFY_URL,kind.equals("PATH") ? "abc" : d.team().getId(),d.card().getId());
        if(!kind.equals("MISSING")) {
            byte[] bytes=switch(kind) {
                case "EMPTY" -> new byte[0]; case "FORMAT" -> "GIF89a".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
                case "CORRUPT" -> Arrays.copyOf(image("PNG"),20); case "SIZE" -> Arrays.copyOf(image("PNG"),10_000_001);
                default -> image("PNG");
            };
            request.file(file(bytes));
        }
        if(!kind.equals("NO_TOKEN"))request.header("Authorization","Bearer "+tokens.createAccessToken(kind.equals("NO_USER") ? activeUser(Long.MAX_VALUE) : d.user()).value());
        switch(kind) {
            case "FORMAT" -> code="INVALID_IMAGE_FORMAT"; case "CORRUPT" -> code="INVALID_IMAGE"; case "SIZE" -> code="IMAGE_SIZE_EXCEEDED";
            case "NO_TOKEN","NO_USER" -> { status=401; code="UNAUTHORIZED"; }
        }
        error(mvc.perform(request),status,code); assertThat(snapshot(d.team().getId())).isEqualTo(before); verifyNoInteractions(verifier,storage);
    }

    @Test void 실패판정은_정상응답이며_상태와파일을유지한다() throws Exception {
        var d=data(); clear(); var before=snapshot(d.team().getId());
        doReturn(false).when(verifier).verify(any(),anyString(),anyString(),anyString(),any());
        assertThat(body(verifyPhoto(d).andExpect(status().isOk()))).containsExactlyEntriesOf(Map.of("isVerified",false));
        assertThat(snapshot(d.team().getId())).isEqualTo(before); verifyNoInteractions(storage);
    }

    @ParameterizedTest @ValueSource(strings={"VERIFY","UPLOAD","FLUSH","COMMIT"})
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void 실행장애는_500이며_DB롤백과_이번Blob정리를수행한다(String stage) throws Exception {
        var d=transactions.execute(tx -> data()); var before=snapshot(d.team().getId()); var rewards=rewardSnapshot(d.user());
        var failure=new IllegalStateException("노출하면 안 되는 내부 장애");
        switch(stage) {
            case "VERIFY" -> doThrow(failure).when(verifier).verify(any(),anyString(),anyString(),anyString(),any());
            case "UPLOAD" -> when(storage.upload(any(),anyString(),anyString())).thenThrow(failure);
            case "FLUSH" -> doAnswer(i -> { i.callRealMethod(); throw failure; }).when(roles).saveAndFlush(any());
            case "COMMIT" -> doAnswer(i -> {
                Object result=i.callRealMethod();
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void beforeCommit(boolean readOnly) { throw failure; }
                }); return result;
            }).when(roles).saveAndFlush(any());
        }
        error(verifyPhoto(d),500,"INTERNAL_SERVER_ERROR");
        assertThat(snapshot(d.team().getId())).isEqualTo(before); assertThat(rewardSnapshot(d.user())).isEqualTo(rewards);
        if(stage.equals("FLUSH") || stage.equals("COMMIT"))verify(storage).delete(startsWith("cooperative_mission_role/"+d.team().getId()+"/"+d.card().getId()+"/"));
        else verify(storage,never()).delete(anyString());
        reset(storage,verifier,roles); storageReady();
        verifyPhoto(d).andExpect(status().isOk()).andExpect(jsonPath("$.isVerified").value(true));
    }
    /** 상태·메시지·필드 수를 명세의 ErrorCode와 비교한다. */
    private void error(ResultActions result,int status,String code) throws Exception {
        String message;
        try { message=com.jamkkanjeju.server.domain.cooperativemission.exception.CooperativeMissionErrorCode.valueOf(code).message(); }
        catch(IllegalArgumentException e) { message=com.jamkkanjeju.server.common.exception.CommonErrorCode.valueOf(code).message(); }
        assertThat(body(result.andExpect(status().is(status)))).containsExactlyInAnyOrderEntriesOf(Map.of("code",code,"message",message));
    }
}
