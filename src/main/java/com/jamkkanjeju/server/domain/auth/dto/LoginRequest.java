package com.jamkkanjeju.server.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record LoginRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 64) @Pattern(regexp = "^[!-~]+$") String password,
        @Size(max = 255) String deviceInfo
) {

    /** 이메일은 앞뒤 공백 제거 + 소문자 변환 후 검증·조회한다. 비밀번호는 변형하지 않는다. */
    public LoginRequest {
        if (email != null) {
            email = email.strip().toLowerCase(Locale.ROOT);
        }
    }
}
