package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionStatusFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 단계별 공개 JSON과 엔티티·내부 필드 비노출을 검증한다. */
class GetCooperativeMissionStatusResponseTest {
    final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void 진행중은_상태문자열과_빈역할배열_완료필드null을_반환한다() {
        var progress = statusProgress(71L, rewardedMission(), 1);
        var participant = participant(activeUser(15L), progress, ParticipantStatus.PENDING, ParticipantRole.MEMBER);
        var response = GetCooperativeMissionStatusResponse.inProgress(progress, participant,
                List.of(participant), List.of(card(1L)), List.of(), 0, 0);
        var json = mapper.readTree(mapper.writeValueAsString(response));
        assertThat(json.get("missionProgressStatus").asText()).isEqualTo("IN_PROGRESS");
        assertThat(json.at("/currentParticipant/participantStatus").asText()).isEqualTo("PENDING");
        assertThat(json.get("roleProgresses").isArray()).isTrue();
        assertThat(json.get("roleProgresses").size()).isZero();
        assertThat(json.get("totalRoleCount").asInt()).isZero();
        assertThat(json.get("reward").isNull()).isTrue();
        assertThat(json.get("completedLocation").isNull()).isTrue();
        assertThat(json.has("teamToken")).isFalse();
    }

    @Test
    void 완료는_참가역할필드를_null로유지하고_보상객체를_반환한다() {
        var progress = statusProgress(71L, rewardedMission(), 3);
        progress.complete(JOINED_AT);
        var response = GetCooperativeMissionStatusResponse.completed(progress,
                GetCooperativeMissionStatusResponse.Reward.of(null, null, null), null);
        var json = mapper.readTree(mapper.writeValueAsString(response));
        for (String key : List.of("currentParticipant", "participants", "roleCards", "roleProgresses",
                "completedRoleCount", "totalRoleCount", "completedLocation", "nextLocation")) {
            assertThat(json.has(key)).isTrue();
            assertThat(json.get(key).isNull()).isTrue();
        }
        assertThat(json.get("reward").isObject()).isTrue();
        for (String key : List.of("arCharacter", "point", "coupon"))
            assertThat(json.get("reward").get(key).isNull()).isTrue();
    }
}
