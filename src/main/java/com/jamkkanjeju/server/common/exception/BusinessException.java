package com.jamkkanjeju.server.common.exception;

import lombok.Getter;

/** 비즈니스 규칙 위반을 나타내는 예외. {@link GlobalExceptionHandler}가 {@link ErrorCode}대로 응답한다. */
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.message());      // RuntimeException이 원래 가지고 있는 예외 메시지 기능까지 정상적으로 쓰기 위해 호출
        this.errorCode = errorCode;
    }
}
