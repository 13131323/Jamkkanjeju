package com.jamkkanjeju.server.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record LoginRequest(
        @NotBlank @Email(regexp = EMAIL_DOMAIN_WITH_DOT) @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 64) @Pattern(regexp = "^[!-~]+$") String password,
        @Size(max = 255) String deviceInfo
) {

    /** {@code @Email} 기본 검증은 {@code user@example}처럼 점 없는 도메인도 통과시키므로 도메인에 점을 요구한다. (docs/rules.md 1절) */
    private static final String EMAIL_DOMAIN_WITH_DOT = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";

    /** 이메일은 앞뒤 공백 제거 + 소문자 변환 후 검증·조회한다. 비밀번호는 변형하지 않는다. */
    public LoginRequest {
        if (email != null) {
            email = email.strip().toLowerCase(Locale.ROOT);
        }
    }
}
