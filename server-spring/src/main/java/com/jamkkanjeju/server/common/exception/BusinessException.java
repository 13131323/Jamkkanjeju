package com.jamkkanjeju.server.common.exception;

import lombok.Getter;

/** 비즈니스 규칙 위반을 {@link ErrorCode}와 함께 알리는 예외이다. */
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    /** 위반한 규칙의 오류 코드로 예외를 만든다. */
    public BusinessException(ErrorCode errorCode) {
        super(errorCode.message());      // RuntimeException이 원래 가지고 있는 예외 메시지 기능까지 정상적으로 쓰기 위해 호출
        this.errorCode = errorCode;
    }
}
