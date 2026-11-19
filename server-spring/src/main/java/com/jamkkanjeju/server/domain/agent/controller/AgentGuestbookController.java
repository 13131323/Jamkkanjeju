package com.jamkkanjeju.server.domain.agent.controller;

import com.jamkkanjeju.server.domain.agent.dto.GetAgentGuestbooksRequest;
import com.jamkkanjeju.server.domain.agent.dto.GetAgentGuestbooksResponse;
import com.jamkkanjeju.server.domain.agent.service.AgentGuestbookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 고정 토큰으로 인증된 에이전트의 방명록 조회 요청을 전달한다. */
@RestController
@RequestMapping("/api/v2/agent/guestbooks")
@RequiredArgsConstructor
@Tag(name = "agent")
public class AgentGuestbookController {
    private final AgentGuestbookService service;
    /** 감성 분석에 필요한 장소 방명록 페이지를 반환한다. */
    @GetMapping
    @Operation(summary = "에이전트 장소 방명록 조회")
    public GetAgentGuestbooksResponse getGuestbooks(@Valid @ParameterObject @ModelAttribute GetAgentGuestbooksRequest request) {
        return service.getGuestbooks(request);
    }
}
