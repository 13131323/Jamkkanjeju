package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionRoleAssignmentIntegrationSupport;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 팀 잠금으로 동시 최초 배정·담당자 변경·단계 전환이 정합성을 유지하는지 검증한다. */
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class SaveCooperativeMissionRoleAssignmentConcurrencyIntegrationTest extends CooperativeMissionRoleAssignmentIntegrationSupport {
    @ParameterizedTest @ValueSource(booleans={false,true})
    void 같은카드_동시최초배정은_담당자가달라도_한행만_남는다(boolean different) throws Exception {
        var data=prepare(false);
        var results=concurrently(List.of(() -> putAssignment(data,data.hostParticipant()),
                () -> putAssignment(data,different ? data.memberParticipant() : data.hostParticipant())));
        assertThat(results).allSatisfy(result -> assertThat(result.status()).isEqualTo(204));
        assertThat(assignmentRows(data.team(),data.card())).hasSize(1);
        assertThat(assignmentRows(data.team(),data.card()).getFirst().get("cooperative_mission_participant_id"))
                .isIn(different ? List.of(data.hostParticipant(),data.memberParticipant()) : List.of(data.hostParticipant()));
        assertTeamUnchanged(data,1);
    }

    @Test void 배정과_수행단계전환은_먼저커밋한_결과를_따른다() throws Exception {
        var data=prepare(true);
        var results=concurrently(List.of(() -> putAssignment(data,data.memberParticipant()), () -> {
            var response=mvc.perform(patch("/api/v2/cooperative-missions/{id}/progress",data.team())
                    .header("Authorization","Bearer "+data.token()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"currentStep\":2}")).andReturn().getResponse();
            return result("STEP",response);
        }));
        var assignment=results.stream().filter(r -> r.kind().equals("ASSIGN")).findFirst().orElseThrow();
        var step=results.stream().filter(r -> r.kind().equals("STEP")).findFirst().orElseThrow();
        assertThat(step.status()).isEqualTo(204);
        var rows=assignmentRows(data.team(),data.card()); assertThat(rows).hasSize(1);
        if(assignment.status()==204) {
            assertThat(rows.getFirst()).containsEntry("cooperative_mission_participant_id",data.memberParticipant());
        } else {
            assertThat(assignment.status()).isEqualTo(409); assertThat(assignment.code()).isEqualTo("COOPERATIVE_MISSION_STEP_NOT_ALLOWED");
            assertThat(rows.getFirst()).containsEntry("cooperative_mission_participant_id",data.hostParticipant());
        }
        assertTeamUnchanged(data,2);
    }

    /** 양쪽 참가자에게 다른 카드도 배정해 변경 순서와 무관하게 수행 단계 진입 조건을 갖추고 커밋한다. */
    private Data prepare(boolean transition) {
        return transactions.execute(tx -> {
            var host=user(); var memberUser=user(); var team=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
            var hostP=participantOf(team,host); var member=member(memberUser,team,ParticipantStatus.ACCEPTED); var card=trackedRoleCard();
            if(transition) {
                assignedRole(hostP,card,false);
                assignedRole(hostP,trackedRoleCard(),false);
                assignedRole(member,trackedRoleCard(),false);
            }
            em.flush(); return new Data(host.getId(),memberUser.getId(),team.getId(),card.getId(),hostP.getId(),member.getId(),tokens.createAccessToken(host).value());
        });
    }
    /** 독립 HTTP 요청으로 지정 참가자에게 역할을 배정한다. */
    private Result putAssignment(Data data,Long participant) throws Exception {
        var response=mvc.perform(put(ASSIGN_URL,data.team(),data.card()).header("Authorization","Bearer "+data.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"participantId\":"+participant+"}")).andReturn().getResponse();
        return result("ASSIGN",response);
    }
    /** 공개 오류 코드와 HTTP 상태를 수집한다. */
    private Result result(String kind,org.springframework.mock.web.MockHttpServletResponse response) throws Exception {
        return new Result(kind,response.getStatus(),response.getStatus()>=400
                ? JsonPath.read(response.getContentAsString(StandardCharsets.UTF_8),"$.code") : null);
    }
    /** 시작 장벽에서 독립 요청을 함께 실행하고 제한 시간 안에 종료한다. */
    private List<Result> concurrently(List<Callable<Result>> requests) throws Exception {
        var ready=new CountDownLatch(requests.size()); var go=new CountDownLatch(1); var pool=Executors.newFixedThreadPool(requests.size());
        try {
            List<Future<Result>> tasks=new ArrayList<>();
            for(var request:requests)tasks.add(pool.submit(() -> {
                ready.countDown(); if(!go.await(20,TimeUnit.SECONDS))throw new IllegalStateException("요청 장벽 시간 초과"); return request.call();
            }));
            assertThat(ready.await(20,TimeUnit.SECONDS)).isTrue(); go.countDown();
            List<Result> results=new ArrayList<>(); for(var task:tasks)results.add(task.get(30,TimeUnit.SECONDS)); return results;
        } finally { go.countDown(); pool.shutdownNow(); assertThat(pool.awaitTermination(30,TimeUnit.SECONDS)).isTrue(); }
    }
    /** 단계 외에 팀 상태·완료 시각·보상·참가자가 변하지 않았는지 확인한다. */
    private void assertTeamUnchanged(Data data,int expectedStep) {
        assertThat(jdbc.queryForObject("select current_step from cooperative_mission_progress where id=?",Integer.class,data.team())).isEqualTo(expectedStep);
        assertThat(jdbc.queryForObject("select mission_status from cooperative_mission_progress where id=?",String.class,data.team())).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("select completed_at from cooperative_mission_progress where id=?",java.sql.Timestamp.class,data.team())).isNull();
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=?",Long.class,data.team())).isEqualTo(2);
        for(Long user:List.of(data.host(),data.member())) {
            assertThat(jdbc.queryForObject("select point from user where id=?",Integer.class,user)).isEqualTo(500);
            assertThat(jdbc.queryForObject("select count(*) from mission_reward_status where user_id=?",Long.class,user)).isZero();
        }
    }
    private record Data(Long host,Long member,Long team,Long card,Long hostParticipant,Long memberParticipant,String token) { }
    private record Result(String kind,int status,String code) { }
}
