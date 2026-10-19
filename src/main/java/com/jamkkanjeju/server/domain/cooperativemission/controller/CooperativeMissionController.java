package com.jamkkanjeju.server.domain.cooperativemission.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.cooperativemission.dto.StartCooperativeMissionResponse;
import com.jamkkanjeju.server.domain.cooperativemission.service.CooperativeMissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 협동 미션 API 요청을 받아 서비스에 전달하는 컨트롤러이다. */
@Tag(name = "cooperative-mission")
@RestController
@RequestMapping("/api/v2/cooperative-missions")
@RequiredArgsConstructor
public class CooperativeMissionController {

    private final CooperativeMissionService cooperativeMissionService;

    /** 로그인한 사용자의 협동 미션을 시작하거나 이어서 하고 팀 진행도 ID와 허용된 팀 토큰을 반환한다. */
    @Operation(summary = "협동 미션 시작/이어하기")
    @PostMapping("/{missionId}/progress")
    public ResponseEntity<StartCooperativeMissionResponse> startCooperativeMission(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long missionId) {
        StartCooperativeMissionResponse response = cooperativeMissionService
                .startCooperativeMission(authUser.userId(), missionId);
        // 새 팀을 만들었으면 201, 기존 팀을 이어가면 200으로 응답한다.
        return ResponseEntity.status(response.created() ? HttpStatus.CREATED : HttpStatus.OK).body(response);
    }
}
