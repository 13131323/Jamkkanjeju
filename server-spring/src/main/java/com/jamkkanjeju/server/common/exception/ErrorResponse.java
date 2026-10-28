package com.jamkkanjeju.server.common.exception;

/** 모든 오류 응답이 공통으로 쓰는 응답 본문이다. */
public record ErrorResponse(String code, String message) {

    /** 오류 코드로 오류 응답 본문을 만든다. */
    public static ErrorResponse of(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.code(), errorCode.message());
    }
}
