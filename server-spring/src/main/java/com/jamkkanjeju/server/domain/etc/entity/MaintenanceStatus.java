package com.jamkkanjeju.server.domain.etc.entity;

/** 점검 예약과 실행 결과를 구분하는 상태이다. */
public enum MaintenanceStatus {
    SCHEDULED,
    IN_PROGRESS,
    COMPLETED,
    FAILED,
    CANCELLED
}
