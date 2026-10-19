package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

/** URL 참여 요청 팀 토큰의 정규화와 공개 길이 제약을 검증한다. */
class JoinCooperativeMissionRequestTest {

    @Test
    void 팀토큰은_앞뒤공백을_제거하고_100자까지_허용한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var trimmed = new JoinCooperativeMissionRequest("  team-token  ");
            assertThat(trimmed.teamToken()).isEqualTo("team-token");
            assertThat(validator.validate(trimmed)).isEmpty();
            assertThat(validator.validate(new JoinCooperativeMissionRequest("a".repeat(100)))).isEmpty();
        }
    }

    @Test
    void null_공백_100자초과_팀토큰은_거부한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(new JoinCooperativeMissionRequest(null))).hasSize(1);
            assertThat(validator.validate(new JoinCooperativeMissionRequest("   "))).hasSize(1);
            assertThat(validator.validate(new JoinCooperativeMissionRequest("a".repeat(101)))).hasSize(1);
        }
    }
}
