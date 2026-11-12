package com.jamkkanjeju.server.domain.auth.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/** 로그아웃 요청의 필수값과 토큰 원문 보존·마스킹을 검증한다. */
class LogoutRequestTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\n\t"})
    void 빈_토큰은_거부한다(String value) {
        assertThat(validator.validate(new LogoutRequest(value))).isNotEmpty();
    }

    @Test
    void 문자열은_앞뒤_공백까지_원문_그대로_유지한다() {
        LogoutRequest request = new LogoutRequest(" original-token ");
        assertThat(validator.validate(request)).isEmpty();
        assertThat(request.refreshToken()).isEqualTo(" original-token ");
    }

    @Test
    void 요청_객체를_출력해도_토큰이_노출되지_않는다() {
        assertThat(new LogoutRequest("private-token").toString()).contains("****").doesNotContain("private-token");
    }
}
