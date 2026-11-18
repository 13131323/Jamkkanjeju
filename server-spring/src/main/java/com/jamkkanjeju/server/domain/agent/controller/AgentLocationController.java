package com.jamkkanjeju.server.domain.agent.controller;

import com.jamkkanjeju.server.domain.agent.dto.GetStoredLocationsRequest;
import com.jamkkanjeju.server.domain.agent.dto.GetStoredLocationsResponse;
import com.jamkkanjeju.server.domain.agent.service.AgentLocationService;
import com.jamkkanjeju.server.domain.agent.service.AgentLocationSyncService;
import com.jamkkanjeju.server.domain.agent.dto.SyncLocationsRequest;
import com.jamkkanjeju.server.domain.agent.dto.SyncLocationsResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 에이전트 전용 장소 조회 요청을 검증하고 서비스에 전달한다. */
@RestController
@RequestMapping("/api/v2/agent/locations")
@RequiredArgsConstructor
@Tag(name = "agent")
public class AgentLocationController {
    private final AgentLocationService agentLocationService;
    private final AgentLocationSyncService agentLocationSyncService;

    /** 사용자 승인을 거쳐 전달된 장소 계획을 한 번만 반영한다. */
    @Operation(summary = "에이전트 장소 동기화")
    @PostMapping("/sync")
    public SyncLocationsResponse synchronizeLocations(@RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody SyncLocationsRequest request) {
        return agentLocationSyncService.synchronize(idempotencyKey, request);
    }

    /** 고정 토큰으로 인증한 에이전트에 저장 장소 목록을 반환한다. */
    @Operation(summary = "에이전트 저장 장소 조회")
    @GetMapping
    public GetStoredLocationsResponse getStoredLocations(
            @Valid @ParameterObject @ModelAttribute GetStoredLocationsRequest request) {
        return agentLocationService.getStoredLocations(request);
    }
}
