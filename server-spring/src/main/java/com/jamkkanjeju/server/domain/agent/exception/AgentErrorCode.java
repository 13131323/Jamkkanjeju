package com.jamkkanjeju.server.domain.agent.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 에이전트 변경 계획과 현재 데이터의 충돌이다. */
public enum AgentErrorCode implements ErrorCode {
    LOCATION_SYNC_CONFLICT(HttpStatus.CONFLICT,
            "동기화 계획 또는 처리 상태가 변경되었습니다. 장소를 다시 비교하고 승인해 주세요.");

    private final HttpStatus status;
    private final String message;

    AgentErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    @Override public HttpStatus status() { return status; }
    @Override public String code() { return name(); }
    @Override public String message() { return message; }
}
