package com.jamkkanjeju.server.common.exception;

/** 모든 오류 응답의 공통 본문,
 * 에러 응답 JSON의 모양을 정의하는 DTO */
public record ErrorResponse(String code, String message) {

    public static ErrorResponse of(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.code(), errorCode.message());
    }
}
