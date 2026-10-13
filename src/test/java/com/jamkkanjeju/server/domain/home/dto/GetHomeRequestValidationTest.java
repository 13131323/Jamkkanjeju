package com.jamkkanjeju.server.domain.home.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class GetHomeRequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void 유효한_위도_경도와_0을_허용한다() {
        assertThat(validator.validate(new GetHomeRequest(33.5572, 126.7591))).isEmpty();
        assertThat(validator.validate(new GetHomeRequest(0.0, 0.0))).isEmpty();
    }

    @Test
    void 위도나_경도가_없으면_거부한다() {
        assertThat(validator.validateProperty(new GetHomeRequest(null, 126.7591), "latitude")).isNotEmpty();
        assertThat(validator.validateProperty(new GetHomeRequest(33.5572, null), "longitude")).isNotEmpty();
    }

    @Test
    void 위도_마이너스90과_90_경도_마이너스180과_180을_허용한다() {
        List<GetHomeRequest> boundaries = List.of(
                new GetHomeRequest(-90.0, 0.0),
                new GetHomeRequest(90.0, 0.0),
                new GetHomeRequest(0.0, -180.0),
                new GetHomeRequest(0.0, 180.0));

        for (GetHomeRequest request : boundaries) {
            assertThat(validator.validate(request)).isEmpty();
        }
    }

    @Test
    void 허용_범위를_벗어난_위도와_경도를_거부한다() {
        assertThat(validator.validateProperty(new GetHomeRequest(-90.0001, 0.0), "latitude")).isNotEmpty();
        assertThat(validator.validateProperty(new GetHomeRequest(90.0001, 0.0), "latitude")).isNotEmpty();
        assertThat(validator.validateProperty(new GetHomeRequest(0.0, -180.0001), "longitude")).isNotEmpty();
        assertThat(validator.validateProperty(new GetHomeRequest(0.0, 180.0001), "longitude")).isNotEmpty();
    }
}
