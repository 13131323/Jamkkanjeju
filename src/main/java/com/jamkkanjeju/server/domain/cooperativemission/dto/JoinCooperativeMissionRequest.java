package com.jamkkanjeju.server.domain.cooperativemission.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** URL로 협동 미션에 참여를 요청할 때 초대 링크에서 추출한 팀 토큰을 담는다. */
public record JoinCooperativeMissionRequest(
        @NotBlank @Size(max = 100) String teamToken
) {

    /** 팀 토큰 앞뒤의 불필요한 공백을 제거한다. */
    public JoinCooperativeMissionRequest {
        if (teamToken != null) {
            teamToken = teamToken.trim();
        }
    }
}
