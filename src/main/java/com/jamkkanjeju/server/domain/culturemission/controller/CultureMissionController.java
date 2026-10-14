package com.jamkkanjeju.server.domain.culturemission.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.culturemission.dto.StartCultureMissionResponse;
import com.jamkkanjeju.server.domain.culturemission.service.CultureMissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 문화 미션 API 요청을 받아 서비스에 전달하는 컨트롤러이다. */
@RestController
@RequestMapping("/api/v2/culture-missions")
@RequiredArgsConstructor
public class CultureMissionController {

    private final CultureMissionService cultureMissionService;

    /** 로그인한 사용자의 문화 미션을 시작하거나 이어서 하고, 풀 문제와 진행 상태를 반환한다. */
    @PostMapping("/{missionId}/progress")
    public ResponseEntity<StartCultureMissionResponse> startCultureMission(@AuthenticationPrincipal AuthUser authUser,
                                                                           @PathVariable Long missionId) {
        StartCultureMissionResponse response = cultureMissionService.startCultureMission(authUser.userId(), missionId);
        // 진행도를 새로 만들었으면 201, 이어하기·재시작이면 200으로 응답한다.
        return ResponseEntity.status(response.created() ? HttpStatus.CREATED : HttpStatus.OK).body(response);
    }
}
