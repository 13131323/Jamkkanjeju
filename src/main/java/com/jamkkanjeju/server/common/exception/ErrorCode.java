package com.jamkkanjeju.server.common.exception;

import org.springframework.http.HttpStatus;

/** API 오류 응답에 쓸 오류 코드의 공통 규약이다. */
// 도메인별로 XxxErrorCode enum이 이 인터페이스를 구현한다.
public interface ErrorCode {

    /** 오류 응답의 HTTP 상태를 반환한다. */
    HttpStatus status();

    /** 오류 응답의 code 값을 반환한다. */
    String code();

    /** 오류 응답의 message 값을 반환한다. */
    String message();
}
