package com.jamkkanjeju.server.domain.mypage.exception;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 마이페이지 엽서 생성의 선택·이미지·포인트·활성화 오류이다. */
public enum MyPageErrorCode implements ErrorCode {
    TRAVEL_ENDING_SELECTION_TOO_FEW(HttpStatus.BAD_REQUEST, "방문한 곳과 미션은 각각 최소 1개씩 선택해야 합니다."),
    TRAVEL_ENDING_SELECTION_TOO_MANY(HttpStatus.BAD_REQUEST, "방문한 곳과 미션은 각각 최대 3개 선택할 수 있습니다."),
    INVALID_IMAGE_FORMAT(HttpStatus.BAD_REQUEST, "지원하지 않는 이미지 형식입니다."),
    IMAGE_SIZE_EXCEEDED(HttpStatus.BAD_REQUEST, "이미지 파일은 10MB를 초과할 수 없습니다."),
    INVALID_IMAGE(HttpStatus.BAD_REQUEST, "손상되었거나 올바르지 않은 이미지 파일입니다."),
    INSUFFICIENT_POINT(HttpStatus.CONFLICT, "엽서 생성에 필요한 포인트가 부족합니다."),
    TRAVEL_ENDING_DISABLED(HttpStatus.SERVICE_UNAVAILABLE, "기능이 활성화되지 않았습니다.");

    private final HttpStatus status;
    private final String message;

    MyPageErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    @Override public HttpStatus status() { return status; }
    @Override public String code() { return name(); }
    @Override public String message() { return message; }
}
