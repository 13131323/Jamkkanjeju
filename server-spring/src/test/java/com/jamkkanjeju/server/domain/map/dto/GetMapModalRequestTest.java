package com.jamkkanjeju.server.domain.map.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** 지도 모달 요청의 필수값·유형·ID·좌표 경계를 검증한다. */
class GetMapModalRequestTest {
    static ValidatorFactory factory;
    static Validator validator;

    @BeforeAll
    static void setup() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void close() { factory.close(); }

    static Stream<Arguments> validRequests() {
        return Stream.of(
                Arguments.of("LOCATION", 1L, -90.0, -180.0),
                Arguments.of("ROAD_GUESTBOOK", Long.MAX_VALUE, 90.0, 180.0),
                Arguments.of("LOCATION", 39L, 33.4524, 126.9248));
    }

    @ParameterizedTest
    @MethodSource("validRequests")
    void 두_유형과_좌표_경계는_허용한다(String type, Long id, Double latitude, Double longitude) {
        assertThat(validator.validate(new GetMapModalRequest(type, id, latitude, longitude))).isEmpty();
    }

    static Stream<GetMapModalRequest> invalidRequests() {
        return Stream.of(
                new GetMapModalRequest(null, 1L, 33.0, 126.0),
                new GetMapModalRequest("", 1L, 33.0, 126.0),
                new GetMapModalRequest("location", 1L, 33.0, 126.0),
                new GetMapModalRequest("MISSION", 1L, 33.0, 126.0),
                new GetMapModalRequest("LOCATION", null, 33.0, 126.0),
                new GetMapModalRequest("LOCATION", 0L, 33.0, 126.0),
                new GetMapModalRequest("LOCATION", -1L, 33.0, 126.0),
                new GetMapModalRequest("LOCATION", 1L, null, 126.0),
                new GetMapModalRequest("LOCATION", 1L, 33.0, null),
                new GetMapModalRequest("LOCATION", 1L, -90.01, 126.0),
                new GetMapModalRequest("LOCATION", 1L, 90.01, 126.0),
                new GetMapModalRequest("LOCATION", 1L, 33.0, -180.01),
                new GetMapModalRequest("LOCATION", 1L, 33.0, 180.01),
                new GetMapModalRequest("LOCATION", 1L, Double.NaN, 126.0),
                new GetMapModalRequest("LOCATION", 1L, 33.0, Double.NaN),
                new GetMapModalRequest("LOCATION", 1L, Double.POSITIVE_INFINITY, 126.0),
                new GetMapModalRequest("LOCATION", 1L, Double.NEGATIVE_INFINITY, 126.0),
                new GetMapModalRequest("LOCATION", 1L, 33.0, Double.POSITIVE_INFINITY),
                new GetMapModalRequest("LOCATION", 1L, 33.0, Double.NEGATIVE_INFINITY));
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    void 필수값_유형_ID_좌표가_잘못되면_거절한다(GetMapModalRequest request) {
        assertThat(validator.validate(request)).isNotEmpty();
    }
}
