package com.jamkkanjeju.server.domain.treasurehunt.dto;

import jakarta.validation.constraints.NotNull;

/** 보물찾기 진행도 저장 요청 본문. 프론트에서 발견한 보물 번호를 담는다. */
public record SaveTreasureMissionProgressRequest(
        @NotNull Integer treasureIndex
) {
}
