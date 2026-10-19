package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.participant;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.progress;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeMission;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.json.JsonMapper;

/** URL 참여 응답의 공개 필드와 내부 신규 생성 여부 분리를 검증한다. */
class JoinCooperativeMissionResponseTest {

    @Test
    void 진행도와_참가자정보만_JSON으로_반환한다() {
        var progress = progress(71L, cooperativeMission(31L, null));
        var participant = participant(activeUser(15L), progress, ParticipantStatus.PENDING, ParticipantRole.MEMBER);
        ReflectionTestUtils.setField(participant, "id", 81L);

        var response = JoinCooperativeMissionResponse.of(progress, participant, true);

        assertThat(response.cooperativeMissionProgressId()).isEqualTo(71L);
        assertThat(response.participantId()).isEqualTo(81L);
        assertThat(response.participantStatus()).isEqualTo("PENDING");
        assertThat(response.created()).isTrue();
        assertThat(JsonMapper.builder().build().writeValueAsString(response)).isEqualTo(
                "{\"cooperativeMissionProgressId\":71,\"participantId\":81,\"participantStatus\":\"PENDING\"}");
    }
}
