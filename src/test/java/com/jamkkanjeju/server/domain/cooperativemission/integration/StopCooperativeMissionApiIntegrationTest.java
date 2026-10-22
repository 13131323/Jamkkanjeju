package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionStopIntegrationSupport;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 임시 MySQL에서 실제 중단·승계·삭제 연쇄·오류·롤백과 폴링을 검증한다. */
@Transactional
class StopCooperativeMissionApiIntegrationTest extends CooperativeMissionStopIntegrationSupport {
    @MockitoSpyBean CooperativeMissionParticipantRepository participants;
    @MockitoSpyBean CooperativeMissionProgressRepository teams;

    @ParameterizedTest @ValueSource(booleans={false,true})
    void 팀원과대기자는_본인과역할만삭제하고_다른데이터를보존한다(boolean pending) throws Exception {
        var d=data(); var caller=d.member().getUser();
        if(pending) { ReflectionTestUtils.setField(d.member(),"participantStatus",ParticipantStatus.PENDING); ReflectionTestUtils.setField(d.member(),"joinedAt",null); }
        var extra=trackedRoleCard(); assignedRole(d.member(),extra,false);
        var other=team(caller,d.team().getCooperativeMission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        assignedRole(participantOf(other,caller),d.memberCard(),false); clear();
        var otherBefore=snapshot(other.getId()); var hostBefore=assignmentRows(d.team().getId(),d.hostCard().getId());
        var teamBefore=snapshot(d.team().getId()).getFirst(); var rewards=rewardSnapshot(caller).subList(0,4);
        long cards=count("cooperative_role_card"); long users=count("user"); long missions=count("mission");
        stop(caller,d.team().getId()).andExpect(status().isNoContent()).andExpect(content().string("")); clear();
        assertThat(assignmentRows(d.team().getId(),d.memberCard().getId())).isEmpty();
        assertThat(assignmentRows(d.team().getId(),extra.getId())).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where id=?",Long.class,d.member().getId())).isZero();
        assertThat(assignmentRows(d.team().getId(),d.hostCard().getId())).isEqualTo(hostBefore);
        assertThat(snapshot(d.team().getId()).getFirst()).isEqualTo(teamBefore); assertThat(snapshot(other.getId())).isEqualTo(otherBefore);
        assertThat(rewardSnapshot(caller).subList(0,4)).isEqualTo(rewards);
        assertThat(count("cooperative_role_card")).isEqualTo(cards); assertThat(count("user")).isEqualTo(users); assertThat(count("mission")).isEqualTo(missions);
        poll(d.host(),d.team().getId()).andExpect(status().isOk()).andExpect(jsonPath("$.participants.length()").value(1))
                .andExpect(jsonPath("$.totalRoleCount").value(1));
        error(poll(caller,d.team().getId()),404,"COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND");
        error(stop(caller,d.team().getId()),403,"COOPERATIVE_MISSION_LEAVE_ACCESS_DENIED");
        assign(d.host(),d.team().getId(),d.memberCard().getId(),d.hostP().getId()).andExpect(status().isNoContent()); clear();
        assertThat(assignmentRows(d.team().getId(),d.memberCard().getId())).hasSize(1);
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void 방장중단은_합류시각과ID로_승계하고_새방장권한과폴링에반영한다(boolean sameTime) throws Exception {
        var d=data(); var later=member(user(),d.team(),ParticipantStatus.ACCEPTED); var waiting=member(user(),d.team(),ParticipantStatus.PENDING);
        ReflectionTestUtils.setField(d.member(),"joinedAt",sameTime ? JOINED_AT : JOINED_AT.plusDays(1));
        ReflectionTestUtils.setField(later,"joinedAt",JOINED_AT); var laterCard=trackedRoleCard(); assignedRole(later,laterCard,false); clear();
        var successor=sameTime ? d.member() : later;
        var original=jdbc.queryForMap("select * from cooperative_mission_participant where id=?",successor.getId());
        var teamBefore=snapshot(d.team().getId()).getFirst(); var beforeRoles=assignmentRows(d.team().getId(),d.memberCard().getId());
        var laterRoles=assignmentRows(d.team().getId(),laterCard.getId()); var rewards=rewardSnapshot(successor.getUser()).subList(0,4);
        stop(d.host(),d.team().getId()).andExpect(status().isNoContent()).andExpect(content().string("")); clear();
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=? and participant_role='HOST'",Long.class,d.team().getId())).isEqualTo(1);
        var changed=jdbc.queryForMap("select * from cooperative_mission_participant where id=?",successor.getId());
        for(String field:original.keySet())if(!field.equals("participant_role") && !field.equals("updated_at"))assertThat(changed.get(field)).isEqualTo(original.get(field));
        assertThat(changed).containsEntry("participant_role","HOST");
        assertThat(jdbc.queryForObject("select participant_status from cooperative_mission_participant where id=?",String.class,waiting.getId())).isEqualTo("PENDING");
        assertThat(assignmentRows(d.team().getId(),d.hostCard().getId())).isEmpty();
        assertThat(assignmentRows(d.team().getId(),d.memberCard().getId())).isEqualTo(beforeRoles);
        assertThat(assignmentRows(d.team().getId(),laterCard.getId())).isEqualTo(laterRoles);
        assertThat(snapshot(d.team().getId()).getFirst()).isEqualTo(teamBefore); assertThat(rewardSnapshot(successor.getUser()).subList(0,4)).isEqualTo(rewards);
        poll(successor.getUser(),d.team().getId()).andExpect(status().isOk()).andExpect(jsonPath("$.currentParticipant.participantRole").value("HOST"))
                .andExpect(jsonPath("$.participants.length()").value(3)).andExpect(jsonPath("$.totalRoleCount").value(2));
        assign(successor.getUser(),d.team().getId(),d.hostCard().getId(),successor.getId()).andExpect(status().isNoContent());
        error(assign(d.host(),d.team().getId(),d.hostCard().getId(),successor.getId()),403,"COOPERATIVE_MISSION_HOST_ONLY");
    }

    @ParameterizedTest @ValueSource(strings={"HOST","MEMBER","PENDING"})
    void 마지막참가자는_팀과역할까지_삭제하고_새로시작할수있다(String kind) throws Exception {
        var user=user(); var mission=mission(); var team=team(user,mission,kind.equals("PENDING") ? ParticipantStatus.PENDING : ParticipantStatus.ACCEPTED,
                kind.equals("HOST") ? ParticipantRole.HOST : ParticipantRole.MEMBER,1,false);
        var p=participantOf(team,user); var card=trackedRoleCard(); assignedRole(p,card,false); clear();
        var rewards=rewardSnapshot(user).subList(0,4);
        stop(user,team.getId()).andExpect(status().isNoContent()); clear();
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_progress where id=?",Long.class,team.getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where id=?",Long.class,p.getId())).isZero();
        assertThat(assignmentRows(team.getId(),card.getId())).isEmpty(); assertThat(rewardSnapshot(user).subList(0,4)).isEqualTo(rewards);
        error(stop(user,team.getId()),404,"COOPERATIVE_MISSION_PROGRESS_NOT_FOUND");
        error(poll(user,team.getId()),404,"COOPERATIVE_MISSION_PROGRESS_NOT_FOUND");
        start(user,mission.getMissionId()).andExpect(status().isCreated()); clear();
        assertThat(teamCount(mission.getMissionId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select id from cooperative_mission_progress where cooperative_mission_id=?",Long.class,mission.getMissionId())).isNotEqualTo(team.getId());
        assertThat(rewardSnapshot(user).subList(0,4)).isEqualTo(rewards);
    }

    @Test void 방장외에대기자만있으면_모두삭제하고_원본과다른팀은보존한다() throws Exception {
        var d=data(); ReflectionTestUtils.setField(d.member(),"participantStatus",ParticipantStatus.PENDING); ReflectionTestUtils.setField(d.member(),"joinedAt",null);
        var other=team(d.host(),d.team().getCooperativeMission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        assignedRole(participantOf(other,d.host()),d.hostCard(),false); clear(); var otherBefore=snapshot(other.getId());
        long cards=count("cooperative_role_card"); long users=count("user"); long missions=count("mission");
        var rewards=rewardSnapshot(d.host()).subList(0,4);
        stop(d.host(),d.team().getId()).andExpect(status().isNoContent()); clear();
        assertThat(snapshot(d.team().getId())).allSatisfy(rows -> assertThat((java.util.List<?>)rows).isEmpty());
        assertThat(snapshot(other.getId())).isEqualTo(otherBefore); assertThat(rewardSnapshot(d.host()).subList(0,4)).isEqualTo(rewards);
        assertThat(count("cooperative_role_card")).isEqualTo(cards); assertThat(count("user")).isEqualTo(users); assertThat(count("mission")).isEqualTo(missions);
        error(poll(d.member().getUser(),d.team().getId()),404,"COOPERATIVE_MISSION_PROGRESS_NOT_FOUND");
    }

    @ParameterizedTest @ValueSource(strings={"MISSING_TEAM","INACTIVE","OUTSIDER","SECOND","THIRD","COMPLETED","COMPLETED_FIRST","PATH","NO_TOKEN","NO_USER"})
    void 오류응답은_명세와일치하고_상태를보존한다(String kind) throws Exception {
        var d=data(); var caller=d.host(); Object team=d.team().getId(); int status=404; String code;
        switch(kind) {
            case "MISSING_TEAM" -> { team=Long.MAX_VALUE; code="COOPERATIVE_MISSION_PROGRESS_NOT_FOUND"; }
            case "INACTIVE" -> { d.team().getCooperativeMission().changeStatus(MissionActivationStatus.INACTIVE); code="COOPERATIVE_MISSION_INACTIVE"; }
            case "OUTSIDER" -> { caller=user(); status=403; code="COOPERATIVE_MISSION_LEAVE_ACCESS_DENIED"; }
            case "SECOND","THIRD","COMPLETED","COMPLETED_FIRST" -> {
                if(kind.startsWith("COMPLETED"))d.team().complete(JOINED_AT);
                if(!kind.equals("COMPLETED_FIRST"))ReflectionTestUtils.setField(d.team(),"currentStep",kind.equals("SECOND") ? 2 : 3);
                status=409; code="COOPERATIVE_MISSION_STEP_NOT_ALLOWED";
            }
            case "PATH" -> { team="invalid"; status=400; code="INVALID_REQUEST"; }
            default -> { status=401; code="UNAUTHORIZED"; }
        }
        clear(); var before=snapshot(d.team().getId()); var rewards=rewardSnapshot(d.host());
        var request=patch(STOP_URL,team);
        if(!kind.equals("NO_TOKEN"))request.header("Authorization","Bearer "+tokens.createAccessToken(kind.equals("NO_USER") ? activeUser(Long.MAX_VALUE) : caller).value());
        error(mvc.perform(request),status,code); assertThat(snapshot(d.team().getId())).isEqualTo(before); assertThat(rewardSnapshot(d.host())).isEqualTo(rewards);
    }

    @ParameterizedTest @ValueSource(strings={"MEMBER_DELETE","HOST_DELETE","TEAM_DELETE","COMMIT"})
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void 실제삭제또는_커밋실패는_승계와_삭제전체를_롤백한다(String kind) throws Exception {
        var d=transactions.execute(tx -> {
            var data=data();
            if(kind.equals("TEAM_DELETE")) { ReflectionTestUtils.setField(data.member(),"participantStatus",ParticipantStatus.PENDING); ReflectionTestUtils.setField(data.member(),"joinedAt",null); }
            em.flush(); return data;
        });
        var caller=kind.equals("MEMBER_DELETE") ? d.member().getUser() : d.host();
        var before=snapshot(d.team().getId()); var rewards=rewardSnapshot(d.host()); var failure=new IllegalStateException("노출 금지 삭제 장애");
        if(kind.equals("TEAM_DELETE"))doAnswer(i -> { i.callRealMethod(); em.flush(); throw failure; }).when(teams).delete(any(CooperativeMissionProgress.class));
        else doAnswer(i -> {
            i.callRealMethod(); em.flush();
            if(kind.equals("COMMIT")) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void beforeCommit(boolean readOnly) { throw failure; }
                }); return null;
            }
            throw failure;
        }).when(participants).delete(any(CooperativeMissionParticipant.class));
        error(stop(caller,d.team().getId()),500,"INTERNAL_SERVER_ERROR");
        assertThat(snapshot(d.team().getId())).isEqualTo(before); assertThat(rewardSnapshot(d.host())).isEqualTo(rewards);
        reset(participants,teams); stop(caller,d.team().getId()).andExpect(status().isNoContent());
    }

    @Test void 스웨거는_본문없이_진행도ID와_204를_명시한다() throws Exception {
        var result=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
        var json=tools.jackson.databind.json.JsonMapper.builder().build().readTree(result.andReturn().getResponse().getContentAsString());
        var operation=json.get("paths").get("/api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress/stop").get("patch");
        assertThat(operation.has("requestBody")).isFalse(); assertThat(operation.get("responses").has("204")).isTrue();
        var parameter=operation.get("parameters").get(0);
        assertThat(parameter.get("name").asText()).isEqualTo("cooperativeMissionProgressId"); assertThat(parameter.get("required").asBoolean()).isTrue();
        assertThat(parameter.get("schema").get("format").asText()).isEqualTo("int64");
    }
    /** 공개 오류 필드와 메시지를 정의된 오류 코드에 맞춰 확인한다. */
    private void error(ResultActions result,int status,String code) throws Exception {
        String message;
        try { message=com.jamkkanjeju.server.domain.cooperativemission.exception.CooperativeMissionErrorCode.valueOf(code).message(); }
        catch(IllegalArgumentException e) { message=com.jamkkanjeju.server.common.exception.CommonErrorCode.valueOf(code).message(); }
        assertThat(body(result.andExpect(status().is(status)))).containsExactlyInAnyOrderEntriesOf(Map.of("code",code,"message",message));
    }
}
