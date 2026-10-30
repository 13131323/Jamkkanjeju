package com.jamkkanjeju.server.domain.etc.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 기타 도메인의 쿠폰 사용 처리 오류이다. */
public enum EtcErrorCode implements ErrorCode {
    COUPON_NOT_FOUND(HttpStatus.NOT_FOUND, "쿠폰을 찾을 수 없습니다."),
    ACQUIRED_COUPON_NOT_FOUND(HttpStatus.NOT_FOUND, "획득한 쿠폰이 아닙니다."),
    COUPON_ALREADY_USED(HttpStatus.CONFLICT, "이미 사용한 쿠폰입니다.");

    private final HttpStatus status;
    private final String message;

    EtcErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    @Override
    public HttpStatus status() { return status; }

    @Override
    public String code() { return name(); }

    @Override
    public String message() { return message; }
}
