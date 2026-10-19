package com.jamkkanjeju.server.domain.treasurehunt.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 보물찾기 도메인의 오류 코드를 정의한다. */
public enum TreasureHuntErrorCode implements ErrorCode {

    TREASURE_MISSION_NOT_FOUND(HttpStatus.NOT_FOUND, "보물찾기 미션을 찾을 수 없습니다."),
    TREASURE_MISSION_INACTIVE(HttpStatus.NOT_FOUND, "비활성화된 보물찾기 미션입니다."),
    TREASURE_MISSION_PROGRESS_NOT_FOUND(HttpStatus.NOT_FOUND, "보물찾기 미션 진행도를 찾을 수 없습니다."),
    TREASURE_ITEM_NOT_FOUND(HttpStatus.NOT_FOUND, "보물찾기 아이템을 찾을 수 없습니다."),
    TREASURE_ITEM_ALREADY_FOUND(HttpStatus.CONFLICT, "이미 찾은 보물입니다."),
    INVALID_IMAGE_FORMAT(HttpStatus.BAD_REQUEST, "지원하지 않는 이미지 형식입니다."),
    IMAGE_SIZE_EXCEEDED(HttpStatus.BAD_REQUEST, "이미지 파일은 10MB를 초과할 수 없습니다."),
    INVALID_IMAGE(HttpStatus.BAD_REQUEST, "손상되었거나 올바르지 않은 이미지 파일입니다.");

    private final HttpStatus status;
    private final String message;

    /** 오류의 HTTP 상태와 메시지를 지정한다. */
    TreasureHuntErrorCode(HttpStatus status, String message) {
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
