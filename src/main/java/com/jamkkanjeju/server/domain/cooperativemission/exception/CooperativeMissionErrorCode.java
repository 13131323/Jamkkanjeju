package com.jamkkanjeju.server.domain.cooperativemission.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 협동 미션 도메인의 오류 코드를 정의한다. */
public enum CooperativeMissionErrorCode implements ErrorCode {

    COOPERATIVE_MISSION_NOT_FOUND(HttpStatus.NOT_FOUND, "협동 미션을 찾을 수 없습니다."),
    COOPERATIVE_MISSION_INACTIVE(HttpStatus.NOT_FOUND, "비활성화된 협동 미션입니다."),
    INVALID_INVITE_TOKEN(HttpStatus.NOT_FOUND, "유효하지 않은 초대 링크입니다."),
    COOPERATIVE_MISSION_ALREADY_PARTICIPATING(HttpStatus.CONFLICT, "이미 해당 협동 미션에 참여 중입니다."),
    COOPERATIVE_MISSION_FULL(HttpStatus.CONFLICT, "협동 미션 참여 인원이 가득 찼습니다."),
    COOPERATIVE_MISSION_JOIN_CLOSED(HttpStatus.CONFLICT, "협동 미션 참여 요청이 마감되었습니다."),
    COOPERATIVE_MISSION_HOST_ONLY(HttpStatus.FORBIDDEN, "협동 미션 방장만 참여 요청을 처리할 수 있습니다."),
    COOPERATIVE_MISSION_PROGRESS_NOT_FOUND(HttpStatus.NOT_FOUND, "진행 중인 협동 미션을 찾을 수 없습니다."),
    COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND(HttpStatus.NOT_FOUND, "협동 미션 참여 요청을 찾을 수 없습니다."),
    COOPERATIVE_MISSION_PARTICIPANT_ALREADY_ACCEPTED(HttpStatus.CONFLICT, "이미 수락된 참가자는 거절할 수 없습니다."),
    COOPERATIVE_MISSION_STEP_NOT_ALLOWED(HttpStatus.CONFLICT, "허용되지 않는 단계 변경 요청입니다."),
    COOPERATIVE_MISSION_PENDING_PARTICIPANT_EXISTS(HttpStatus.CONFLICT, "대기 중인 참여 요청을 모두 처리해야 합니다."),
    COOPERATIVE_PARTICIPANT_ROLE_REQUIRED(HttpStatus.CONFLICT, "모든 수락된 참가자에게 역할을 배정해야 합니다.");

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
