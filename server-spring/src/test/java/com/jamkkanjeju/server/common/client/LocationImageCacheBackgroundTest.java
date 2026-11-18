package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.config.LocationImageCacheProperties;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

/** 외부 API가 느려도 지도 홈이 기다리지 않고 사진을 나중에 재사용하는지 검증한다. */
@Timeout(10)
class LocationImageCacheBackgroundTest {
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked") ValueOperations<String, String> values = mock(ValueOperations.class);
    TourApiClient tour = mock(TourApiClient.class);
    LocationImageCache cache;
    String key = LocationImageCache.KEY_PREFIX + 123;

    @BeforeEach void setUp() {
        when(redis.opsForValue()).thenReturn(values);
        cache = new LocationImageCache(redis, tour,
                new LocationImageCacheProperties(Duration.ofHours(24), Duration.ofHours(1)));
    }
    @AfterEach void close() { cache.close(); }

    @Test void slowExternalCallDoesNotBlockResponseAndDuplicateRequestsJoinOneJob() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(tour.lookupLocationImage(123L)).thenAnswer(invocation -> {
            started.countDown();
            release.await(5, TimeUnit.SECONDS);
            return TourApiImageResult.found("ready.jpg");
        });
        try {
            Assertions.assertTimeoutPreemptively(Duration.ofMillis(500), () -> {
                for (int index = 0; index < 20; index++) assertThat(cache.getCachedLocationImageUrl(123L)).isNull();
            });
            assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(cache.needsImageRefresh(123L)).isTrue();
            verify(tour).lookupLocationImage(123L);
            release.countDown();
            verify(values, timeout(2000)).set(key, "URL:ready.jpg", Duration.ofHours(24));
            when(values.get(key)).thenReturn("URL:ready.jpg");
            assertThat(cache.getCachedLocationImageUrl(123L)).isEqualTo("ready.jpg");
            verifyNoMoreInteractions(tour);
        } finally { release.countDown(); }
    }

    @Test void confirmedNoImageStopsRefreshAndIsCached() {
        when(tour.lookupLocationImage(123L)).thenReturn(TourApiImageResult.noImage());
        assertThat(cache.getCachedLocationImageUrl(123L)).isNull();
        verify(values, timeout(2000)).set(key, "NO_IMAGE", Duration.ofHours(1));
        when(values.get(key)).thenReturn("NO_IMAGE");
        assertThat(cache.needsImageRefresh(123L)).isFalse();
        assertThat(cache.getCachedLocationImageUrl(123L)).isNull();
        verify(tour).lookupLocationImage(123L);
    }

    @Test void alreadyCachedUrlDoesNotScheduleWork() {
        when(values.get(key)).thenReturn("URL:ready.jpg");
        assertThat(cache.getCachedLocationImageUrl(123L)).isEqualTo("ready.jpg");
        verifyNoInteractions(tour);
    }

    @Test void redisReadFailureStillPropagates() {
        when(values.get(key)).thenThrow(new RedisConnectionFailureException("test outage"));
        assertThatThrownBy(() -> cache.getCachedLocationImageUrl(123L)).isInstanceOf(RedisConnectionFailureException.class);
        verifyNoInteractions(tour);
    }

    @Test void startupWarmupSelectsOnlyMissingKeysIncludingExpiredOnes() {
        when(values.multiGet(java.util.List.of(LocationImageCache.KEY_PREFIX + 1,
                LocationImageCache.KEY_PREFIX + 2, LocationImageCache.KEY_PREFIX + 3)))
                .thenReturn(java.util.Arrays.asList("URL:cached.jpg", "NO_IMAGE", null));
        assertThat(cache.missingContentIds(java.util.List.of(1L, 2L, 3L))).containsExactly(3L);
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test void emptyDatabaseDoesNotReadRedis() {
        assertThat(cache.missingContentIds(java.util.List.of())).isEmpty();
        verifyNoInteractions(values);
    }

    @Test void startupInsertionUsesNxAnd24HoursWithoutReplacingExistingValue() {
        when(values.setIfAbsent(key, "URL:new.jpg", Duration.ofHours(24))).thenReturn(false);
        assertThat(cache.putImageIfAbsent(123L, "new.jpg")).isFalse();
        verify(values).setIfAbsent(key, "URL:new.jpg", Duration.ofHours(24));
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }
}
