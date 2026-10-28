package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
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

/** 독립 HTTP 트랜잭션으로 동일 참가자의 수락·거절 경합과 반복 요청을 검증한다. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class DecideCooperativeMissionParticipantConcurrencyIntegrationTest extends CooperativeMissionIntegrationTestSupport {
    private static final String DECIDE_URL =
            "/api/v2/cooperative-missions/{cooperativeMissionProgressId}/participants/{participantId}";

    @Test
    void 수락과_거절_경합은_한쪽의_커밋결과를_따른다() throws Exception {
        var data = prepare();
        var results = concurrently(data, List.of("ACCEPT", "REJECT"));
        var accepted = results.stream().filter(r -> r.decision().equals("ACCEPT")).findFirst().orElseThrow();
        var rejected = results.stream().filter(r -> r.decision().equals("REJECT")).findFirst().orElseThrow();
        if (accepted.status() == 204) {
            assertThat(rejected.status()).isEqualTo(409);
            assertThat(rejected.code()).isEqualTo("COOPERATIVE_MISSION_PARTICIPANT_ALREADY_ACCEPTED");
            assertAccepted(data);
        } else {
            assertThat(accepted.status()).isEqualTo(404);
            assertThat(accepted.code()).isEqualTo("COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND");
            assertThat(rejected.status()).isEqualTo(204);
            assertThat(targetCount(data)).isZero();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"ACCEPT", "REJECT"})
    void 같은결정_동시요청도_중복변경하지않는다(String decision) throws Exception {
        var data = prepare();
        var results = concurrently(data, List.of(decision, decision));
        if (decision.equals("ACCEPT")) {
            assertThat(results).allSatisfy(r -> assertThat(r.status()).isEqualTo(204));
            assertAccepted(data);
        } else {
            assertThat(results).filteredOn(r -> r.status() == 204).hasSize(1);
            assertThat(results).filteredOn(r -> r.status() == 404
                    && "COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND".equals(r.code())).hasSize(1);
            assertThat(targetCount(data)).isZero();
        }
    }

    /** 팀과 대기 참가자를 별도 트랜잭션으로 커밋한다. */
    private Data prepare() {
        return transactions.execute(tx -> {
            var host = user();
            var progress = team(host, mission(), ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
            var target = participant(user(), progress, ParticipantStatus.PENDING, ParticipantRole.MEMBER);
            em.persist(target);
            em.flush();
            return new Data(progress.getId(), target.getId(), tokens.createAccessToken(host).value());
        });
    }

    /** 시작 장벽에서 요청들을 함께 실행하고 제한 시간 안에 결과를 모은다. */
    private List<Result> concurrently(Data data, List<String> decisions) throws Exception {
        var ready = new CountDownLatch(decisions.size());
        var go = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(decisions.size());
        try {
            List<Future<Result>> futures = new ArrayList<>();
            for (String decision : decisions) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!go.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("요청 장벽 시간 초과");
                    var response = mvc.perform(patch(DECIDE_URL, data.progressId(), data.participantId())
                            .header("Authorization", "Bearer " + data.token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"decision\":\"" + decision + "\"}")).andReturn().getResponse();
                    String code = response.getStatus() >= 400
                            ? JsonPath.read(response.getContentAsString(StandardCharsets.UTF_8), "$.code") : null;
                    return new Result(decision, response.getStatus(), code);
                }));
            }
            assertThat(ready.await(20, TimeUnit.SECONDS)).isTrue();
            go.countDown();
            List<Result> results = new ArrayList<>();
            for (var future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        } finally {
            go.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(30, TimeUnit.SECONDS)).isTrue();
        }
    }

    /** 처리 대상 행의 최종 개수를 확인한다. */
    private long targetCount(Data data) {
        return jdbc.queryForObject("select count(*) from cooperative_mission_participant where id=?",
                Long.class, data.participantId());
    }

    /** 수락된 한 행과 고정 합류 시각이 유지되는지 확인한다. */
    private void assertAccepted(Data data) {
        assertThat(targetCount(data)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("select participant_status from cooperative_mission_participant where id=?",
                String.class, data.participantId())).isEqualTo("ACCEPTED");
        assertThat(jdbc.queryForObject("select joined_at from cooperative_mission_participant where id=?",
                java.sql.Timestamp.class, data.participantId()).toLocalDateTime())
                .isEqualTo(java.time.LocalDateTime.now(CLOCK));
    }

    private record Data(Long progressId, Long participantId, String token) { }
    private record Result(String decision, int status, String code) { }
}
