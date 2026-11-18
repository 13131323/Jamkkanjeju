package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.config.LocationImageCacheProperties;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

/** 사진 없음·외부 오류·Redis 오류가 혼동되지 않는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class LocationImageCacheTest {
    private static final String KEY = LocationImageCache.KEY_PREFIX + 123;
    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String, String> values;
    @Mock TourApiClient tour;
    LocationImageCache cache;

    @BeforeEach
    void setUp() {
        lenient().when(redis.opsForValue()).thenReturn(values);
        cache = new LocationImageCache(redis, tour,
                new LocationImageCacheProperties(Duration.ofHours(24), Duration.ofHours(1)));
    }

    @AfterEach void closeQueue() { cache.close(); }

    @Test void rateLimitStopsRetriesAndOtherLocationsWithoutCachingFailure() {
        when(tour.lookupLocationImage(123L)).thenReturn(TourApiImageResult.rateLimited(60));
        assertThat(cache.getLocationImageUrl(123L)).isNull();
        assertThat(cache.getLocationImageUrl(124L)).isNull();
        verify(tour).lookupLocationImage(123L);
        verifyNoMoreInteractions(tour);
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test void urlHitDoesNotCallTourApi() {
        when(values.get(KEY)).thenReturn("URL:https://example.com/photo.jpg");
        assertThat(cache.getLocationImageUrl(123L)).isEqualTo("https://example.com/photo.jpg");
        verifyNoInteractions(tour);
    }

    @Test void noImageHitDoesNotCallTourApi() {
        when(values.get(KEY)).thenReturn("NO_IMAGE");
        assertThat(cache.getLocationImageUrl(123L)).isNull();
        verifyNoInteractions(tour);
    }

    @Test void foundUrlIsCachedFor24Hours() {
        when(tour.lookupLocationImage(123L)).thenReturn(TourApiImageResult.found("photo.jpg"));
        assertThat(cache.getLocationImageUrl(123L)).isEqualTo("photo.jpg");
        verify(values).set(KEY, "URL:photo.jpg", Duration.ofHours(24));
    }

    @Test void normalNoImageIsCachedForOneHour() {
        when(tour.lookupLocationImage(123L)).thenReturn(TourApiImageResult.noImage());
        assertThat(cache.getLocationImageUrl(123L)).isNull();
        verify(values).set(KEY, "NO_IMAGE", Duration.ofHours(1));
    }

    @Test void retryableFailureStopsAfterThreeAttemptsWithoutCaching() {
        when(tour.lookupLocationImage(123L)).thenReturn(TourApiImageResult.failed(true));
        assertThat(cache.getLocationImageUrl(123L)).isNull();
        verify(tour, times(3)).lookupLocationImage(123L);
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test void nonRetryableFailureDoesNotRetryOrCache() {
        when(tour.lookupLocationImage(123L)).thenReturn(TourApiImageResult.failed(false));
        assertThat(cache.getLocationImageUrl(123L)).isNull();
        verify(tour).lookupLocationImage(123L);
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test void retrySuccessCachesOnlyConfirmedImage() {
        when(tour.lookupLocationImage(123L)).thenReturn(TourApiImageResult.failed(true), TourApiImageResult.found("recovered.jpg"));
        assertThat(cache.getLocationImageUrl(123L)).isEqualTo("recovered.jpg");
        verify(tour, times(2)).lookupLocationImage(123L);
        verify(values).set(KEY, "URL:recovered.jpg", Duration.ofHours(24));
    }

    @Test void redisReadFailurePropagatesWithoutCallingTourApi() {
        when(values.get(KEY)).thenThrow(new RedisConnectionFailureException("test outage"));
        assertThatThrownBy(() -> cache.getLocationImageUrl(123L)).isInstanceOf(RedisConnectionFailureException.class);
        verifyNoInteractions(tour);
    }

    @Test void redisWriteFailurePropagatesEvenAfterTourApiSuccess() {
        when(tour.lookupLocationImage(123L)).thenReturn(TourApiImageResult.found("photo.jpg"));
        doThrow(new RedisConnectionFailureException("test outage"))
                .when(values).set(KEY, "URL:photo.jpg", Duration.ofHours(24));
        assertThatThrownBy(() -> cache.getLocationImageUrl(123L)).isInstanceOf(RedisConnectionFailureException.class);
    }

    @Test void corruptCacheIsNotTreatedAsNoImage() {
        when(values.get(KEY)).thenReturn("corrupt");
        assertThatThrownBy(() -> cache.getLocationImageUrl(123L)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(tour);
    }

    @Test void invalidIdDoesNotCallRedisOrTourApi() {
        assertThat(cache.getLocationImageUrl(null)).isNull();
        assertThat(cache.getLocationImageUrl(0L)).isNull();
        verifyNoInteractions(redis, tour);
    }
}
