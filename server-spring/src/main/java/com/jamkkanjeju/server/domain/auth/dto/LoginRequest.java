package com.jamkkanjeju.server.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Locale;

/** 로그인 API의 요청 본문이다. */
public record LoginRequest(
        @NotBlank @Pattern(regexp = LOGIN_IDENTIFIER) @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 64) @Pattern(regexp = "^[!-~]+$") String password,
        @Size(max = 255) String deviceInfo
) {

    /** 기존 이메일 로그인과 관리자 아이디 admin을 함께 허용한다. */
    private static final String LOGIN_IDENTIFIER = "^(?:admin|[^@\\s]+@[^@\\s]+\\.[^@\\s]+)$";

    /** 로그인 요청값을 정규화한다. */
    // 이메일은 앞뒤 공백 제거 + 소문자 변환 후 검증·조회한다. 비밀번호는 변형하지 않는다.
    public LoginRequest {
        if (email != null) {
            email = email.strip().toLowerCase(Locale.ROOT);
        }
    }
}
