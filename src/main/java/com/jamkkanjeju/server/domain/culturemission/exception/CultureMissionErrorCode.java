package com.jamkkanjeju.server.domain.culturemission.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 문화 미션 도메인의 오류 코드를 정의한다. */
public enum CultureMissionErrorCode implements ErrorCode {

    CULTURE_MISSION_NOT_FOUND(HttpStatus.NOT_FOUND, "문화 미션을 찾을 수 없습니다."),
    CULTURE_MISSION_INACTIVE(HttpStatus.NOT_FOUND, "비활성화된 문화 미션입니다.");

    private final HttpStatus status;
    private final String message;

    /** 오류의 HTTP 상태와 메시지를 지정한다. */
    CultureMissionErrorCode(HttpStatus status, String message) {
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
