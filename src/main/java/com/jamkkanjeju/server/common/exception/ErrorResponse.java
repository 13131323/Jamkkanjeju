package com.jamkkanjeju.server.common.exception;

/** 모든 오류 응답의 공통 본문 */
public record ErrorResponse(String code, String message) {

    public static ErrorResponse of(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.code(), errorCode.message());
    }
}
