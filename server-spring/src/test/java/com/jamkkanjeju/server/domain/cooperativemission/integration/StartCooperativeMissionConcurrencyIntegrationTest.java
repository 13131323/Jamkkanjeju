package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 독립 요청과 실제 MySQL 잠금으로 동시 중복 생성 방지·사용자·미션별 생성 범위를 검증한다. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StartCooperativeMissionConcurrencyIntegrationTest extends CooperativeMissionIntegrationTestSupport {

    @ParameterizedTest
    @ValueSource(strings = {"SAME", "OTHER_MISSION", "OTHER_USER"})
    void 동시요청은_사용자와_미션_조합별로_하나의_팀만_만든다(String scenario) throws Exception {
        var requests = transactions.execute(tx -> {
            var firstUser = user();
            var firstMission = mission();
            var secondUser = scenario.equals("OTHER_USER") ? user() : firstUser;
            var secondMission = scenario.equals("OTHER_MISSION") ? mission() : firstMission;
            return List.of(new Request(tokens.createAccessToken(firstUser).value(), firstMission.getMissionId(), firstUser.getId()),
                    new Request(tokens.createAccessToken(secondUser).value(), secondMission.getMissionId(), secondUser.getId()));
        });
        int workers = scenario.equals("SAME") ? 4 : 2;
        var ready = new CountDownLatch(workers);
        var go = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(workers);
        try {
            List<Future<Result>> futures = new ArrayList<>();
            for (int i = 0; i < workers; i++) {
                Request request = requests.get(i % 2);
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!go.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("동시 시작 장벽 시간 초과");
                    var response = mvc.perform(post(URL, request.missionId())
                            .header("Authorization", "Bearer " + request.token())).andReturn().getResponse();
                    String body = response.getContentAsString(StandardCharsets.UTF_8);
                    Number id = JsonPath.read(body, "$.cooperativeMissionProgressId");
                    String teamToken = JsonPath.read(body, "$.teamToken");
                    return new Result(response.getStatus(), id.longValue(), teamToken);
                }));
            }
            assertThat(ready.await(20, TimeUnit.SECONDS)).isTrue();
            go.countDown();
            List<Result> results = new ArrayList<>();
            for (var future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            if (scenario.equals("SAME")) {
                assertThat(results).filteredOn(r -> r.status() == 201).hasSize(1);
                assertThat(results).filteredOn(r -> r.status() == 200).hasSize(workers - 1);
                assertThat(results).extracting(Result::id).containsOnly(results.getFirst().id());
                assertThat(results).extracting(Result::teamToken).containsOnly(results.getFirst().teamToken());
                assertThat(teamCount(requests.getFirst().missionId())).isEqualTo(1);
            } else {
                assertThat(results).allSatisfy(r -> assertThat(r.status()).isEqualTo(201));
                assertThat(results.get(0).id()).isNotEqualTo(results.get(1).id());
                assertThat(teamCount(requests.getFirst().missionId())).isEqualTo(scenario.equals("OTHER_USER") ? 2 : 1);
                if (scenario.equals("OTHER_MISSION")) assertThat(teamCount(requests.get(1).missionId())).isEqualTo(1);
            }
            for (int i = 0; i < workers; i++) {
                assertThat(results.get(i).teamToken()).matches("[A-Za-z0-9_-]{43}");
                var rows = jdbc.queryForList("select user_id,participant_role,participant_status from cooperative_mission_participant where cooperative_mission_progress_id=?", results.get(i).id());
                assertThat(rows).hasSize(1);
                assertThat(rows.getFirst()).containsEntry("user_id", requests.get(i % 2).userId())
                        .containsEntry("participant_role", "HOST").containsEntry("participant_status", "ACCEPTED");
            }
        } finally {
            go.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(30, TimeUnit.SECONDS)).isTrue();
        }
    }

    /** 독립 요청의 인증 정보와 대상이다. */
    private record Request(String token, Long missionId, Long userId) { }
    /** 요청별 HTTP 상태와 반환된 팀 ID이다. */
    private record Result(int status, long id, String teamToken) { }
}
