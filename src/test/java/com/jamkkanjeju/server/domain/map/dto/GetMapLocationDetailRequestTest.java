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

/** 장소 상세 좌표와 페이징의 기본값·허용 경계를 검증한다. */
class GetMapLocationDetailRequestTest {
    static ValidatorFactory factory;
    static Validator validator;

    @BeforeAll
    static void setup() { factory = Validation.buildDefaultValidatorFactory(); validator = factory.getValidator(); }

    @AfterAll
    static void close() { factory.close(); }

    @Test
    void 생략한_페이징은_첫페이지_20건이다() {
        GetMapLocationDetailRequest request = new GetMapLocationDetailRequest(33.0, 126.0, null, null);
        assertThat(request.page()).isZero();
        assertThat(request.size()).isEqualTo(20);
        assertThat(validator.validate(request)).isEmpty();
        assertThat(validator.validate(new GetMapLocationDetailRequest(-90.0, -180.0, 0, 1))).isEmpty();
        assertThat(validator.validate(new GetMapLocationDetailRequest(90.0, 180.0, 2, 40))).isEmpty();
    }

    static Stream<GetMapLocationDetailRequest> invalidRequests() {
        return Stream.of(
                new GetMapLocationDetailRequest(null, 126.0, 0, 20),
                new GetMapLocationDetailRequest(33.0, null, 0, 20),
                new GetMapLocationDetailRequest(33.0, 126.0, -1, 20),
                new GetMapLocationDetailRequest(33.0, 126.0, 0, 0),
                new GetMapLocationDetailRequest(33.0, 126.0, 0, -1),
                new GetMapLocationDetailRequest(-90.01, 126.0, 0, 20),
                new GetMapLocationDetailRequest(90.01, 126.0, 0, 20),
                new GetMapLocationDetailRequest(33.0, -180.01, 0, 20),
                new GetMapLocationDetailRequest(33.0, 180.01, 0, 20),
                new GetMapLocationDetailRequest(Double.NaN, 126.0, 0, 20),
                new GetMapLocationDetailRequest(33.0, Double.NaN, 0, 20),
                new GetMapLocationDetailRequest(Double.POSITIVE_INFINITY, 126.0, 0, 20),
                new GetMapLocationDetailRequest(Double.NEGATIVE_INFINITY, 126.0, 0, 20),
                new GetMapLocationDetailRequest(33.0, Double.POSITIVE_INFINITY, 0, 20),
                new GetMapLocationDetailRequest(33.0, Double.NEGATIVE_INFINITY, 0, 20));
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    void 잘못된_좌표와_페이지조건은_거절한다(GetMapLocationDetailRequest request) {
        assertThat(validator.validate(request)).isNotEmpty();
    }
}
