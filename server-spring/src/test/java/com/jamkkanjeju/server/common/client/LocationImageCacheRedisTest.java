package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.config.LocationImageCacheProperties;
import java.time.Duration;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/** 실제 Redis의 별도 DB·고유 키에서 TTL·공유·만료·동시 요청을 확인한다. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LocationImageCacheRedisTest {
    LettuceConnectionFactory factory;
    StringRedisTemplate redis;
    TourApiClient tour;
    LocationImageCache cache;
    long contentId;
    String key;
    final LocationImageCacheProperties properties = new LocationImageCacheProperties(Duration.ofHours(24), Duration.ofHours(1));

    @BeforeAll void connect() {
        var configuration = new RedisStandaloneConfiguration(
                System.getenv().getOrDefault("TEST_REDIS_HOST", "localhost"),
                Integer.parseInt(System.getenv().getOrDefault("TEST_REDIS_PORT", "6379")));
        configuration.setDatabase(15);
        factory = new LettuceConnectionFactory(configuration,
                LettuceClientConfiguration.builder().commandTimeout(Duration.ofSeconds(1)).build());
        factory.afterPropertiesSet();
        factory.start();
        redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();
    }

    @BeforeEach void prepare() {
        contentId = (UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE) | 1;
        key = LocationImageCache.KEY_PREFIX + contentId;
        tour = mock(TourApiClient.class);
        cache = new LocationImageCache(redis, tour, properties);
    }

    @AfterEach void removeOwnKey() { redis.delete(key); }
    @AfterAll void disconnect() { factory.destroy(); }

    @Test void urlPersistsWith24HourTtlAndIsSharedAcrossInstances() {
        when(tour.lookupLocationImage(contentId)).thenReturn(TourApiImageResult.found("photo.jpg"));
        assertThat(cache.getLocationImageUrl(contentId)).isEqualTo("photo.jpg");
        assertThat(redis.opsForValue().get(key)).isEqualTo("URL:photo.jpg");
        assertThat(redis.getExpire(key)).isBetween(86390L, 86400L);
        var otherClient = mock(TourApiClient.class);
        assertThat(new LocationImageCache(redis, otherClient, properties).getLocationImageUrl(contentId)).isEqualTo("photo.jpg");
        verifyNoInteractions(otherClient);
    }

    @Test void normalNoImageHasItsOwnOneHourMarker() {
        when(tour.lookupLocationImage(contentId)).thenReturn(TourApiImageResult.noImage());
        assertThat(cache.getLocationImageUrl(contentId)).isNull();
        assertThat(cache.getLocationImageUrl(contentId)).isNull();
        assertThat(redis.opsForValue().get(key)).isEqualTo("NO_IMAGE");
        assertThat(redis.getExpire(key)).isBetween(3590L, 3600L);
        verify(tour).lookupLocationImage(contentId);
    }

    @Test void failedLookupLeavesNoKey() {
        when(tour.lookupLocationImage(contentId)).thenReturn(TourApiImageResult.failed(true));
        assertThat(cache.getLocationImageUrl(contentId)).isNull();
        assertThat(redis.hasKey(key)).isFalse();
        verify(tour, times(3)).lookupLocationImage(contentId);
    }

    @Test void recoveredLookupWritesOnlySuccessfulUrl() {
        when(tour.lookupLocationImage(contentId)).thenReturn(TourApiImageResult.failed(true), TourApiImageResult.found("recovered.jpg"));
        assertThat(cache.getLocationImageUrl(contentId)).isEqualTo("recovered.jpg");
        assertThat(redis.opsForValue().get(key)).isEqualTo("URL:recovered.jpg");
        verify(tour, times(2)).lookupLocationImage(contentId);
    }

    @Test void expiredKeyCausesFreshLookup() throws Exception {
        when(tour.lookupLocationImage(contentId)).thenReturn(TourApiImageResult.found("first.jpg"), TourApiImageResult.found("second.jpg"));
        cache.getLocationImageUrl(contentId);
        redis.expire(key, Duration.ofMillis(10));
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
        while (redis.hasKey(key) && System.nanoTime() < deadline) Thread.sleep(10);
        assertThat(redis.hasKey(key)).isFalse();
        assertThat(cache.getLocationImageUrl(contentId)).isEqualTo("second.jpg");
        verify(tour, times(2)).lookupLocationImage(contentId);
    }

    @Test void simultaneousMissesInOneInstanceCallTourApiOnce() throws Exception {
        when(tour.lookupLocationImage(contentId)).thenReturn(TourApiImageResult.found("shared.jpg"));
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(6)) {
            var futures = new ArrayList<Future<String>>();
            for (int i = 0; i < 6; i++) futures.add(executor.submit(() -> { start.await(); return cache.getLocationImageUrl(contentId); }));
            start.countDown();
            for (var future : futures) assertThat(future.get(5, TimeUnit.SECONDS)).isEqualTo("shared.jpg");
        }
        verify(tour).lookupLocationImage(contentId);
    }
}
