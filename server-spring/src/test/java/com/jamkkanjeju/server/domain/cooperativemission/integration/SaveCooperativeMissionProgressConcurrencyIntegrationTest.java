package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 독립 요청의 팀 잠금으로 단계와 최초 완료 보상이 한 번만 반영되는지 확인한다. */
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class SaveCooperativeMissionProgressConcurrencyIntegrationTest extends CooperativeMissionIntegrationTestSupport {
    @ParameterizedTest @ValueSource(ints={2,3})
    void 같은단계_동시요청은_한번만_변경하고_지급한다(int next) throws Exception {
        var data=transactions.execute(tx -> {
            var host=user(); var mission=mission();
            var progress=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,next-1,false);
            roleProgress(progress); em.flush();
            return new Data(host.getId(),mission.getMissionId(),progress.getId(),tokens.createAccessToken(host).value());
        });
        var ready=new CountDownLatch(2); var go=new CountDownLatch(1);
        var pool=Executors.newFixedThreadPool(2);
        List<Result> results=new ArrayList<>();
        try {
            List<Future<Result>> tasks=new ArrayList<>();
            for(int i=0;i<2;i++)tasks.add(pool.submit(() -> {
                ready.countDown();
                if(!go.await(20,TimeUnit.SECONDS))throw new IllegalStateException("요청 장벽 시간 초과");
                var response=mvc.perform(patch("/api/v2/cooperative-missions/{id}/progress",data.progressId())
                        .header("Authorization","Bearer "+data.token()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentStep\":"+next+"}")).andReturn().getResponse();
                return new Result(response.getStatus(),response.getStatus()>=400
                        ? JsonPath.read(response.getContentAsString(StandardCharsets.UTF_8),"$.code") : null);
            }));
            assertThat(ready.await(20,TimeUnit.SECONDS)).isTrue(); go.countDown();
            for(var task:tasks)results.add(task.get(30,TimeUnit.SECONDS));
        } finally {
            go.countDown(); pool.shutdownNow(); assertThat(pool.awaitTermination(30,TimeUnit.SECONDS)).isTrue();
        }
        assertThat(results).filteredOn(r -> r.status()==204).hasSize(1);
        assertThat(results).filteredOn(r -> r.status()==409 && "COOPERATIVE_MISSION_STEP_NOT_ALLOWED".equals(r.code())).hasSize(1);
        assertThat(jdbc.queryForObject("select current_step from cooperative_mission_progress where id=?",Integer.class,data.progressId())).isEqualTo(next);
        assertThat(jdbc.queryForObject("select point from user where id=?",Integer.class,data.userId())).isEqualTo(next==3 ? 600 : 500);
        assertThat(jdbc.queryForObject("select mission_status from cooperative_mission_progress where id=?",String.class,data.progressId()))
                .isEqualTo(next==3 ? "COMPLETED" : "IN_PROGRESS");
        assertThat(jdbc.queryForObject("select count(*) from mission_reward_status where user_id=? and mission_id=?",Long.class,data.userId(),data.missionId()))
                .isEqualTo(next==3 ? 1L : 0L);
        assertThat(jdbc.queryForObject("select completed_at from cooperative_mission_progress where id=?",java.sql.Timestamp.class,data.progressId()))
                .isEqualTo(next==3 ? java.sql.Timestamp.valueOf(java.time.LocalDateTime.now(
                        com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.CLOCK)) : null);
    }
    private record Data(Long userId,Long missionId,Long progressId,String token) { }
    private record Result(int status,String code) { }
}
