package com.jamkkanjeju.server.domain.map.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** 검색어 정규화와 좌표·페이지 요청의 허용 경계를 검증한다. */
class GetMapSearchRequestTest {
    static ValidatorFactory factory;
    static Validator validator;

    @BeforeAll
    static void setup() { factory = Validation.buildDefaultValidatorFactory(); validator = factory.getValidator(); }

    @AfterAll
    static void close() { factory.close(); }

    @Test
    void 앞뒤공백만_제거하고_내부공백과_기본페이지를_유지한다() {
        GetMapSearchRequest request = new GetMapSearchRequest(" \t제주  카\n", 33.0, 126.0, null, null);
        assertThat(request.keyword()).isEqualTo("제주  카");
        assertThat(request.page()).isZero();
        assertThat(request.size()).isEqualTo(20);
        assertThat(validator.validate(request)).isEmpty();
        assertThat(validator.validate(new GetMapSearchRequest("제", -90.0, -180.0, 0, 1))).isEmpty();
        assertThat(validator.validate(new GetMapSearchRequest("주", 90.0, 180.0, 2, 200))).isEmpty();
    }

    static Stream<GetMapSearchRequest> invalidRequests() {
        return Stream.of(
                new GetMapSearchRequest(null, 33.0, 126.0, 0, 20),
                new GetMapSearchRequest("", 33.0, 126.0, 0, 20),
                new GetMapSearchRequest(" \t\n", 33.0, 126.0, 0, 20),
                new GetMapSearchRequest("제", null, 126.0, 0, 20),
                new GetMapSearchRequest("제", 33.0, null, 0, 20),
                new GetMapSearchRequest("제", 33.0, 126.0, -1, 20),
                new GetMapSearchRequest("제", 33.0, 126.0, 0, 0),
                new GetMapSearchRequest("제", 33.0, 126.0, 0, -1),
                new GetMapSearchRequest("제", -90.01, 126.0, 0, 20),
                new GetMapSearchRequest("제", 90.01, 126.0, 0, 20),
                new GetMapSearchRequest("제", 33.0, -180.01, 0, 20),
                new GetMapSearchRequest("제", 33.0, 180.01, 0, 20),
                new GetMapSearchRequest("제", Double.NaN, 126.0, 0, 20),
                new GetMapSearchRequest("제", 33.0, Double.NaN, 0, 20),
                new GetMapSearchRequest("제", Double.POSITIVE_INFINITY, 126.0, 0, 20),
                new GetMapSearchRequest("제", Double.NEGATIVE_INFINITY, 126.0, 0, 20),
                new GetMapSearchRequest("제", 33.0, Double.POSITIVE_INFINITY, 0, 20),
                new GetMapSearchRequest("제", 33.0, Double.NEGATIVE_INFINITY, 0, 20));
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    void 잘못된_검색어_좌표_페이지조건은_거절한다(GetMapSearchRequest request) {
        assertThat(validator.validate(request)).isNotEmpty();
    }
}
