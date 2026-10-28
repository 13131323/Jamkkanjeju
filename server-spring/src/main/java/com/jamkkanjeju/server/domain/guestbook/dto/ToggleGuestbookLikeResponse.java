package com.jamkkanjeju.server.domain.guestbook.dto;

/** 좋아요를 반전한 방명록 ID와 현재 사용자의 처리 후 상태·전체 개수를 반환한다. */
public record ToggleGuestbookLikeResponse(Long guestbookId, boolean isLiked, long likeCount) {

    /** 서비스가 확정한 토글 결과와 변경 후 전체 좋아요 수를 응답으로 구성한다. */
    public static ToggleGuestbookLikeResponse of(Long guestbookId, boolean isLiked, long likeCount) {
        return new ToggleGuestbookLikeResponse(guestbookId, isLiked, likeCount);
    }
}
