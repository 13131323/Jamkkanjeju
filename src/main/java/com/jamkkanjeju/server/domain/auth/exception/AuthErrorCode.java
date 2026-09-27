package com.jamkkanjeju.server.domain.auth.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public enum AuthErrorCode implements ErrorCode {

    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."),
    USER_SUSPENDED(HttpStatus.FORBIDDEN, "정지된 계정입니다."),
    USER_WITHDRAWN(HttpStatus.FORBIDDEN, "탈퇴한 계정입니다.");

    private final HttpStatus status;
    private final String message;

    AuthErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String code() {
        return name();
    }

    @Override
    public String message() {
        return message;
    }
}
