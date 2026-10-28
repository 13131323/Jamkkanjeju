package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
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

/** 실제 JWT·HTTP·MySQL로 참여 요청 처리 계약, 데이터 격리와 실패 롤백을 검증한다. */
@Transactional
class DecideCooperativeMissionParticipantApiIntegrationTest extends CooperativeMissionIntegrationTestSupport {
    private static final String DECIDE_URL =
            "/api/v2/cooperative-missions/{cooperativeMissionProgressId}/participants/{participantId}";
    @MockitoSpyBean CooperativeMissionParticipantRepository participants;

    @Test
    void 정원6명에서도_수락하고_반복요청은_시각과_다른데이터를_유지한다() throws Exception {
        var host = user();
        var guest = user();
        var mission = mission();
        var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        var target = participant(guest, progress, ParticipantStatus.PENDING, ParticipantRole.MEMBER);
        em.persist(target);
        for (int i = 0; i < 4; i++)
            em.persist(participant(user(), progress, ParticipantStatus.ACCEPTED, ParticipantRole.MEMBER));
        roleProgress(progress);
        var other = team(host, mission(), ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        clear();
        var otherBefore = snapshot(other.getId());
        var rewards = rewardSnapshot(host);
        var teamBefore = jdbc.queryForMap("select * from cooperative_mission_progress where id=?", progress.getId());
        var othersBefore = jdbc.queryForList("select * from cooperative_mission_participant where cooperative_mission_progress_id=? and id<>? order by id",
                progress.getId(), target.getId());
        var rolesBefore = jdbc.queryForList("select * from cooperative_mission_role_progress order by cooperative_mission_participant_id,cooperative_role_card_id");

        decide(host, progress.getId(), target.getId(), "ACCEPT").andExpect(status().isNoContent())
                .andExpect(content().string(""));
        clear();
        var saved = em.find(CooperativeMissionParticipant.class, target.getId());
        assertThat(saved.getParticipantStatus()).isEqualTo(ParticipantStatus.ACCEPTED);
        assertThat(saved.getJoinedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        var after = snapshot(progress.getId());
        clear();

        decide(host, progress.getId(), target.getId(), "ACCEPT").andExpect(status().isNoContent());
        clear();
        assertThat(snapshot(progress.getId())).isEqualTo(after);
        assertThat(snapshot(other.getId())).isEqualTo(otherBefore);
        assertThat(rewardSnapshot(host)).isEqualTo(rewards);
        assertThat(jdbc.queryForMap("select * from cooperative_mission_progress where id=?", progress.getId())).isEqualTo(teamBefore);
        assertThat(jdbc.queryForList("select * from cooperative_mission_participant where cooperative_mission_progress_id=? and id<>? order by id",
                progress.getId(), target.getId())).isEqualTo(othersBefore);
        assertThat(jdbc.queryForList("select * from cooperative_mission_role_progress order by cooperative_mission_participant_id,cooperative_role_card_id"))
                .isEqualTo(rolesBefore);
    }

    @Test
    void 거절후_행삭제와_반복404_재참여시_새id를_확인한다() throws Exception {
        var data = prepare();
        clear();
        long before = participants.countByCooperativeMissionProgressId(data.progressId());
        decide(data.host(), data.progressId(), data.participantId(), "REJECT")
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        clear();
        assertThat(em.find(CooperativeMissionParticipant.class, data.participantId())).isNull();
        assertThat(participants.countByCooperativeMissionProgressId(data.progressId())).isEqualTo(before - 1);
        for (String decision : List.of("ACCEPT", "REJECT"))
            error(decide(data.host(), data.progressId(), data.participantId(), decision), 404,
                    "COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND", "협동 미션 참여 요청을 찾을 수 없습니다.");
        var response = body(join(data.guest(), data.teamToken()).andExpect(status().isCreated()));
        assertThat(((Number) response.get("participantId")).longValue()).isNotEqualTo(data.participantId());
        assertThat(response).containsEntry("participantStatus", "PENDING");
        clear();
        assertThat(participants.countByCooperativeMissionProgressId(data.progressId())).isEqualTo(before);
    }

    @Test
    void 수락된팀원은_거절하지않는다() throws Exception {
        var data = prepare();
        em.find(CooperativeMissionParticipant.class, data.participantId()).accept(JOINED_AT);
        clear();
        var before = snapshot(data.progressId());
        error(decide(data.host(), data.progressId(), data.participantId(), "REJECT"), 409,
                "COOPERATIVE_MISSION_PARTICIPANT_ALREADY_ACCEPTED", "이미 수락된 참가자는 거절할 수 없습니다.");
        clear();
        assertThat(snapshot(data.progressId())).isEqualTo(before);
    }

    @Test
    void 없는진행도와_완료진행도는_404다() throws Exception {
        var data = prepare();
        em.find(CooperativeMissionProgress.class, data.progressId()).complete(JOINED_AT);
        clear();
        var before = snapshot(data.progressId());
        for (Long id : List.of(Long.MAX_VALUE, data.progressId()))
            error(decide(data.host(), id, data.participantId(), "ACCEPT"), 404,
                    "COOPERATIVE_MISSION_PROGRESS_NOT_FOUND", "진행 중인 협동 미션을 찾을 수 없습니다.");
        clear();
        assertThat(snapshot(data.progressId())).isEqualTo(before);
    }

    @Test
    void 비활성은_방장과_대상검증보다_먼저_404다() throws Exception {
        var data = prepare();
        em.find(CooperativeMissionProgress.class, data.progressId()).getCooperativeMission()
                .changeStatus(MissionActivationStatus.INACTIVE);
        clear();
        var before = snapshot(data.progressId());
        error(decide(data.guest(), data.progressId(), Long.MAX_VALUE, "REJECT"), 404,
                "COOPERATIVE_MISSION_INACTIVE", "비활성화된 협동 미션입니다.");
        clear();
        assertThat(snapshot(data.progressId())).isEqualTo(before);
    }

    @Test
    void 팀외부사용자와_팀원과_대기방장은_403이다() throws Exception {
        var data = prepare();
        var outsider = user();
        clear();
        var before = snapshot(data.progressId());
        for (User requester : List.of(outsider, data.guest()))
            error(decide(requester, data.progressId(), data.participantId(), "ACCEPT"), 403,
                    "COOPERATIVE_MISSION_HOST_ONLY", "협동 미션 방장만 참여 요청을 처리할 수 있습니다.");
        clear();
        assertThat(snapshot(data.progressId())).isEqualTo(before);
        jdbc.update("update cooperative_mission_participant set participant_status='PENDING',joined_at=null where cooperative_mission_progress_id=? and user_id=?",
                data.progressId(), data.host().getId());
        var pendingBefore = snapshot(data.progressId());
        error(decide(data.host(), data.progressId(), data.participantId(), "ACCEPT"), 403,
                "COOPERATIVE_MISSION_HOST_ONLY", "협동 미션 방장만 참여 요청을 처리할 수 있습니다.");
        clear();
        assertThat(snapshot(data.progressId())).isEqualTo(pendingBefore);
    }

    @ParameterizedTest
    @ValueSource(ints = {2, 3})
    void 초대단계가_끝나면_수락과_거절_모두409다(int step) throws Exception {
        var data = prepare();
        var progress = em.find(CooperativeMissionProgress.class, data.progressId());
        for (int i = 1; i < step; i++) progress.moveToNextStep();
        clear();
        var before = snapshot(data.progressId());
        for (String decision : List.of("ACCEPT", "REJECT"))
            error(decide(data.host(), data.progressId(), data.participantId(), decision), 409,
                    "COOPERATIVE_MISSION_JOIN_CLOSED", "협동 미션 참여 요청이 마감되었습니다.");
        clear();
        assertThat(snapshot(data.progressId())).isEqualTo(before);
    }

    @Test
    void 없는참가자와_다른팀참가자와_방장은_대상404다() throws Exception {
        var data = prepare();
        var another = team(user(), mission(), ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        var foreign = participant(user(), another, ParticipantStatus.PENDING, ParticipantRole.MEMBER);
        em.persist(foreign);
        var hostParticipant = participants.findByCooperativeMissionProgressIdAndUserId(data.progressId(), data.host().getId()).orElseThrow();
        clear();
        var before = snapshot(data.progressId());
        var otherBefore = snapshot(another.getId());
        for (Long id : List.of(Long.MAX_VALUE, foreign.getId(), hostParticipant.getId()))
            error(decide(data.host(), data.progressId(), id, "REJECT"), 404,
                    "COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND", "협동 미션 참여 요청을 찾을 수 없습니다.");
        clear();
        assertThat(snapshot(data.progressId())).isEqualTo(before);
        assertThat(snapshot(another.getId())).isEqualTo(otherBefore);
    }

    @Test
    void 잘못된본문과_비정수경로는400_미인증은401이다() throws Exception {
        var data = prepare();
        clear();
        var before = snapshot(data.progressId());
        String bearer = "Bearer " + tokens.createAccessToken(data.host()).value();
        for (String json : List.of("{}", "{\"decision\":null}", "{\"decision\":\"OTHER\"}", "{", ""))
            error(mvc.perform(patch(DECIDE_URL, data.progressId(), data.participantId())
                    .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(json)),
                    400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        for (Object[] path : List.of(new Object[]{"bad", data.participantId()}, new Object[]{data.progressId(), "bad"}))
            error(mvc.perform(patch(DECIDE_URL, path).header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"ACCEPT\"}")),
                    400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        error(mvc.perform(patch(DECIDE_URL, data.progressId(), data.participantId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"ACCEPT\"}")),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        clear();
        assertThat(snapshot(data.progressId())).isEqualTo(before);
    }

    @Test
    void Swagger는_PATCH와_필수결정_enum과204를_노출한다() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String,Object> operation = JsonPath.read(json, "$['paths']['" + DECIDE_URL + "']['patch']");
        Map<String, Object> responses = JsonPath.read(json, "$['paths']['" + DECIDE_URL + "']['patch']['responses']");
        assertThat(responses).containsKey("204");
        Map<String,Object> schema = JsonPath.read(json, "$.components.schemas.DecideCooperativeMissionParticipantRequest");
        List<String> required = JsonPath.read(json, "$.components.schemas.DecideCooperativeMissionParticipantRequest.required");
        assertThat(required).contains("decision");
        List<String> decisions = JsonPath.read(json,
                "$.components.schemas.DecideCooperativeMissionParticipantRequest.properties.decision.enum");
        assertThat(decisions).containsExactlyInAnyOrder("ACCEPT", "REJECT");
    }

    @ParameterizedTest
    @ValueSource(strings = {"ACCEPT", "REJECT"})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 실제변경후_실패는_롤백하고_재요청은_성공한다(String decision) throws Exception {
        var data = transactions.execute(tx -> prepare());
        var before = snapshot(data.progressId());
        if (decision.equals("REJECT")) {
            doAnswer(invocation -> {
                em.remove(invocation.getArgument(0));
                em.flush();
                throw new IllegalStateException("테스트 DELETE 이후 실패");
            }).when(participants).delete(any(CooperativeMissionParticipant.class));
        } else {
            doAnswer(invocation -> {
                var target = em.find(CooperativeMissionParticipant.class, data.participantId());
                target.accept(LocalDateTime.now(CLOCK));
                em.flush();
                throw new IllegalStateException("테스트 UPDATE 이후 실패");
            }).when(participants).findByIdAndCooperativeMissionProgressId(data.participantId(), data.progressId());
        }
        try {
            error(decide(data.host(), data.progressId(), data.participantId(), decision), 500,
                    "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
            assertThat(snapshot(data.progressId())).isEqualTo(before);
        } finally {
            reset(participants);
        }
        decide(data.host(), data.progressId(), data.participantId(), decision).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where id=?",
                Long.class, data.participantId())).isEqualTo(decision.equals("ACCEPT") ? 1L : 0L);
    }

    /** 초대 단계 팀과 대기 중인 팀원 한 명을 준비한다. */
    private Data prepare() {
        var host = user();
        var guest = user();
        var progress = team(host, mission(), ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        var target = participant(guest, progress, ParticipantStatus.PENDING, ParticipantRole.MEMBER);
        em.persist(target);
        em.flush();
        return new Data(host, guest, progress.getId(), target.getId(), progress.getTeamToken());
    }

    /** 인증된 사용자의 처리 요청을 보낸다. */
    private ResultActions decide(User user, Object progressId, Object participantId, String decision) throws Exception {
        return mvc.perform(patch(DECIDE_URL, progressId, participantId)
                .header("Authorization", "Bearer " + tokens.createAccessToken(user).value())
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"" + decision + "\"}"));
    }

    /** 오류 본문의 필드와 상태·코드·메시지를 함께 검증한다. */
    private void error(ResultActions result, int statusCode, String code, String message) throws Exception {
        result.andExpect(status().is(statusCode)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
        assertThat(body(result)).containsOnlyKeys("code", "message");
    }

    private record Data(User host, User guest, Long progressId, Long participantId, String teamToken) { }
}
