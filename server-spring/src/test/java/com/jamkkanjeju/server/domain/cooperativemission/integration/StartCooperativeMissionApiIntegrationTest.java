package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 실제 인증·HTTP·JPA 연결과 상태 보존·저장 실패 롤백을 검증한다. */
@Transactional
class StartCooperativeMissionApiIntegrationTest extends CooperativeMissionIntegrationTestSupport {
    @MockitoSpyBean CooperativeMissionParticipantRepository participants;

    @Test
    void 장소없는_미션_최초는_201_반복은_200이며_ID와_같은_토큰을_반환한다() throws Exception {
        var user = user();
        var mission = mission();
        clear();
        var rewardsBefore = rewardSnapshot(user);
        var rolesBefore = count("cooperative_mission_role_progress");
        Map<String, Object> first = body(start(user, mission.getMissionId()).andExpect(status().isCreated()));
        assertThat(first).containsOnlyKeys("cooperativeMissionProgressId", "teamToken");
        long id = ((Number) first.get("cooperativeMissionProgressId")).longValue();
        assertThat(first.get("teamToken")).isInstanceOf(String.class).asString().matches("[A-Za-z0-9_-]{43}");
        clear();
        var before = snapshot(id);
        assertThat(body(start(user, mission.getMissionId()).andExpect(status().isOk()))).isEqualTo(first);
        clear();
        assertThat(snapshot(id)).isEqualTo(before);
        var progress = em.find(CooperativeMissionProgress.class, id);
        assertThat(progress.getCurrentStep()).isEqualTo(1);
        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progress.getCompletedAt()).isNull();
        assertThat(progress.getTeamToken()).matches("[A-Za-z0-9_-]{43}");
        assertThat(first.get("teamToken")).isEqualTo(progress.getTeamToken());
        assertThat(Base64.getUrlDecoder().decode(progress.getTeamToken())).hasSize(32);
        var rows = jdbc.queryForList("select * from cooperative_mission_participant where cooperative_mission_progress_id=?", id);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst()).containsEntry("user_id", user.getId())
                .containsEntry("participant_status", "ACCEPTED").containsEntry("participant_role", "HOST");
        assertThat(jdbc.queryForObject("select joined_at from cooperative_mission_participant where cooperative_mission_progress_id=?",
                LocalDateTime.class, id)).isEqualTo(LocalDateTime.now(CLOCK));
        assertThat(teamCount(mission.getMissionId())).isEqualTo(1);
        assertThat(rewardSnapshot(user)).isEqualTo(rewardsBefore);
        assertThat(count("cooperative_mission_role_progress")).isEqualTo(rolesBefore);
    }

    @ParameterizedTest
    @CsvSource({"PENDING,HOST", "PENDING,MEMBER", "ACCEPTED,HOST", "ACCEPTED,MEMBER"})
    void 대기와_수락_방장과_팀원_모두_기존팀_전체를_보존한다(ParticipantStatus status, ParticipantRole role) throws Exception {
        var user = user();
        var other = user();
        var mission = mission();
        var progress = team(user, mission, status, role, false);
        em.persist(participant(other, progress, ParticipantStatus.ACCEPTED, ParticipantRole.MEMBER));
        roleProgress(progress);
        clear();
        var before = snapshot(progress.getId());
        var rewardsBefore = rewardSnapshot(user);
        Map<String, Object> response = body(start(user, mission.getMissionId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.cooperativeMissionProgressId").value(progress.getId())));
        assertThat(response).containsOnlyKeys("cooperativeMissionProgressId", "teamToken");
        assertThat(response.get("teamToken")).isEqualTo(
                status == ParticipantStatus.ACCEPTED && role == ParticipantRole.HOST
                        ? progress.getTeamToken()
                        : null);
        clear();
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        assertThat(rewardSnapshot(user)).isEqualTo(rewardsBefore);
        assertThat(teamCount(mission.getMissionId())).isEqualTo(1);
    }

    @Test
    void 완료이력과_보상은_그대로_두고_새팀을_생성한다() throws Exception {
        var user = user();
        var mission = mission();
        var old = team(user, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, true);
        roleProgress(old);
        var reward = MissionRewardStatus.builder().mission(mission.getMission()).user(user).build();
        reward.grantArCharacterReward(); reward.grantPointReward(); reward.grantCouponReward();
        em.persist(reward);
        clear();
        var before = snapshot(old.getId());
        var rewardsBefore = rewardSnapshot(user);
        var response = body(start(user, mission.getMissionId()).andExpect(status().isCreated()));
        assertThat(((Number) response.get("cooperativeMissionProgressId")).longValue()).isNotEqualTo(old.getId());
        assertThat(response.get("teamToken")).isInstanceOf(String.class).asString().matches("[A-Za-z0-9_-]{43}");
        clear();
        assertThat(snapshot(old.getId())).isEqualTo(before);
        assertThat(rewardSnapshot(user)).isEqualTo(rewardsBefore);
        assertThat(teamCount(mission.getMissionId())).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "ACCEPTED"})
    void 타인팀과_다른미션_참가는_현재미션_생성을_막지_않는다(ParticipantStatus status) throws Exception {
        var user = user();
        var other = user();
        var mission = mission();
        var anotherMission = mission();
        var otherTeam = team(other, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, false);
        var anotherTeam = team(user, anotherMission, status, ParticipantRole.MEMBER, false);
        clear();
        var beforeOther = snapshot(otherTeam.getId());
        var beforeAnother = snapshot(anotherTeam.getId());
        start(user, mission.getMissionId()).andExpect(status().isCreated());
        clear();
        assertThat(snapshot(otherTeam.getId())).isEqualTo(beforeOther);
        assertThat(snapshot(anotherTeam.getId())).isEqualTo(beforeAnother);
        assertThat(teamCount(mission.getMissionId())).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where cooperative_mission_progress_id=?",
                Long.class, otherTeam.getId())).isEqualTo(1);
    }

    @Test
    void 비정수_경로는_공통400이며_변경하지_않는다() throws Exception {
        var user = user();
        var mission = mission();
        var old = team(user, mission, ParticipantStatus.PENDING, ParticipantRole.MEMBER, false);
        clear();
        var before = snapshot(old.getId());
        error(start(user, "abc"), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        assertThat(snapshot(old.getId())).isEqualTo(before);
    }

    @Test
    void 미인증과_없는사용자_토큰은_401이며_생성하지_않는다() throws Exception {
        var mission = mission();
        clear();
        long before = count("cooperative_mission_progress");
        error(mvc.perform(post(URL, mission.getMissionId())), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        error(start(activeUser(Long.MAX_VALUE), mission.getMissionId()), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        assertThat(count("cooperative_mission_progress")).isEqualTo(before);
    }

    @Test
    void 없는미션과_다른유형_ID는_같은404다() throws Exception {
        var user = user();
        var wrongType = commonMission(MissionTypeCode.CULTURE);
        clear();
        long before = count("cooperative_mission_progress");
        for (long id : List.of(Long.MAX_VALUE, wrongType.getId())) {
            error(start(user, id), 404, "COOPERATIVE_MISSION_NOT_FOUND", "협동 미션을 찾을 수 없습니다.");
        }
        assertThat(count("cooperative_mission_progress")).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 비활성은_신규와_이어하기_모두404이며_기록을_유지한다(boolean resume) throws Exception {
        var user = user();
        var mission = mission();
        var old = resume ? team(user, mission, ParticipantStatus.PENDING, ParticipantRole.MEMBER, false) : null;
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        clear();
        var before = old == null ? List.of() : snapshot(old.getId());
        long rows = teamCount(mission.getMissionId());
        error(start(user, mission.getMissionId()), 404, "COOPERATIVE_MISSION_INACTIVE", "비활성화된 협동 미션입니다.");
        clear();
        assertThat(teamCount(mission.getMissionId())).isEqualTo(rows);
        if (old != null) assertThat(snapshot(old.getId())).isEqualTo(before);
    }

    @Test
    void Swagger는_인증필요_POST와_ID_팀토큰_응답만_노출한다() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> operation = JsonPath.read(json, "$['paths']['" + URL + "']['post']");
        assertThat(operation).doesNotContainKey("requestBody");
        List<Map<String, Object>> security = JsonPath.read(json, "$.security");
        assertThat(security).anySatisfy(requirement -> assertThat(requirement).containsKey("bearerAuth"));
        Map<String, Object> properties = JsonPath.read(json, "$.components.schemas.StartCooperativeMissionResponse.properties");
        assertThat(properties).containsOnlyKeys("cooperativeMissionProgressId", "teamToken");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 참가자_저장후_실패하면_전체롤백하고_재요청으로_잠금해제를_확인한다() throws Exception {
        var data = transactions.execute(tx -> {
            var user = user();
            var mission = mission();
            var old = team(user, mission, ParticipantStatus.ACCEPTED, ParticipantRole.HOST, true);
            roleProgress(old);
            var reward = MissionRewardStatus.builder().user(user).mission(mission.getMission()).build();
            reward.grantPointReward();
            em.persist(reward);
            em.flush();
            return new Committed(user, mission.getMissionId(), old.getId());
        });
        var before = snapshot(data.progressId());
        var rewardsBefore = rewardSnapshot(data.user());
        doAnswer(invocation -> {
            invocation.callRealMethod();
            em.flush();
            throw new IllegalStateException("테스트 참가자 저장 후 실패");
        }).when(participants).save(any(CooperativeMissionParticipant.class));
        try {
            error(start(data.user(), data.missionId()), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
            assertThat(teamCount(data.missionId())).isEqualTo(1);
            assertThat(snapshot(data.progressId())).isEqualTo(before);
            assertThat(rewardSnapshot(data.user())).isEqualTo(rewardsBefore);
            assertThat(jdbc.queryForObject("select count(*) from cooperative_mission_participant where user_id=?", Long.class,
                    data.user().getId())).isEqualTo(1);
        } finally {
            reset(participants);
        }
        start(data.user(), data.missionId()).andExpect(status().isCreated());
        assertThat(teamCount(data.missionId())).isEqualTo(2);
        assertThat(snapshot(data.progressId())).isEqualTo(before);
        assertThat(rewardSnapshot(data.user())).isEqualTo(rewardsBefore);
    }

    /** 오류 응답이 명세의 상태·코드·메시지와 일치하는지 확인한다. */
    private void error(org.springframework.test.web.servlet.ResultActions result, int code, String error, String message) throws Exception {
        result.andExpect(status().is(code)).andExpect(jsonPath("$.code").value(error))
                .andExpect(jsonPath("$.message").value(message));
        assertThat(body(result)).containsOnlyKeys("code", "message");
    }

    /** 실제 롤백을 확인할 커밋된 준비 데이터의 식별자이다. */
    private record Committed(User user, Long missionId, Long progressId) { }
}
