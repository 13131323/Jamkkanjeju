package com.jamkkanjeju.server.domain.auth.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class LoginRequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void 허용된_ASCII_문자로_구성된_8자_이상_비밀번호를_허용한다() {
        LoginRequest request = new LoginRequest("user@example.com", "password123!", null);

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void 여덟자_미만_비밀번호를_거부한다() {
        LoginRequest request = new LoginRequest("user@example.com", "abc1!", null);

        assertThat(validator.validateProperty(request, "password")).isNotEmpty();
    }

    @Test
    void 육십사자를_초과한_비밀번호를_거부한다() {
        LoginRequest request = new LoginRequest("user@example.com", "a".repeat(65), null);

        assertThat(validator.validateProperty(request, "password")).isNotEmpty();
    }

    @Test
    void 공백이_포함된_비밀번호를_거부한다() {
        LoginRequest request = new LoginRequest("user@example.com", "pass word1!", null);

        assertThat(validator.validateProperty(request, "password")).isNotEmpty();
    }

    @Test
    void 한글이_포함된_비밀번호를_거부한다() {
        LoginRequest request = new LoginRequest("user@example.com", "비밀번호123!", null);

        assertThat(validator.validateProperty(request, "password")).isNotEmpty();
    }

    @Test
    void 이모지가_포함된_비밀번호를_거부한다() {
        LoginRequest request = new LoginRequest("user@example.com", "password😀", null);

        assertThat(validator.validateProperty(request, "password")).isNotEmpty();
    }
}
