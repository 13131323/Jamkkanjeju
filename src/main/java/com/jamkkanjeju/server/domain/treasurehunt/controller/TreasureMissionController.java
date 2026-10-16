package com.jamkkanjeju.server.domain.treasurehunt.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionLocationRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionResponse;
import com.jamkkanjeju.server.domain.treasurehunt.service.TreasureMissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 보물찾기 API 요청을 받아 서비스에 전달하는 컨트롤러이다. */
@Tag(name = "treasure-mission")
@RestController
@RequestMapping("/api/v2/treasure-missions")
@RequiredArgsConstructor
public class TreasureMissionController {

    private final TreasureMissionService treasureMissionService;

    /** 로그인한 사용자의 보물찾기를 시작하거나 이어서 하고, 보물 좌표와 발견 상태를 반환한다. */
    @Operation(summary = "보물찾기 시작/이어하기")
    @PostMapping("/{missionId}/progress")
    public ResponseEntity<StartTreasureMissionResponse> startTreasureMission(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable @Min(1) Long missionId,
            @Valid @ParameterObject @ModelAttribute StartTreasureMissionLocationRequest location) {
        StartTreasureMissionResponse response = treasureMissionService.startTreasureMission(
                authUser.userId(), missionId, location);
        // 진행도를 새로 만들었으면 201, 이어하기·재시작이면 200으로 응답한다.
        return ResponseEntity.status(response.created() ? HttpStatus.CREATED : HttpStatus.OK).body(response);
    }
}
