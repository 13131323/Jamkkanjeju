package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static org.assertj.core.api.Assertions.assertThat;
import com.jamkkanjeju.server.domain.cooperativemission.dto.DecideCooperativeMissionParticipantRequest.Decision;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

/** 참여 요청 처리 결정의 필수 여부와 허용값을 검증한다. */
class DecideCooperativeMissionParticipantRequestTest {
    @Test
    void 두결정은_허용하고_null은_거부한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (var decision : Decision.values()) {
                assertThat(validator.validate(new DecideCooperativeMissionParticipantRequest(decision))).isEmpty();
            }
            assertThat(validator.validate(new DecideCooperativeMissionParticipantRequest(null)))
                    .singleElement().satisfies(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("decision"));
        }
    }
}
