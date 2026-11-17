package com.jamkkanjeju.server.domain.agent.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/** 점검 공지와 선택 시작 시각이다. 시작 시각을 생략하면 서버에서 1시간 뒤로 정한다. */
public record ScheduleMaintenanceRequest(@Size(max = 500) String message, LocalDateTime startsAt) {
    public static final String DEFAULT_MESSAGE =
            "장소 데이터 동기화를 위한 서비스 점검이 예정되어 있습니다. 점검 시간 동안 서비스 이용이 제한됩니다.";

    /** 공지 문구의 앞뒤 공백을 제거하고 지정하지 않은 문구는 기본값으로 채운다. */
    public ScheduleMaintenanceRequest {
        message = message == null || message.isBlank() ? DEFAULT_MESSAGE : message.strip();
        startsAt = startsAt == null ? null : startsAt.withNano(0);
    }
}
