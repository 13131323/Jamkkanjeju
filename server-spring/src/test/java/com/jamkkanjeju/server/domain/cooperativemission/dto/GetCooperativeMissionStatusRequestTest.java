package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static org.assertj.core.api.Assertions.assertThat;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

/** 상태 조회 좌표의 필수 여부와 양끝 경계를 검증한다. */
class GetCooperativeMissionStatusRequestTest {
    @Test
    void 양끝과_일반좌표는_허용한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (var request : java.util.List.of(new GetCooperativeMissionStatusRequest(-90.0, -180.0),
                    new GetCooperativeMissionStatusRequest(90.0, 180.0),
                    new GetCooperativeMissionStatusRequest(33.5, 126.5))) {
                assertThat(validator.validate(request)).isEmpty();
            }
        }
    }

    @Test
    void 누락과_범위밖은_거부한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (var request : java.util.List.of(new GetCooperativeMissionStatusRequest(null, 0.0),
                    new GetCooperativeMissionStatusRequest(0.0, null),
                    new GetCooperativeMissionStatusRequest(-90.01, 0.0),
                    new GetCooperativeMissionStatusRequest(90.01, 0.0),
                    new GetCooperativeMissionStatusRequest(0.0, -180.01),
                    new GetCooperativeMissionStatusRequest(0.0, 180.01))) {
                assertThat(validator.validate(request)).hasSize(1);
            }
        }
    }
}
