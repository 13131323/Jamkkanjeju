package com.jamkkanjeju.server.domain.culturemission.dto;

import static org.assertj.core.api.Assertions.assertThat;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;

/** 저장 요청의 필수값과 좌표 경계, 답변 원문 보존을 검증한다. */
class SaveCultureMissionProgressRequestValidationTest {
    static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    final Validator validator = FACTORY.getValidator();
    @AfterAll static void close() { FACTORY.close(); }

    @Test void bodyRequiresBothFieldsAndPreservesAnswer() {
        assertThat(validator.validate(new SaveCultureMissionProgressRequest(null, null))).hasSize(2);
        for (String answer : new String[]{"", " 많이 ", "AbC"}) {
            var request = new SaveCultureMissionProgressRequest(1, answer);
            assertThat(validator.validate(request)).isEmpty();
            assertThat(request.answer()).isEqualTo(answer);
        }
    }
    @Test void coordinatesAcceptInclusiveBoundsAndZero() {
        for (double latitude : new double[]{-90, 0, 90}) {
            for (double longitude : new double[]{-180, 0, 180}) {
                assertThat(validator.validate(new SaveCultureMissionProgressLocationRequest(latitude, longitude))).isEmpty();
            }
        }
    }
    @Test void coordinatesRejectMissingAndOutOfRange() {
        assertThat(validator.validate(new SaveCultureMissionProgressLocationRequest(null, null))).hasSize(2);
        for (var request : new SaveCultureMissionProgressLocationRequest[]{
                new SaveCultureMissionProgressLocationRequest(-90.01, 0.0),
                new SaveCultureMissionProgressLocationRequest(90.01, 0.0),
                new SaveCultureMissionProgressLocationRequest(0.0, -180.01),
                new SaveCultureMissionProgressLocationRequest(0.0, 180.01)}) {
            assertThat(validator.validate(request)).hasSize(1);
        }
    }
}
