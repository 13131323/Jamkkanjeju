package com.jamkkanjeju.server.domain.agent.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.jamkkanjeju.server.domain.agent.dto.ScheduleMaintenanceRequest;
import com.jamkkanjeju.server.domain.etc.entity.Maintenance;
import com.jamkkanjeju.server.domain.etc.repository.MaintenanceRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** 지정 시각과 기본 시각에 따른 예약 기간을 고정 Clock으로 검증한다. */
@ExtendWith(MockitoExtension.class)
class AgentMaintenanceServiceTest {
    @Mock MaintenanceRepository repository;
    AgentMaintenanceService service;

    @BeforeEach
    void setUp() {
        service = new AgentMaintenanceService(repository,
                Clock.fixed(Instant.parse("2026-01-31T14:30:00Z"), ZoneOffset.UTC));
        given(repository.saveAndFlush(any(Maintenance.class))).willAnswer(call -> {
            Maintenance saved = call.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 12L);
            return saved;
        });
    }

    @Test
    void 시작_시각이_없으면_KST_현재_시각_1시간_뒤에_예약한다() {
        var result = service.schedule(new ScheduleMaintenanceRequest(null, null));
        assertThat(result.startsAt()).isEqualTo(LocalDateTime.of(2026, 2, 1, 0, 30));
        assertThat(result.endsAt()).isEqualTo(LocalDateTime.of(2026, 2, 1, 1, 30));
        assertThat(result.message()).isEqualTo(ScheduleMaintenanceRequest.DEFAULT_MESSAGE);
        assertThat(result.status()).isEqualTo("SCHEDULED");
    }

    @Test
    void 지정_시각을_유지하고_1시간_뒤_종료한다() {
        var start = LocalDateTime.of(2026, 11, 17, 15, 27);
        var result = service.schedule(new ScheduleMaintenanceRequest(" 지정 공지 ", start));
        assertThat(result.startsAt()).isEqualTo(start);
        assertThat(result.endsAt()).isEqualTo(start.plusHours(1));
        assertThat(result.message()).isEqualTo("지정 공지");
        assertThat(result.maintenanceId()).isEqualTo(12L);
    }

    @Test
    void 지정_시각의_초_정밀도와_자정_경계를_유지한다() {
        var start = LocalDateTime.of(2026, 12, 31, 23, 45, 0, 123456789);
        var result = service.schedule(new ScheduleMaintenanceRequest("", start));
        assertThat(result.startsAt()).isEqualTo(start.withNano(0));
        assertThat(result.endsAt()).isEqualTo(LocalDateTime.of(2027, 1, 1, 0, 45));
    }
}
