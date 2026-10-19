package com.jamkkanjeju.server.domain.cooperativemission.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 보물찾기 도메인의 오류 코드를 정의한다. */
public enum CooperativeMissionErrorCode implements ErrorCode {

    COOPERATIVE_MISSION_NOT_FOUND(HttpStatus.NOT_FOUND, "협동 미션을 찾을 수 없습니다."),
    COOPERATIVE_MISSION_INACTIVE(HttpStatus.NOT_FOUND, "비활성화된 협동 미션입니다."),
    INVALID_INVITE_TOKEN(HttpStatus.NOT_FOUND, "유효하지 않은 초대 링크입니다."),
    COOPERATIVE_MISSION_ALREADY_PARTICIPATING(HttpStatus.CONFLICT, "이미 해당 협동 미션에 참여 중입니다."),
    COOPERATIVE_MISSION_FULL(HttpStatus.CONFLICT, "협동 미션 참여 인원이 가득 찼습니다."),
    COOPERATIVE_MISSION_JOIN_CLOSED(HttpStatus.CONFLICT, "협동 미션 참여 요청이 마감되었습니다.");

    private final HttpStatus status;
    private final String message;

    /** 오류의 HTTP 상태와 메시지를 지정한다. */
    CooperativeMissionErrorCode(HttpStatus status, String message) {
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
