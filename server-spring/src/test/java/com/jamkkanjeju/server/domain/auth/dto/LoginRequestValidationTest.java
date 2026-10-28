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

    @Test
    void 숫자만으로_된_비밀번호도_허용한다() {
        LoginRequest request = new LoginRequest("user@example.com", "12345678", null);

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void 비밀번호는_공백제거나_대소문자_변환_없이_그대로_둔다() {
        LoginRequest request = new LoginRequest("user@example.com", "PassWord123!", null);

        assertThat(request.password()).isEqualTo("PassWord123!");
    }

    @Test
    void 비밀번호가_없으면_거부한다() {
        LoginRequest request = new LoginRequest("user@example.com", null, null);

        assertThat(validator.validateProperty(request, "password")).isNotEmpty();
    }

    @Test
    void 이메일은_앞뒤_공백을_제거하고_소문자로_정규화한다() {
        LoginRequest request = new LoginRequest("  User@Example.COM  ", "password123!", null);

        assertThat(request.email()).isEqualTo("user@example.com");
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void 이메일이_없거나_공백뿐이면_거부한다() {
        assertThat(validator.validateProperty(new LoginRequest(null, "password123!", null), "email")).isNotEmpty();
        assertThat(validator.validateProperty(new LoginRequest("   ", "password123!", null), "email")).isNotEmpty();
    }

    @Test
    void 골뱅이가_없는_이메일을_거부한다() {
        LoginRequest request = new LoginRequest("user example.com", "password123!", null);

        assertThat(validator.validateProperty(request, "email")).isNotEmpty();
    }

    @Test
    void 도메인에_점이_없는_이메일을_거부한다() {
        LoginRequest request = new LoginRequest("user@example", "password123!", null);

        assertThat(validator.validateProperty(request, "email")).isNotEmpty();
    }

    @Test
    void 이백오십오자를_초과한_이메일을_거부한다() {
        LoginRequest request = new LoginRequest("a".repeat(250) + "@example.com", "password123!", null);

        assertThat(validator.validateProperty(request, "email")).isNotEmpty();
    }

    @Test
    void deviceInfo는_생략할_수_있고_255자까지_허용한다() {
        assertThat(validator.validate(new LoginRequest("user@example.com", "password123!", null))).isEmpty();
        assertThat(validator.validate(new LoginRequest("user@example.com", "password123!", "a".repeat(255)))).isEmpty();
    }

    @Test
    void 이백오십오자를_초과한_deviceInfo를_거부한다() {
        LoginRequest request = new LoginRequest("user@example.com", "password123!", "a".repeat(256));

        assertThat(validator.validateProperty(request, "deviceInfo")).isNotEmpty();
    }
}
