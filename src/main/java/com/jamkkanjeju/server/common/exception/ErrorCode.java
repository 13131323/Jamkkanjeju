package com.jamkkanjeju.server.common.exception;

import org.springframework.http.HttpStatus;

/**
 * API 오류 응답의 code / message / HTTP 상태를 정의한다.
 * 도메인별로 {@code XxxErrorCode} enum이 이 인터페이스를 구현한다.
 */
public interface ErrorCode {

    HttpStatus status();

    String code();

    String message();
}
