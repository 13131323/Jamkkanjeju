package com.jamkkanjeju.server.domain.auth.dto;

import com.jamkkanjeju.server.common.config.StrictStringDeserializer;
import jakarta.validation.constraints.NotBlank;
import tools.jackson.databind.annotation.JsonDeserialize;

/** 현재 기기의 로그아웃에 사용할 리프레시 토큰 원문이다. */
public record LogoutRequest(
        @NotBlank @JsonDeserialize(using = StrictStringDeserializer.class) String refreshToken
) {

    /** 요청 객체를 출력하더라도 토큰 원문은 노출하지 않는다. */
    @Override
    public String toString() {
        return "LogoutRequest[refreshToken=****]";
    }
}
