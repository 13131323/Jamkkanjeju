package com.jamkkanjeju.server.domain.agent.controller;

import com.jamkkanjeju.server.domain.agent.dto.ScheduleMaintenanceRequest;
import com.jamkkanjeju.server.domain.agent.dto.ScheduleMaintenanceResponse;
import com.jamkkanjeju.server.domain.agent.service.AgentMaintenanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 에이전트 전용 점검 예약 요청을 검증하고 서비스에 전달한다. */
@RestController
@RequestMapping("/api/v2/agent/maintenances")
@RequiredArgsConstructor
@Tag(name = "agent")
public class AgentMaintenanceController {
    private final AgentMaintenanceService agentMaintenanceService;

    /** 고정 토큰으로 인증한 에이전트가 점검 공지와 일정을 등록한다. */
    @Operation(summary = "에이전트 점검 예약")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleMaintenanceResponse schedule(@Valid @RequestBody ScheduleMaintenanceRequest request) {
        return agentMaintenanceService.schedule(request);
    }
}
