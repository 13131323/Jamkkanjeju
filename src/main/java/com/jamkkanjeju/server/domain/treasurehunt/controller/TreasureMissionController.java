package com.jamkkanjeju.server.domain.treasurehunt.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SavePictureWithCharacterRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressLocationRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.SaveTreasureMissionProgressResponse;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionLocationRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionResponse;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StopTreasureMissionLocationRequest;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StopTreasureMissionResponse;
import com.jamkkanjeju.server.domain.treasurehunt.service.TreasureMissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
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

    /** 로그인한 사용자의 보물 발견을 저장하고 갱신된 진행 상태와 이번 지급 보상을 반환한다. */
    @Operation(summary = "보물찾기 진행도 저장")
    @PatchMapping("/{treasureMissionProgressId}/progress")
    public SaveTreasureMissionProgressResponse saveTreasureMissionProgress(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long treasureMissionProgressId,
            @Valid @ParameterObject @ModelAttribute SaveTreasureMissionProgressLocationRequest location,
            @Valid @RequestBody SaveTreasureMissionProgressRequest request) {
        return treasureMissionService.saveTreasureMissionProgress(
                authUser.userId(), treasureMissionProgressId, location, request);
    }

    /** 로그인한 사용자의 보물찾기를 중단하고 완료 상태와 기존 발견 기록, 다음 장소를 반환한다. */
    @Operation(summary = "보물찾기 중단")
    @PatchMapping("/{treasureMissionProgressId}/progress/stop")
    public StopTreasureMissionResponse stopTreasureMission(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long treasureMissionProgressId,
            @Valid @ParameterObject @ModelAttribute StopTreasureMissionLocationRequest location) {
        return treasureMissionService.stopTreasureMission(authUser.userId(), treasureMissionProgressId, location);
    }

    /** 로그인한 사용자가 multipart로 보낸 AR 캐릭터 사진을 저장하고 본문 없이 완료 응답을 반환한다. */
    @Operation(summary = "AR 캐릭터와 사진 저장")
    @PostMapping(value = "/pictures-with-character", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void savePictureWithCharacter(
            @AuthenticationPrincipal AuthUser authUser,
            @Valid @ModelAttribute SavePictureWithCharacterRequest request) {
        treasureMissionService.savePictureWithCharacter(authUser.userId(), request);
    }
}
