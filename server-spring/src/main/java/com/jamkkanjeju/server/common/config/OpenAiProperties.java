package com.jamkkanjeju.server.common.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** OpenAI 기능 활성화와 백엔드 전용 접속·이미지 생성 설정이다. */
@Validated
@ConfigurationProperties(prefix = "app.openai")
public record OpenAiProperties(
        boolean enabled,
        String apiKey,
        @NotBlank String baseUrl,
        @NotBlank String imageModel,
        @NotNull Duration connectTimeout,
        @NotNull Duration readTimeout
) {
    /** 설정 객체 출력에 인증키를 남기지 않는다. */
    @Override
    public String toString() {
        return "OpenAiProperties[enabled=" + enabled + ", apiKey=***, baseUrl=" + baseUrl
                + ", imageModel=" + imageModel + ", connectTimeout=" + connectTimeout
                + ", readTimeout=" + readTimeout + "]";
    }
}
