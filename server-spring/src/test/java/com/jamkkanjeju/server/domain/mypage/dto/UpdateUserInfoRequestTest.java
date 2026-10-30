package com.jamkkanjeju.server.domain.mypage.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.json.JsonMapper;

/** 실제 JSON 변환과 Bean Validation으로 부분 수정 계약을 검증한다. */
class UpdateUserInfoRequestTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void 생략과명시적해제를구분하고_내부상태는직렬화하지않는다() {
        var omitted = mapper.readValue("{}", UpdateUserInfoRequest.class);
        var cleared = mapper.readValue("{\"expectations\":[],\"transportation\":null,\"travelStyle\":null}", UpdateUserInfoRequest.class);
        assertThat(omitted.hasField("transportation")).isFalse();
        assertThat(cleared.hasField("transportation")).isTrue();
        assertThat(cleared.transportation()).isNull();
        assertThat(cleared.expectations()).isEmpty();
        assertThat(mapper.writeValueAsString(cleared)).doesNotContain("providedFields", "expectationsDistinct");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"nickname\":\" a \"}", "{\"nickname\":\"12345678901234567890\"}",
            "{\"targetStepCount\":1}", "{\"targetStepCount\":100000}",
            "{\"expectations\":[\"PHOTO\",\"CAFE\"],\"transportation\":\"BUS\",\"travelStyle\":\"NEAR_AROUND\"}"})
    void 경계값과선택코드를허용한다(String json) {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var request = mapper.readValue(json, UpdateUserInfoRequest.class);
            assertThat(factory.getValidator().validate(request)).isEmpty();
            if (json.contains(" a ")) assertThat(request.nickname()).isEqualTo("a");
        }
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    void 유효하지않은입력을거부한다(String json) {
        boolean rejected;
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            try {
                var request = mapper.readValue(json, UpdateUserInfoRequest.class);
                rejected = request == null || !factory.getValidator().validate(request).isEmpty();
            } catch (RuntimeException exception) {
                rejected = true;
            }
        }
        assertThat(rejected).as(json).isTrue();
    }

    static Stream<String> invalidRequests() {
        return Stream.of("{\"nickname\":null}", "{\"nickname\":\"\"}", "{\"nickname\":\"   \"}",
                "{\"nickname\":\"123456789012345678901\"}", "{\"nickname\":123}",
                "{\"expectations\":null}", "{\"expectations\":[\"PHOTO\",\"PHOTO\"]}",
                "{\"expectations\":[null]}", "{\"expectations\":[\"INVALID\"]}", "{\"expectations\":\"PHOTO\"}",
                "{\"transportation\":[\"WALK\"]}", "{\"transportation\":\"INVALID\"}",
                "{\"travelStyle\":[\"RIGHT_HERE\"]}", "{\"travelStyle\":false}",
                "{\"targetStepCount\":null}", "{\"targetStepCount\":0}", "{\"targetStepCount\":100001}",
                "{\"targetStepCount\":1.5}", "{\"targetStepCount\":\"10000\"}", "{\"targetStepCount\":true}",
                "{\"targetStepCount\":2147483648}", "{\"categories\":[]}", "{\"providedFields\":[]}",
                "{\"userType\":\"여행자\"}", "{\"characterImgUrl\":\"x\"}", "[]", "null");
    }
}
