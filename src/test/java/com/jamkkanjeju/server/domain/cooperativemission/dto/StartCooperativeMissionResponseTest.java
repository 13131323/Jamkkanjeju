package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.progress;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeMission;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 신규 여부와 무관하게 응답 JSON에는 팀 진행도 ID와 공개 가능한 팀 토큰만 노출되는지 검증한다. */
class StartCooperativeMissionResponseTest {
    @Test
    void 공개할_팀토큰이_있으면_ID와_토큰을_JSON으로_반환한다() {
        var response = StartCooperativeMissionResponse.of(
                progress(71L, cooperativeMission(31L, null)), "team-token", true);
        assertThat(response.cooperativeMissionProgressId()).isEqualTo(71L);
        assertThat(response.teamToken()).isEqualTo("team-token");
        assertThat(response.created()).isTrue();
        assertThat(JsonMapper.builder().build().writeValueAsString(response))
                .isEqualTo("{\"cooperativeMissionProgressId\":71,\"teamToken\":\"team-token\"}");
    }

    @Test
    void 공개할_팀토큰이_없으면_JSON에_null을_반환한다() {
        var response = StartCooperativeMissionResponse.of(
                progress(71L, cooperativeMission(31L, null)), null, false);
        assertThat(response.cooperativeMissionProgressId()).isEqualTo(71L);
        assertThat(response.teamToken()).isNull();
        assertThat(response.created()).isFalse();
        assertThat(JsonMapper.builder().build().writeValueAsString(response))
                .isEqualTo("{\"cooperativeMissionProgressId\":71,\"teamToken\":null}");
    }
}
