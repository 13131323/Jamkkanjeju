package com.jamkkanjeju.server.domain.mission.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.mission.dto.GetMissionHomeResponse;
import com.jamkkanjeju.server.domain.mission.service.MissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 미션 API 요청을 받아 서비스에 전달하는 컨트롤러이다. */
@Tag(name = "mission")
@RestController
@RequestMapping("/api/v2/missions")
@RequiredArgsConstructor
public class MissionController {

    private final MissionService missionService;

    /** 로그인한 사용자의 미션 홈 정보와 아직 지급되지 않은 보상을 조회한다. */
    @Operation(summary = "미션 홈 조회")
    @GetMapping("/{missionId}")
    public GetMissionHomeResponse getMissionHome(@AuthenticationPrincipal AuthUser authUser,
                                                 @PathVariable Long missionId) {
        return missionService.getMissionHome(authUser.userId(), missionId);
    }
}
