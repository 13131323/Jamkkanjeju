package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionStopIntegrationSupport;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.transaction.annotation.*;

/** 독립 중단 요청과 단계 변경이 경합해도 팀·방장·삭제 범위를 유지하는지 검증한다. */
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class StopCooperativeMissionConcurrencyIntegrationTest extends CooperativeMissionStopIntegrationSupport {
    @ParameterizedTest @ValueSource(booleans={false,true})
    void 같은참가자의_동시중단은_한번만삭제한다(boolean last) throws Exception {
        var d=transactions.execute(tx -> {
            var result=data();
            if(last) {
                em.remove(em.find(CooperativeMissionRoleProgress.class,
                        new CooperativeMissionRoleProgressId(result.member().getId(),result.memberCard().getId())));
                em.remove(result.member()); em.flush();
            }
            return result;
        });
        var caller=last ? d.host() : d.member().getUser(); var rewards=rewardSnapshot(caller).subList(0,4);
        var results=concurrently(List.of(() -> stop(caller,d.team().getId()).andReturn().getResponse(),
                () -> stop(caller,d.team().getId()).andReturn().getResponse()));
        assertThat(results).extracting(MockHttpServletResponse::getStatus).containsExactlyInAnyOrder(204,last ? 404 : 403);
        for(var response:results)if(response.getStatus()!=204)assertThat(response.getContentAsString())
                .contains(last ? "COOPERATIVE_MISSION_PROGRESS_NOT_FOUND" : "COOPERATIVE_MISSION_LEAVE_ACCESS_DENIED");
        assertThat(rewardSnapshot(caller).subList(0,4)).isEqualTo(rewards);
        if(last)assertThat(teamCount(d.team().getCooperativeMission().getMissionId())).isZero();
        else {
            assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=?",Long.class,d.team().getId())).isEqualTo(1);
            assertThat(assignmentRows(d.team().getId(),d.memberCard().getId())).isEmpty();
            assertThat(assignmentRows(d.team().getId(),d.hostCard().getId())).hasSize(1);
        }
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void 방장과팀원이_함께나가면_남은한명에게승계하거나_팀을해산한다(boolean thirdExists) throws Exception {
        var thirdId=new Long[1];
        var d=transactions.execute(tx -> {
            var result=data(); if(thirdExists)thirdId[0]=member(user(),result.team(),ParticipantStatus.ACCEPTED).getId(); return result;
        });
        var hostRewards=rewardSnapshot(d.host()).subList(0,4); var memberRewards=rewardSnapshot(d.member().getUser()).subList(0,4);
        var results=concurrently(List.of(() -> stop(d.host(),d.team().getId()).andReturn().getResponse(),
                () -> stop(d.member().getUser(),d.team().getId()).andReturn().getResponse()));
        assertThat(results).allSatisfy(r -> assertThat(r.getStatus()).isEqualTo(204));
        if(thirdExists) {
            var rows=jdbc.queryForList("select id,participant_role,participant_status from cooperative_mission_participant where cooperative_mission_progress_id=?",d.team().getId());
            assertThat(rows).hasSize(1); assertThat(rows.getFirst()).containsEntry("id",thirdId[0]).containsEntry("participant_role","HOST").containsEntry("participant_status","ACCEPTED");
            assertThat(jdbc.queryForObject("select current_step from cooperative_mission_progress where id=?",Integer.class,d.team().getId())).isEqualTo(1);
        } else assertThat(snapshot(d.team().getId())).allSatisfy(rows -> assertThat((List<?>)rows).isEmpty());
        assertThat(assignmentRows(d.team().getId(),d.hostCard().getId())).isEmpty();
        assertThat(assignmentRows(d.team().getId(),d.memberCard().getId())).isEmpty();
        assertThat(rewardSnapshot(d.host()).subList(0,4)).isEqualTo(hostRewards);
        assertThat(rewardSnapshot(d.member().getUser()).subList(0,4)).isEqualTo(memberRewards);
    }

    @Test void 팀원중단과_수행단계전환은_먼저커밋한결과를따른다() throws Exception {
        var d=transactions.execute(tx -> data()); var hostRewards=rewardSnapshot(d.host()).subList(0,4);
        var results=concurrently(List.of(() -> stop(d.member().getUser(),d.team().getId()).andReturn().getResponse(),
                () -> mvc.perform(patch("/api/v2/cooperative-missions/{id}/progress",d.team().getId())
                        .header("Authorization","Bearer "+tokens.createAccessToken(d.host()).value()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentStep\":2}")).andReturn().getResponse()));
        assertThat(results.get(1).getStatus()).isEqualTo(204);
        int stopStatus=results.getFirst().getStatus(); assertThat(stopStatus).isIn(204,409);
        assertThat(jdbc.queryForObject("select current_step from cooperative_mission_progress where id=?",Integer.class,d.team().getId())).isEqualTo(2);
        assertThat(jdbc.queryForObject("select mission_status from cooperative_mission_progress where id=?",String.class,d.team().getId())).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("select completed_at from cooperative_mission_progress where id=?",java.time.LocalDateTime.class,d.team().getId())).isNull();
        if(stopStatus==204)assertThat(assignmentRows(d.team().getId(),d.memberCard().getId())).isEmpty();
        else {
            assertThat(results.getFirst().getContentAsString()).contains("COOPERATIVE_MISSION_STEP_NOT_ALLOWED");
            assertThat(assignmentRows(d.team().getId(),d.memberCard().getId())).hasSize(1);
        }
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=?",Long.class,d.team().getId()))
                .isEqualTo(stopStatus==204 ? 1L : 2L);
        assertThat(assignmentRows(d.team().getId(),d.hostCard().getId())).hasSize(1);
        assertThat(rewardSnapshot(d.host()).subList(0,4)).isEqualTo(hostRewards);
    }

    /** 요청을 같은 시작 장벽에서 실행하고 순서가 아닌 최종 불변조건을 검증한다. */
    private List<MockHttpServletResponse> concurrently(List<Callable<MockHttpServletResponse>> requests) throws Exception {
        var ready=new CountDownLatch(requests.size()); var go=new CountDownLatch(1); var pool=Executors.newFixedThreadPool(requests.size());
        try {
            var futures=new ArrayList<Future<MockHttpServletResponse>>();
            for(var request:requests)futures.add(pool.submit(() -> {
                ready.countDown(); if(!go.await(20,TimeUnit.SECONDS))throw new IllegalStateException("동시 요청 장벽 시간 초과"); return request.call();
            }));
            assertThat(ready.await(20,TimeUnit.SECONDS)).isTrue(); go.countDown();
            var results=new ArrayList<MockHttpServletResponse>(); for(var task:futures)results.add(task.get(30,TimeUnit.SECONDS)); return results;
        } finally { go.countDown(); pool.shutdownNow(); assertThat(pool.awaitTermination(30,TimeUnit.SECONDS)).isTrue(); }
    }
}
