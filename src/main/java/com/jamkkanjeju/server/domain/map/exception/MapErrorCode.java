package com.jamkkanjeju.server.domain.map.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 지도 도메인의 오류 코드를 정의한다. */
public enum MapErrorCode implements ErrorCode {

    MAP_MODAL_TARGET_NOT_FOUND(HttpStatus.NOT_FOUND, "조회할 장소 또는 길바닥 방명록을 찾을 수 없습니다."),
    LOCATION_NOT_FOUND(HttpStatus.NOT_FOUND, "장소를 찾을 수 없습니다.");

    private final HttpStatus status;
    private final String message;

    /** 오류의 HTTP 상태와 메시지를 지정한다. */
    MapErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    /** 오류 응답의 HTTP 상태를 반환한다. */
    @Override
    public HttpStatus status() {
        return status;
    }

    /** 오류 응답의 code 값을 반환한다. */
    @Override
    public String code() {
        return name();
    }

    /** 오류 응답의 message 값을 반환한다. */
    @Override
    public String message() {
        return message;
    }
}
