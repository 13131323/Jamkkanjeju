package com.jamkkanjeju.server.domain.etc.service;

import com.jamkkanjeju.server.domain.etc.entity.MaintenanceStatus;
import com.jamkkanjeju.server.domain.etc.repository.MaintenanceRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** DB의 점검 일정을 기준으로 상태 전환과 서비스 차단 여부를 판단한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MaintenanceStateService {
    private final MaintenanceRepository maintenanceRepository;
    private final Clock clock;

    /** 요청 시에도 상태 전환을 먼저 커밋해 홈 응답과 API 차단에 같은 점검 상태를 사용한다. */
    @Transactional
    public boolean isInProgress() {
        LocalDateTime now = currentTime();
        advanceStatuses(now);
        return maintenanceRepository.existsByStatusAndStartsAtLessThanEqualAndEndsAtGreaterThan(
                MaintenanceStatus.IN_PROGRESS, now, now);
    }

    /** 요청이 없어도 예약 시작·종료를 반영하고 서버 재시작 중 지난 일정도 복구한다. */
    @Transactional
    public void advanceStatuses() {
        advanceStatuses(currentTime());
    }

    /** 종료를 먼저 처리해 이미 끝난 예약이 잠시 진행 중으로 바뀌지 않게 한다. */
    private void advanceStatuses(LocalDateTime now) {
        maintenanceRepository.updateExpiredStatus(
                List.of(MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS), MaintenanceStatus.COMPLETED, now);
        maintenanceRepository.updateStartedStatus(MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS, now);
    }

    /** 애플리케이션의 Clock을 DB와 같은 KST 시각으로 변환한다. */
    private LocalDateTime currentTime() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneId.of("Asia/Seoul"));
    }
}
