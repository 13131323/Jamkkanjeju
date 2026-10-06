package com.jamkkanjeju.server.common.exception;

import org.springframework.http.HttpStatus;

/** 특정 도메인에 속하지 않는 공통 오류 */
public enum CommonErrorCode implements ErrorCode {

    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청값이 올바르지 않습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String message;

    CommonErrorCode(HttpStatus status, String message) {
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
    }    // name은 java enum의 내장 메서드로, enum 상수의 이름을 반환. ex) INVALID_REQUEST 상수의 name()은 "INVALID_REQUEST"를 반환.

    @Override
    public String message() {
        return message;
    }
}
