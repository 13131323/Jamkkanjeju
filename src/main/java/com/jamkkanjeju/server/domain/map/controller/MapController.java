package com.jamkkanjeju.server.domain.map.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.map.dto.GetClusteredMapContentsResponse;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsRequest;
import com.jamkkanjeju.server.domain.map.dto.GetMapContentsResponse;
import com.jamkkanjeju.server.domain.map.service.MapService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 지도 조회 요청을 검증하고 인증 사용자와 함께 서비스에 전달한다. */
@Tag(name = "map")
@RestController
@RequestMapping("/api/v2/map")
@RequiredArgsConstructor
public class MapController {

    private final MapService mapService;

    /** 확장 화면 범위의 장소·길바닥 방명록을 상세 또는 클러스터링용 간소 응답으로 반환한다. */
    @Operation(summary = "지도 홈 조회")
    @ApiResponse(responseCode = "200", description = "isClustered=false이면 상세 응답, true이면 간소 응답",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(oneOf = {GetMapContentsResponse.class, GetClusteredMapContentsResponse.class})))
    @GetMapping("/contents")
    public Object getMapContents(@AuthenticationPrincipal AuthUser authUser,
                                 @Valid @ParameterObject @ModelAttribute GetMapContentsRequest request) {
        return mapService.getMapContents(authUser.userId(), request);
    }
}
