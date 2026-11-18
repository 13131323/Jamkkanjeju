package com.jamkkanjeju.server.common.config;

import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** 대표 사진 URL과 정상 사진 없음 결과의 Redis 유효기간이다. */
@Validated
@ConfigurationProperties(prefix = "app.location-image-cache")
public record LocationImageCacheProperties(@NotNull Duration imageTtl, @NotNull Duration noImageTtl) {
}
