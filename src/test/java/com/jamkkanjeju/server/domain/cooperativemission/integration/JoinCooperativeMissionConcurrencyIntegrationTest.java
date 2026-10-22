package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.participant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 실제 MySQL 잠금으로 동시 정원 초과와 시작·참여 중복 관계 생성을 방지하는지 검증한다. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class JoinCooperativeMissionConcurrencyIntegrationTest extends CooperativeMissionIntegrationTestSupport {

    @Test
    void 다섯명팀에_동시요청해도_한명만_합류하고_최종6명이다() throws Exception {
        var data = transactions.execute(tx -> {
            var host = user();
            var mission = mission();
            var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
            for (int i = 0; i < 4; i++) {
                em.persist(participant(user(), progress, ParticipantStatus.ACCEPTED, ParticipantRole.MEMBER));
            }
            List<Request> requests = new ArrayList<>();
            for (int i = 0; i < 3; i++) {
                var requester = user();
                requests.add(new Request(tokens.createAccessToken(requester).value(), progress.getTeamToken()));
            }
            em.flush();
            return new CapacityData(progress.getId(), requests);
        });

        List<Result> results = concurrently(data.requests().stream()
                .map(request -> (RequestTask) () -> joinRequest(request)).toList());

        assertThat(results).filteredOn(result -> result.status() == 201).hasSize(1);
        assertThat(results).filteredOn(result -> result.status() == 409 &&
                "COOPERATIVE_MISSION_FULL".equals(result.code())).hasSize(2);
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=?",
                Long.class, data.progressId())).isEqualTo(6L);
    }

    @Test
    void 같은사용자의_동일미션_시작과_참여가_경합해도_진행중팀은_하나다() throws Exception {
        var data = transactions.execute(tx -> {
            var host = user();
            var guest = user();
            var mission = mission();
            var target = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
            em.flush();
            String token = tokens.createAccessToken(guest).value();
            return new RaceData(guest.getId(), mission.getMissionId(), target.getTeamToken(), token);
        });

        List<Result> results = concurrently(List.of(
                () -> startRequest(data.token(), data.missionId()),
                () -> joinRequest(new Request(data.token(), data.teamToken()))));

        assertThat(results).anySatisfy(result -> assertThat(result.type()).isEqualTo("START"));
        assertThat(results).anySatisfy(result -> assertThat(result.type()).isEqualTo("JOIN"));
        Result start = results.stream().filter(result -> result.type().equals("START")).findFirst().orElseThrow();
        Result join = results.stream().filter(result -> result.type().equals("JOIN")).findFirst().orElseThrow();
        if (join.status() == 201) {
            assertThat(start.status()).isEqualTo(200);
        } else {
            assertThat(join.status()).isEqualTo(409);
            assertThat(join.code()).isEqualTo("COOPERATIVE_MISSION_ALREADY_PARTICIPATING");
            assertThat(start.status()).isEqualTo(201);
        }
        assertThat(jdbc.queryForObject("""
                select count(*) from cooperative_mission_participant p
                join cooperative_mission_progress g on g.id=p.cooperative_mission_progress_id
                where p.user_id=? and g.cooperative_mission_id=? and g.mission_status='IN_PROGRESS'
                """, Long.class, data.userId(), data.missionId())).isEqualTo(1L);
    }

    /** 준비된 요청 작업을 같은 시작 장벽에서 실행하고 제한 시간 안에 결과를 모은다. */
    private List<Result> concurrently(List<RequestTask> tasks) throws Exception {
        var ready = new CountDownLatch(tasks.size());
        var go = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(tasks.size());
        try {
            List<Future<Result>> futures = new ArrayList<>();
            for (RequestTask task : tasks) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!go.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("동시 요청 장벽 시간 초과");
                    return task.execute();
                }));
            }
            assertThat(ready.await(20, TimeUnit.SECONDS)).isTrue();
            go.countDown();
            List<Result> results = new ArrayList<>();
            for (Future<Result> future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        } finally {
            go.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(30, TimeUnit.SECONDS)).isTrue();
        }
    }

    /** URL 참여 요청을 독립 HTTP 요청으로 실행한다. */
    private Result joinRequest(Request request) throws Exception {
        var response = mvc.perform(post(JOIN_URL)
                        .header("Authorization", "Bearer " + request.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamToken\":\"" + request.teamToken() + "\"}"))
                .andReturn().getResponse();
        return result("JOIN", response.getStatus(),
                response.getContentAsString(StandardCharsets.UTF_8));
    }

    /** 협동 미션 시작 요청을 독립 HTTP 요청으로 실행한다. */
    private Result startRequest(String token, Long missionId) throws Exception {
        var response = mvc.perform(post(URL, missionId)
                        .header("Authorization", "Bearer " + token))
                .andReturn().getResponse();
        return result("START", response.getStatus(),
                response.getContentAsString(StandardCharsets.UTF_8));
    }

    /** 성공 또는 오류 응답에서 검증에 필요한 값만 읽는다. */
    private Result result(String type, int status, String body) {
        String code = status >= 400 ? JsonPath.read(body, "$.code") : null;
        return new Result(type, status, code);
    }

    @FunctionalInterface
    private interface RequestTask { Result execute() throws Exception; }
    private record Request(String token, String teamToken) { }
    private record CapacityData(Long progressId, List<Request> requests) { }
    private record RaceData(Long userId, Long missionId, String teamToken, String token) { }
    private record Result(String type, int status, String code) { }
}
