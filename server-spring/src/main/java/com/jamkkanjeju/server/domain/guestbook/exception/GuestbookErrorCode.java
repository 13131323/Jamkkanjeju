package com.jamkkanjeju.server.domain.guestbook.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 방명록의 파일·장소·미션·방문 조건과 좋아요 대상 오류를 정의한다. */
public enum GuestbookErrorCode implements ErrorCode {

    GUESTBOOK_NOT_FOUND(HttpStatus.NOT_FOUND, "방명록을 찾을 수 없습니다."),
    GUESTBOOK_INACTIVE(HttpStatus.NOT_FOUND, "비활성화된 방명록입니다."),
    INVALID_IMAGE_FORMAT(HttpStatus.BAD_REQUEST, "지원하지 않는 이미지 형식입니다."),
    IMAGE_SIZE_EXCEEDED(HttpStatus.BAD_REQUEST, "이미지 파일은 10MB를 초과할 수 없습니다."),
    INVALID_IMAGE(HttpStatus.BAD_REQUEST, "손상되었거나 올바르지 않은 이미지 파일입니다."),
    INVALID_AUDIO_FORMAT(HttpStatus.BAD_REQUEST, "지원하지 않는 오디오 형식입니다."),
    AUDIO_SIZE_EXCEEDED(HttpStatus.BAD_REQUEST, "오디오 파일은 10MB를 초과할 수 없습니다."),
    AUDIO_DURATION_EXCEEDED(HttpStatus.BAD_REQUEST, "오디오 재생 시간은 30초를 초과할 수 없습니다."),
    INVALID_AUDIO(HttpStatus.BAD_REQUEST, "손상되었거나 올바르지 않은 오디오 파일입니다."),
    LOCATION_NOT_FOUND(HttpStatus.NOT_FOUND, "장소를 찾을 수 없습니다."),
    MISSION_NOT_FOUND(HttpStatus.NOT_FOUND, "미션을 찾을 수 없습니다."),
    MISSION_INACTIVE(HttpStatus.NOT_FOUND, "비활성화된 미션입니다."),
    LOCATION_NOT_VISITED(HttpStatus.CONFLICT, "방문한 장소에만 방명록을 작성할 수 있습니다.");

    private final HttpStatus status;
    private final String message;

    /** 오류의 HTTP 상태와 메시지를 지정한다. */
    GuestbookErrorCode(HttpStatus status, String message) {
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
