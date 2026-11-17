package com.jamkkanjeju.server.domain.agent.service;

import com.jamkkanjeju.server.domain.agent.dto.ScheduleMaintenanceRequest;
import com.jamkkanjeju.server.domain.agent.dto.ScheduleMaintenanceResponse;
import com.jamkkanjeju.server.domain.etc.entity.Maintenance;
import com.jamkkanjeju.server.domain.etc.entity.MaintenanceStatus;
import com.jamkkanjeju.server.domain.etc.repository.MaintenanceRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 에이전트 요청으로 점검 일정과 공지를 예약한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AgentMaintenanceService {
    private final MaintenanceRepository maintenanceRepository;
    private final Clock clock;

    /** 지정한 시각 또는 현재 시각 1시간 뒤에 시작하고, 시작 1시간 뒤 종료 예정인 점검을 저장한다. */
    @Transactional
    public ScheduleMaintenanceResponse schedule(ScheduleMaintenanceRequest request) {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneId.of("Asia/Seoul")).withNano(0);
        LocalDateTime startsAt = request.startsAt() != null ? request.startsAt() : now.plusHours(1);
        Maintenance maintenance = maintenanceRepository.saveAndFlush(Maintenance.builder()
                .message(request.message())
                .startsAt(startsAt)
                .endsAt(startsAt.plusHours(1))
                .status(MaintenanceStatus.SCHEDULED)
                .build());
        return ScheduleMaintenanceResponse.from(maintenance);
    }
}
