package com.jamkkanjeju.server.domain.cooperativemission.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import io.swagger.v3.oas.annotations.media.Schema;

/** 협동 미션 시작/이어하기 응답. 상태 조회에 사용할 팀 진행도 ID와 초대 가능한 방장의 팀 토큰을 담는다. */
public record StartCooperativeMissionResponse(
        Long cooperativeMissionProgressId,
        @Schema(nullable = true, description = "현재 사용자가 수락된 방장이면 팀 토큰, 그 외에는 null")
        String teamToken,
        /** 진행도를 새로 만들었는지 여부. 컨트롤러가 201/200 응답 상태를 정하는 데만 쓴다. */
        @JsonIgnore @Schema(hidden = true) boolean created
) {

    /** 시작하거나 이어갈 팀 진행도, 공개할 팀 토큰과 신규 생성 여부로 응답을 만든다. */
    public static StartCooperativeMissionResponse of(CooperativeMissionProgress progress, String teamToken,
                                                     boolean created) {
        return new StartCooperativeMissionResponse(progress.getId(), teamToken, created);
    }
}
