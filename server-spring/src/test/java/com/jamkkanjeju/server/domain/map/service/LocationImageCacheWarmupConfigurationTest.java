package com.jamkkanjeju.server.domain.map.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.jamkkanjeju.server.common.client.LocationImageCache;
import com.jamkkanjeju.server.common.client.TourApiLocationImageClient;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.redis.core.StringRedisTemplate;

/** 운영 기본 활성화와 통합 테스트의 외부 접근 차단 설정을 검증한다. */
class LocationImageCacheWarmupConfigurationTest {
    @Test void disabledTestsDoNotCreateStartupWorker() {
        new ApplicationContextRunner().withUserConfiguration(LocationImageCacheWarmup.class)
                .withPropertyValues("app.location-image-cache.warmup-enabled=false")
                .run(context -> assertThat(context).doesNotHaveBean(LocationImageCacheWarmup.class));
    }

    @Test void serverDefaultCreatesStartupWorkerWithoutExtraEnvironmentVariables() {
        new ApplicationContextRunner().withUserConfiguration(LocationImageCacheWarmup.class)
                .withBean(StringRedisTemplate.class, () -> mock(StringRedisTemplate.class))
                .withBean(LocationRepository.class, () -> mock(LocationRepository.class))
                .withBean(TourApiLocationImageClient.class, () -> mock(TourApiLocationImageClient.class))
                .withBean(LocationImageCache.class, () -> mock(LocationImageCache.class))
                .run(context -> assertThat(context).hasSingleBean(LocationImageCacheWarmup.class));
    }
}
