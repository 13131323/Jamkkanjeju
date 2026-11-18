package com.jamkkanjeju.server.common.client;

/** 사진 있음·정상 사진 없음·조회 실패를 분리하여 장애를 사진 없음으로 캐싱하지 않게 한다. */
public record TourApiImageResult(Status status, String imageUrl, boolean retryable, long retryAfterSeconds) {
    public enum Status { FOUND, NO_IMAGE, FAILED, RATE_LIMITED, DEFERRED }

    public TourApiImageResult(Status status, String imageUrl, boolean retryable) {
        this(status, imageUrl, retryable, 0);
    }

    /** 429는 개별 재시도 대신 공유 대기열의 호출 중단으로 처리한다. */
    public static TourApiImageResult rateLimited(long retryAfterSeconds) {
        return new TourApiImageResult(Status.RATE_LIMITED, null, false, Math.max(60, retryAfterSeconds));
    }

    /** 대기열 포화·호출 중단·종료는 사진 없음으로 저장하지 않는다. */
    public static TourApiImageResult deferred() {
        return new TourApiImageResult(Status.DEFERRED, null, false);
    }

    /** 정상 응답에서 찾은 사진 URL이다. */
    public static TourApiImageResult found(String url) {
        return new TourApiImageResult(Status.FOUND, url, false);
    }

    /** 정상 응답이지만 콘텐츠 또는 사진이 없는 경우이다. */
    public static TourApiImageResult noImage() {
        return new TourApiImageResult(Status.NO_IMAGE, null, false);
    }

    /** 외부 호출·응답 검증 실패이며 사진 없음과 구분한다. */
    public static TourApiImageResult failed(boolean retryable) {
        return new TourApiImageResult(Status.FAILED, null, retryable);
    }
}
