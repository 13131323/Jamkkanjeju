package com.jamkkanjeju.server.domain.auth.dto;

import com.jamkkanjeju.server.common.config.StrictStringDeserializer;
import jakarta.validation.constraints.NotBlank;
import tools.jackson.databind.annotation.JsonDeserialize;

/** 액세스 토큰 재발급에 사용할 리프레시 토큰 원문이다. */
public record RefreshTokenRequest(
        @NotBlank @JsonDeserialize(using = StrictStringDeserializer.class) String refreshToken
) {

    /** 요청 객체를 출력하더라도 토큰 원문은 노출하지 않는다. */
    @Override
    public String toString() {
        return "RefreshTokenRequest[refreshToken=****]";
    }
}
