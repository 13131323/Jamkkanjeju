package com.jamkkanjeju.server.domain.cooperativemission.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 단계의 필수 여부만 DTO에서 검증하고 단계 전환 판단은 서비스에 맡기는지 확인한다. */
class SaveCooperativeMissionProgressRequestTest {
    @Test void 소수와_문자열과_기타형식은_정수로_자동변환하지않는다() {
        var mapper = JsonMapper.builder().build();
        assertThat(mapper.readValue("{\"currentStep\":2}", SaveCooperativeMissionProgressRequest.class).currentStep()).isEqualTo(2);
        for (String value : new String[]{"2.5", "\"2\"", "true", "[]", "{}", "2147483648"}) {
            assertThatThrownBy(() -> mapper.readValue("{\"currentStep\":" + value + "}", SaveCooperativeMissionProgressRequest.class))
                    .isInstanceOf(tools.jackson.core.JacksonException.class);
        }
    }

    @Test void 단계는_필수이며_정수범위는_서비스가_판단한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(new SaveCooperativeMissionProgressRequest(null))).hasSize(1);
            for (int step : new int[]{Integer.MIN_VALUE, 0, 1, 2, 3, 4, Integer.MAX_VALUE}) {
                assertThat(validator.validate(new SaveCooperativeMissionProgressRequest(step))).isEmpty();
            }
        }
    }
}
