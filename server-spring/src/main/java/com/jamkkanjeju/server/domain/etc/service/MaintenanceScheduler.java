package com.jamkkanjeju.server.domain.etc.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 에이전트 실행 여부와 무관하게 저장된 점검 일정을 처리한다. */
@Component
@RequiredArgsConstructor
public class MaintenanceScheduler {
    private final MaintenanceStateService maintenanceStateService;

    /** 1초마다 점검 시작·종료 상태만 갱신하며 장소 동기화는 실행하지 않는다. */
    @Scheduled(fixedDelay = 1000)
    public void updateMaintenanceStatus() {
        maintenanceStateService.advanceStatuses();
    }
}
