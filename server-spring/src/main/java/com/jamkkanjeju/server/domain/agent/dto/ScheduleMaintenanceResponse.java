package com.jamkkanjeju.server.domain.agent.dto;

import com.jamkkanjeju.server.domain.etc.entity.Maintenance;
import java.time.LocalDateTime;

/** 저장 완료된 점검 예약과 서버에서 계산한 일정을 반환한다. */
public record ScheduleMaintenanceResponse(
        Long maintenanceId,
        String message,
        LocalDateTime startsAt,
        LocalDateTime endsAt,
        String status
) {
    /** 저장된 점검을 엔티티 노출 없이 예약 결과로 변환한다. */
    public static ScheduleMaintenanceResponse from(Maintenance maintenance) {
        return new ScheduleMaintenanceResponse(maintenance.getId(), maintenance.getMessage(),
                maintenance.getStartsAt(), maintenance.getEndsAt(), maintenance.getStatus().name());
    }
}
