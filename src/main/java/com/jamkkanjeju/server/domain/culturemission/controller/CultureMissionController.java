package com.jamkkanjeju.server.domain.culturemission.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressLocationRequest;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressRequest;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressResponse;
import com.jamkkanjeju.server.domain.culturemission.dto.StartCultureMissionResponse;
import com.jamkkanjeju.server.domain.culturemission.service.CultureMissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 문화 미션 API 요청을 받아 서비스에 전달하는 컨트롤러이다. */
@Tag(name = "culture-mission")
@RestController
@RequestMapping("/api/v2/culture-missions")
@RequiredArgsConstructor
public class CultureMissionController {

    private final CultureMissionService cultureMissionService;

    /** 로그인한 사용자의 문화 미션을 시작하거나 이어서 하고, 풀 문제와 진행 상태를 반환한다. */
    @Operation(summary = "문화 미션 시작/이어하기")
    @PostMapping("/{missionId}/progress")
    public ResponseEntity<StartCultureMissionResponse> startCultureMission(@AuthenticationPrincipal AuthUser authUser,
                                                                           @PathVariable Long missionId) {
        StartCultureMissionResponse response = cultureMissionService.startCultureMission(authUser.userId(), missionId);
        // 진행도를 새로 만들었으면 201, 이어하기·재시작이면 200으로 응답한다.
        return ResponseEntity.status(response.created() ? HttpStatus.CREATED : HttpStatus.OK).body(response);
    }

    /** 로그인한 사용자의 퀴즈 답변과 현재 위치를 전달하고 채점 결과와 갱신된 진행 상태를 반환한다. */
    @Operation(summary = "문화 미션 진행도 저장")
    @PatchMapping("/{cultureMissionProgressId}/progress")
    public SaveCultureMissionProgressResponse saveCultureMissionProgress(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long cultureMissionProgressId,
            @Valid @ParameterObject @ModelAttribute SaveCultureMissionProgressLocationRequest location,
            @Valid @RequestBody SaveCultureMissionProgressRequest request) {
        return cultureMissionService.saveCultureMissionProgress(
                authUser.userId(), cultureMissionProgressId, location, request);
    }
}
