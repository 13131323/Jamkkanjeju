package com.jamkkanjeju.server.domain.cooperativemission.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.cooperativemission.dto.DecideCooperativeMissionParticipantRequest;
import com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusRequest;
import com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusResponse;
import com.jamkkanjeju.server.domain.cooperativemission.dto.JoinCooperativeMissionRequest;
import com.jamkkanjeju.server.domain.cooperativemission.dto.JoinCooperativeMissionResponse;
import com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionProgressRequest;
import com.jamkkanjeju.server.domain.cooperativemission.dto.StartCooperativeMissionResponse;
import com.jamkkanjeju.server.domain.cooperativemission.service.CooperativeMissionService;
import com.jamkkanjeju.server.domain.cooperativemission.service.CooperativeMissionStatusService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 협동 미션 API 요청을 받아 서비스에 전달하는 컨트롤러이다. */
@Tag(name = "cooperative-mission")
@RestController
@RequestMapping("/api/v2/cooperative-missions")
@RequiredArgsConstructor
public class CooperativeMissionController {

    private final CooperativeMissionService cooperativeMissionService;
    private final CooperativeMissionStatusService cooperativeMissionStatusService;

    /** 로그인한 참가자에게 팀의 최신 상태와 완료 시 본인의 보상·다음 장소 정보를 반환한다. */
    @Operation(summary = "협동 미션 상태 조회")
    @GetMapping("/{cooperativeMissionProgressId}/progress")
    public GetCooperativeMissionStatusResponse getCooperativeMissionStatus(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long cooperativeMissionProgressId,
            @Valid @ParameterObject @ModelAttribute GetCooperativeMissionStatusRequest request) {
        return cooperativeMissionStatusService.getCooperativeMissionStatus(
                authUser.userId(), cooperativeMissionProgressId, request);
    }

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

    /** 초대 URL의 팀 토큰으로 로그인한 사용자의 협동 미션 참여를 요청한다. */
    @Operation(summary = "URL로 협동 미션 참여 요청")
    @PostMapping("/join-requests")
    public ResponseEntity<JoinCooperativeMissionResponse> joinCooperativeMission(
            @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody JoinCooperativeMissionRequest request) {
        JoinCooperativeMissionResponse response = cooperativeMissionService
                .joinCooperativeMission(authUser.userId(), request.teamToken());
        // 새 참가자를 만들었으면 201, 기존 참가자 정보를 반환하면 200으로 응답한다.
        return ResponseEntity.status(response.created() ? HttpStatus.CREATED : HttpStatus.OK).body(response);
    }

    /** 수락된 방장이 팀을 다음 단계로 변경하고 완료·보상 처리를 마치면 본문 없이 응답한다. */
    @Operation(summary = "협동 미션 진행도 저장")
    @PatchMapping("/{cooperativeMissionProgressId}/progress")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveCooperativeMissionProgress(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long cooperativeMissionProgressId,
            @Valid @RequestBody SaveCooperativeMissionProgressRequest request) {
        cooperativeMissionService.saveCooperativeMissionProgress(
                authUser.userId(), cooperativeMissionProgressId, request);
    }

    /** 방장이 지정한 팀원의 참여 요청을 수락하거나 거절하고 본문 없이 응답한다. */
    @Operation(summary = "협동 미션 참여 요청 수락/거절")
    @PatchMapping("/{cooperativeMissionProgressId}/participants/{participantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decideCooperativeMissionParticipant(
            @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long cooperativeMissionProgressId,
            @PathVariable Long participantId,
            @Valid @RequestBody DecideCooperativeMissionParticipantRequest request) {
        cooperativeMissionService.decideCooperativeMissionParticipant(
                authUser.userId(), cooperativeMissionProgressId, participantId, request.decision());
    }
}
