package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRoleProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionRoleAssignmentIntegrationSupport;
import com.jamkkanjeju.server.domain.mission.entity.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·HTTP·임시 MySQL로 배정·폴링·복합키 교체와 오류 시 보존을 확인한다. */
@Transactional
class SaveCooperativeMissionRoleAssignmentApiIntegrationTest extends CooperativeMissionRoleAssignmentIntegrationSupport {
    @MockitoSpyBean CooperativeMissionRoleProgressRepository roles;

    @Test void 최초배정과_복수카드는_204이며_반복요청은_전체행을유지한다() throws Exception {
        var host=user(); var team=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var hostP=participantOf(team,host); var target=member(user(),team,ParticipantStatus.ACCEPTED);
        member(user(),team,ParticipantStatus.ACCEPTED); // 역할 없는 다른 참가자가 있어도 배정 자체는 허용한다.
        var a=trackedRoleCard(); var b=trackedRoleCard(); var unused=trackedRoleCard(); clear();
        var preserved=snapshot(team.getId()).subList(0,2); var rewards=rewardSnapshot(host).subList(0,4);
        assign(host,team.getId(),a.getId(),hostP.getId()).andExpect(status().isNoContent()).andExpect(content().string("")); clear();
        var stored=assignmentRows(team.getId(),a.getId()).getFirst();
        assertThat(stored.get("progress_status")).isEqualTo("IN_PROGRESS");
        assertThat(stored.get("item_img_url")).isNull(); assertThat(stored.get("completed_at")).isNull();
        var before=snapshot(team.getId());
        assign(host,team.getId(),a.getId(),hostP.getId()).andExpect(status().isNoContent()); clear();
        assertThat(snapshot(team.getId())).isEqualTo(before);
        assign(host,team.getId(),b.getId(),hostP.getId()).andExpect(status().isNoContent()); clear();
        assertThat(assignmentRows(team.getId(),unused.getId())).isEmpty();
        read(host,team.getId()).andExpect(status().isOk()).andExpect(jsonPath("$.totalRoleCount").value(2))
                .andExpect(jsonPath("$.completedRoleCount").value(0))
                .andExpect(jsonPath("$.roleProgresses[0].participantId").value(hostP.getId()));
        assign(host,team.getId(),b.getId(),target.getId()).andExpect(status().isNoContent()); clear();
        read(host,team.getId()).andExpect(jsonPath("$.totalRoleCount").value(2));
        assertThat(snapshot(team.getId()).subList(0,2)).isEqualTo(preserved);
        assertThat(rewardSnapshot(host).subList(0,4)).isEqualTo(rewards);
    }

    @Test void 담당자교체는_복합키행만바꾸고_인증정보와_타팀다른역할을_보존한다() throws Exception {
        var host=user(); var mission=mission(); var team=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var hostP=participantOf(team,host); var target=member(user(),team,ParticipantStatus.ACCEPTED);
        var a=trackedRoleCard(); var b=trackedRoleCard(); var c=trackedRoleCard();
        assignedRole(hostP,a,true); assignedRole(hostP,b,false); assignedRole(target,c,false);
        var other=team(user(),mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var otherP=em.createQuery("select p from CooperativeMissionParticipant p where p.cooperativeMissionProgress.id=:id",CooperativeMissionParticipant.class)
                .setParameter("id",other.getId()).getSingleResult(); assignedRole(otherP,a,false); clear();
        var original=assignmentRows(team.getId(),a.getId()).getFirst(); var otherBefore=snapshot(other.getId());
        var bBefore=assignmentRows(team.getId(),b.getId()); var cBefore=assignmentRows(team.getId(),c.getId());
        var rewards=rewardSnapshot(host); var targetRewards=rewardSnapshot(target.getUser());
        assign(host,team.getId(),a.getId(),target.getId()).andExpect(status().isNoContent()); clear();
        var changed=assignmentRows(team.getId(),a.getId()); assertThat(changed).hasSize(1);
        assertThat(changed.getFirst()).containsEntry("cooperative_mission_participant_id",target.getId());
        for(String field:List.of("progress_status","item_img_url","completed_at"))assertThat(changed.getFirst().get(field)).isEqualTo(original.get(field));
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_role_progress where cooperative_mission_participant_id=? and cooperative_role_card_id=?",Long.class,hostP.getId(),a.getId())).isZero();
        assertThat(assignmentRows(team.getId(),b.getId())).isEqualTo(bBefore); assertThat(assignmentRows(team.getId(),c.getId())).isEqualTo(cBefore);
        assertThat(snapshot(other.getId())).isEqualTo(otherBefore);
        assign(host,team.getId(),a.getId(),hostP.getId()).andExpect(status().isNoContent()); clear();
        assertThat(assignmentRows(team.getId(),a.getId()).getFirst()).containsEntry("cooperative_mission_participant_id",hostP.getId());
        assertThat(rewardSnapshot(host)).isEqualTo(rewards); assertThat(rewardSnapshot(target.getUser())).isEqualTo(targetRewards);
    }

    @Test void 마지막역할을_넘겨도_배정은허용하고_수행전환에서_역할없음을검증한다() throws Exception {
        var host=user(); var team=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var hostP=participantOf(team,host); var target=member(user(),team,ParticipantStatus.ACCEPTED);
        var card=trackedRoleCard(); assignedRole(hostP,card,false); clear();
        assign(host,team.getId(),card.getId(),target.getId()).andExpect(status().isNoContent()); clear();
        assertThat(assignmentRows(team.getId(),card.getId()).getFirst()).containsEntry("cooperative_mission_participant_id",target.getId());
        error(mvc.perform(patch("/api/v2/cooperative-missions/{id}/progress",team.getId())
                .header("Authorization","Bearer "+tokens.createAccessToken(host).value()).contentType(MediaType.APPLICATION_JSON).content("{\"currentStep\":2}")),
                409,"COOPERATIVE_PARTICIPANT_ROLE_REQUIRED","모든 수락된 참가자에게 역할을 배정해야 합니다.");
    }

    @Test void 진행도카드대상오류와_비활성은_기존배정을_보존한다() throws Exception {
        var host=user(); var mission=mission(); var team=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var hostP=participantOf(team,host); var card=trackedRoleCard(); assignedRole(hostP,card,false);
        var pending=member(user(),team,ParticipantStatus.PENDING);
        var outsider=user(); var other=team(outsider,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var otherP=participantOf(other,outsider); clear(); var before=snapshot(team.getId()); var rewards=rewardSnapshot(host); var otherBefore=snapshot(other.getId());
        error(assign(host,Long.MAX_VALUE,card.getId(),hostP.getId()),404,"COOPERATIVE_MISSION_PROGRESS_NOT_FOUND","진행 중인 협동 미션을 찾을 수 없습니다.");
        error(assign(host,team.getId(),Long.MAX_VALUE,hostP.getId()),404,"COOPERATIVE_ROLE_CARD_NOT_FOUND","역할 카드를 찾을 수 없습니다.");
        for(Long id:List.of(Long.MAX_VALUE,0L,-1L,pending.getId(),otherP.getId()))
            error(assign(host,team.getId(),card.getId(),id),404,"COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND","협동 미션 참여 요청을 찾을 수 없습니다.");
        em.find(CooperativeMission.class,mission.getMissionId()).changeStatus(MissionActivationStatus.INACTIVE); clear();
        error(assign(host,team.getId(),card.getId(),hostP.getId()),404,"COOPERATIVE_MISSION_INACTIVE","비활성화된 협동 미션입니다.");
        assertThat(snapshot(team.getId())).isEqualTo(before); assertThat(snapshot(other.getId())).isEqualTo(otherBefore); assertThat(rewardSnapshot(host)).isEqualTo(rewards);
    }

    @Test void 비방장과_미참가자와_대기방장은403_미인증과없는사용자는401이다() throws Exception {
        var host=user(); var team=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var hostP=participantOf(team,host); var acceptedUser=user(); member(acceptedUser,team,ParticipantStatus.ACCEPTED);
        var outsider=user(); var pendingHost=user();
        var pendingTeam=team(pendingHost,mission(),ParticipantStatus.PENDING,ParticipantRole.HOST,1,false);
        var card=trackedRoleCard(); clear(); var before=snapshot(team.getId());
        for(User actor:List.of(acceptedUser,outsider))error(assign(actor,team.getId(),card.getId(),hostP.getId()),403,"COOPERATIVE_MISSION_HOST_ONLY","협동 미션 방장만 참여 요청을 처리할 수 있습니다.");
        error(assign(pendingHost,pendingTeam.getId(),card.getId(),hostP.getId()),403,"COOPERATIVE_MISSION_HOST_ONLY","협동 미션 방장만 참여 요청을 처리할 수 있습니다.");
        error(mvc.perform(put(ASSIGN_URL,team.getId(),card.getId()).contentType(MediaType.APPLICATION_JSON).content("{\"participantId\":1}")),401,"UNAUTHORIZED","인증이 필요합니다.");
        error(assign(activeUser(Long.MAX_VALUE),team.getId(),card.getId(),hostP.getId()),401,"UNAUTHORIZED","인증이 필요합니다.");
        assertThat(snapshot(team.getId())).isEqualTo(before);
    }

    @ParameterizedTest @ValueSource(ints={2,3})
    void 수행완료단계에서는_동일배정도_통합409다(int step) throws Exception {
        var host=user(); var team=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,step,step==3);
        var p=participantOf(team,host); var card=trackedRoleCard(); assignedRole(p,card,false); clear();
        var before=snapshot(team.getId());
        error(assign(host,team.getId(),card.getId(),p.getId()),409,"COOPERATIVE_MISSION_STEP_NOT_ALLOWED","현재 단계에서 허용되지 않는 요청입니다.");
        assertThat(snapshot(team.getId())).isEqualTo(before);
    }

    @Test void 잘못된본문과경로는400이며_Swagger는_필수Long과204를_공개한다() throws Exception {
        var host=user(); var team=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false); var card=trackedRoleCard(); clear(); var before=snapshot(team.getId());
        for(String json:List.of("","{}","null","{","{\"participantId\":null}","{\"participantId\":2.5}","{\"participantId\":\"21\"}",
                "{\"participantId\":true}","{\"participantId\":[]}","{\"participantId\":{}}","{\"participantId\":9223372036854775808}"))
            error(assignJson(host,team.getId(),card.getId(),json),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");
        error(assignJson(host,"bad",card.getId(),"{\"participantId\":1}"),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");
        error(assignJson(host,team.getId(),"bad","{\"participantId\":1}"),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");
        assertThat(snapshot(team.getId())).isEqualTo(before);
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-assignments/{roleCardId}'].put.parameters.length()").value(2))
                .andExpect(jsonPath("$.paths['/api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-assignments/{roleCardId}'].put.responses['204']").exists())
                .andExpect(jsonPath("$.components.schemas.SaveCooperativeMissionRoleAssignmentRequest.required[0]").value("participantId"))
                .andExpect(jsonPath("$.components.schemas.SaveCooperativeMissionRoleAssignmentRequest.properties.participantId.format").value("int64"));
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void 실제저장후_실패하면_신규배정과_교체를_롤백한다(boolean replace) throws Exception {
        var data=transactions.execute(tx -> {
            var host=user(); var team=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
            var target=member(user(),team,ParticipantStatus.ACCEPTED); var card=trackedRoleCard();
            if(replace)assignedRole(participantOf(team,host),card,true);
            em.flush(); return new Data(host,team.getId(),card.getId(),target.getId());
        });
        var before=snapshot(data.team()); var rewards=rewardSnapshot(data.host());
        doAnswer(invocation -> {
            em.merge(invocation.getArgument(0,CooperativeMissionRoleProgress.class)); em.flush();
            throw new IllegalStateException("강제 배정 저장 실패 비공개");
        }).when(roles).save(any(CooperativeMissionRoleProgress.class));
        error(assign(data.host(),data.team(),data.card(),data.target()),500,"INTERNAL_SERVER_ERROR","서버 내부 오류가 발생했습니다.");
        assertThat(snapshot(data.team())).isEqualTo(before); assertThat(rewardSnapshot(data.host())).isEqualTo(rewards);
        reset(roles);
        assign(data.host(),data.team(),data.card(),data.target()).andExpect(status().isNoContent());
        assertThat(assignmentRows(data.team(),data.card())).hasSize(1);
        assertThat(assignmentRows(data.team(),data.card()).getFirst()).containsEntry("cooperative_mission_participant_id",data.target());
    }

    /** 첫 단계의 폴링 응답은 외부 추천 없이 현재 저장된 배정을 읽는다. */
    private ResultActions read(User user,Long team) throws Exception {
        return mvc.perform(get("/api/v2/cooperative-missions/{id}/progress",team).header("Authorization","Bearer "+tokens.createAccessToken(user).value()).param("latitude","0").param("longitude","0"));
    }
    /** 명세의 공개 오류 본문을 필드 수까지 비교한다. */
    private void error(ResultActions result,int status,String code,String message) throws Exception {
        result.andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code)).andExpect(jsonPath("$.message").value(message));
        assertThat(body(result)).containsOnlyKeys("code","message");
    }
    private record Data(User host,Long team,Long card,Long target) { }
}
