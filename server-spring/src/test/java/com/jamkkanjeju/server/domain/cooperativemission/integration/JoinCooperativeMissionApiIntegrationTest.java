package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.participant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 실제 인증·HTTP·JPA로 URL 참여 요청의 응답, 저장, 오류와 롤백을 검증한다. */
@Transactional
class JoinCooperativeMissionApiIntegrationTest extends CooperativeMissionIntegrationTestSupport {
    @MockitoSpyBean CooperativeMissionParticipantRepository participants;

    @Test
    void 신규는_201로_PENDING팀원을_만들고_반복과_방장링크는_기존정보를_200으로_반환한다() throws Exception {
        var host = user();
        var guest = user();
        var mission = mission();
        var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        clear();

        Map<String, Object> first = body(join(guest, progress.getTeamToken()).andExpect(status().isCreated()));
        assertThat(first).containsOnlyKeys("cooperativeMissionProgressId", "participantId", "participantStatus");
        assertThat(first).containsEntry("cooperativeMissionProgressId", progress.getId().intValue())
                .containsEntry("participantStatus", "PENDING");
        long guestParticipantId = ((Number) first.get("participantId")).longValue();
        clear();
        var afterFirst = snapshot(progress.getId());

        assertThat(body(join(guest, progress.getTeamToken()).andExpect(status().isOk()))).isEqualTo(first);
        Map<String, Object> hostResponse = body(join(host, progress.getTeamToken()).andExpect(status().isOk()));
        clear();

        assertThat(snapshot(progress.getId())).isEqualTo(afterFirst);
        assertThat(hostResponse).containsEntry("cooperativeMissionProgressId", progress.getId().intValue())
                .containsEntry("participantStatus", "ACCEPTED");
        assertThat(((Number) hostResponse.get("participantId")).longValue()).isNotEqualTo(guestParticipantId);
        Map<String, Object> guestRow = jdbc.queryForMap("select * from cooperative_mission_participant where id=?",
                guestParticipantId);
        assertThat(guestRow).containsEntry("user_id", guest.getId())
                .containsEntry("participant_status", "PENDING")
                .containsEntry("participant_role", "MEMBER")
                .containsEntry("joined_at", null);
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=?",
                Long.class, progress.getId())).isEqualTo(2L);
    }

    @ParameterizedTest
    @EnumSource(ParticipantStatus.class)
    void 같은미션의_다른_진행중팀에_참가중이면_409다(ParticipantStatus status) throws Exception {
        var host = user();
        var guest = user();
        var mission = mission();
        var target = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        var another = team(guest, mission, status, ParticipantRole.MEMBER, 1, false);
        clear();
        var targetBefore = snapshot(target.getId());
        var anotherBefore = snapshot(another.getId());

        error(join(guest, target.getTeamToken()), 409, "COOPERATIVE_MISSION_ALREADY_PARTICIPATING",
                "이미 해당 협동 미션에 참여 중입니다.");
        clear();

        assertThat(snapshot(target.getId())).isEqualTo(targetBefore);
        assertThat(snapshot(another.getId())).isEqualTo(anotherBefore);
    }

    @Test
    void 완료된_같은미션과_진행중인_다른미션_참가는_신규요청을_막지않는다() throws Exception {
        var host = user();
        var guest = user();
        var mission = mission();
        var target = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        team(guest, mission, ParticipantStatus.ACCEPTED, ParticipantRole.MEMBER, 2, true);
        team(guest, mission(), ParticipantStatus.PENDING, ParticipantRole.MEMBER, 1, false);
        clear();

        join(guest, target.getTeamToken()).andExpect(status().isCreated())
                .andExpect(jsonPath("$.participantStatus").value("PENDING"));
        clear();

        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=? and user_id=?",
                Long.class, target.getId(), guest.getId())).isEqualTo(1L);
    }

    @ParameterizedTest
    @ValueSource(ints = {2, 3})
    void 첫단계를_지난_팀은_신규참여를_받지않는다(int step) throws Exception {
        var host = user();
        var guest = user();
        var mission = mission();
        var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, step, false);
        clear();
        var before = snapshot(progress.getId());

        error(join(guest, progress.getTeamToken()), 409, "COOPERATIVE_MISSION_JOIN_CLOSED",
                "협동 미션 참여 요청이 마감되었습니다.");
        clear();

        assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @Test
    void 방장포함_6명인_팀은_신규참여를_받지않는다() throws Exception {
        var host = user();
        var requester = user();
        var mission = mission();
        var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        for (int i = 0; i < 5; i++) {
            em.persist(participant(user(), progress, i % 2 == 0 ? ParticipantStatus.PENDING : ParticipantStatus.ACCEPTED,
                    ParticipantRole.MEMBER));
        }
        clear();
        var before = snapshot(progress.getId());

        error(join(requester, progress.getTeamToken()), 409, "COOPERATIVE_MISSION_FULL",
                "협동 미션 참여 인원이 가득 찼습니다.");
        clear();

        assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @Test
    void 요청본문_검증실패는_공통400이며_참가자를_만들지않는다() throws Exception {
        var host = user();
        var guest = user();
        var mission = mission();
        var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        clear();
        var before = snapshot(progress.getId());
        String bearer = "Bearer " + tokens.createAccessToken(guest).value();

        for (String content : List.of("{}", "{\"teamToken\":\"   \"}",
                "{\"teamToken\":\"" + "a".repeat(101) + "\"}")) {
            error(mvc.perform(post(JOIN_URL).header("Authorization", bearer)
                            .contentType(MediaType.APPLICATION_JSON).content(content)),
                    400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        clear();

        assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @Test
    void 미인증과_없는사용자_토큰은_401이며_참가자를_만들지않는다() throws Exception {
        var host = user();
        var mission = mission();
        var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        clear();
        var before = snapshot(progress.getId());
        String content = "{\"teamToken\":\"" + progress.getTeamToken() + "\"}";

        error(mvc.perform(post(JOIN_URL).contentType(MediaType.APPLICATION_JSON).content(content)),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        error(join(activeUser(Long.MAX_VALUE), progress.getTeamToken()),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @Test
    void 존재하지않거나_완료된_팀토큰은_404이며_기존데이터를_유지한다() throws Exception {
        var host = user();
        var guest = user();
        var mission = mission();
        var completed = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, true);
        clear();
        var before = snapshot(completed.getId());

        error(join(guest, "missing-team-token"), 404, "INVALID_INVITE_TOKEN", "유효하지 않은 초대 링크입니다.");
        error(join(guest, completed.getTeamToken()), 404, "INVALID_INVITE_TOKEN", "유효하지 않은 초대 링크입니다.");
        clear();

        assertThat(snapshot(completed.getId())).isEqualTo(before);
    }

    @Test
    void 비활성미션은_기존참가자도_404이며_팀을_유지한다() throws Exception {
        var host = user();
        var mission = mission();
        var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        clear();
        var before = snapshot(progress.getId());

        error(join(host, progress.getTeamToken()), 404, "COOPERATIVE_MISSION_INACTIVE",
                "비활성화된 협동 미션입니다.");
        clear();

        assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @Test
    void Swagger는_인증필요_요청과_공개응답필드만_노출한다() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> operation = JsonPath.read(json, "$['paths']['" + JOIN_URL + "']['post']");
        assertThat(operation).containsKey("requestBody");
        List<Map<String, Object>> security = JsonPath.read(json, "$.security");
        assertThat(security).anySatisfy(requirement -> assertThat(requirement).containsKey("bearerAuth"));
        Map<String, Object> requestProperties = JsonPath.read(json,
                "$.components.schemas.JoinCooperativeMissionRequest.properties");
        assertThat(requestProperties).containsOnlyKeys("teamToken");
        Map<String, Object> responseProperties = JsonPath.read(json,
                "$.components.schemas.JoinCooperativeMissionResponse.properties");
        assertThat(responseProperties).containsOnlyKeys(
                "cooperativeMissionProgressId", "participantId", "participantStatus");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 참가자_저장후_실패하면_롤백하고_재요청으로_잠금해제를_확인한다() throws Exception {
        var data = transactions.execute(tx -> {
            var host = user();
            var guest = user();
            var mission = mission();
            var progress = team(host, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, 1, false);
            em.flush();
            return new Committed(guest, progress.getId(), progress.getTeamToken());
        });
        var before = snapshot(data.progressId());
        doAnswer(invocation -> {
            CooperativeMissionParticipant saved = invocation.getArgument(0);
            em.persist(saved);
            em.flush();
            throw new IllegalStateException("테스트 참가자 저장 후 실패");
        }).when(participants).save(any(CooperativeMissionParticipant.class));
        try {
            error(join(data.guest(), data.teamToken()), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
            assertThat(snapshot(data.progressId())).isEqualTo(before);
        } finally {
            reset(participants);
        }

        join(data.guest(), data.teamToken()).andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=?",
                Long.class, data.progressId())).isEqualTo(2L);
    }

    /** 오류 응답이 명세의 상태·코드·메시지와 일치하는지 확인한다. */
    private void error(org.springframework.test.web.servlet.ResultActions result, int statusCode,
                       String code, String message) throws Exception {
        result.andExpect(status().is(statusCode)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
        assertThat(body(result)).containsOnlyKeys("code", "message");
    }

    /** 실제 롤백을 확인할 커밋된 사용자와 팀 식별자이다. */
    private record Committed(User guest, Long progressId, String teamToken) { }
}
