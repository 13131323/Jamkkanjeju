package com.jamkkanjeju.server.domain.map.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.LocationImageCache;
import com.jamkkanjeju.server.common.client.TourApiLocationImageClient;
import com.jamkkanjeju.server.common.client.TourApiLocationImageClient.LocationImage;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

/** 기동 작업이 유효 캐시를 유지하면서 미적재 장소만 준비하는지 검증한다. */
@Timeout(10)
class LocationImageCacheWarmupTest {
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked") ValueOperations<String, String> values = mock(ValueOperations.class);
    LocationRepository locations = mock(LocationRepository.class);
    TourApiLocationImageClient tour = mock(TourApiLocationImageClient.class);
    LocationImageCache cache = mock(LocationImageCache.class);
    LocationImageCacheWarmup warmup;

    @BeforeEach void setUp() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(eq(LocationImageCacheWarmup.LOCK), anyString(), any(Duration.class))).thenReturn(true);
        doReturn(1L).when(redis).execute(any(RedisScript.class), anyList(), any(Object[].class));
        when(locations.findAll()).thenReturn(List.of(place(1), place(2)));
        when(cache.missingContentIds(List.of(1L, 2L))).thenReturn(List.of(2L));
        when(tour.getJejuImages(any())).thenReturn(List.of(new LocationImage(1, "existing-new.jpg"), new LocationImage(2, "new.jpg")));
        warmup = new LocationImageCacheWarmup(redis, locations, tour, cache);
    }
    @AfterEach void close() { warmup.close(); }
    private Location place(long id) { return Location.builder().contentId(id).latitude(33.5).longitude(126.5).build(); }

    @Test void onlyMissingLocationIsInsertedAndNoKeysAreDeleted() {
        warmup.warmup();
        verify(cache).putImageIfAbsent(2L, "new.jpg");
        verify(cache, never()).putImageIfAbsent(eq(1L), anyString());
        verify(redis, never()).delete(anyString());
        verify(redis, never()).delete(anyCollection());
    }

    @Test void allCacheHitsSkipTourApiAndDoNotExtendTtl() {
        when(cache.missingContentIds(anyList())).thenReturn(List.of());
        warmup.warmup();
        verifyNoInteractions(tour);
        verify(cache, never()).putImageIfAbsent(anyLong(), anyString());
    }

    @Test void emptyDatabaseSkipsTourApi() {
        when(locations.findAll()).thenReturn(List.of());
        when(cache.missingContentIds(List.of())).thenReturn(List.of());
        warmup.warmup();
        verifyNoInteractions(tour);
    }

    @Test void noListImageIsCheckedThroughExistingIndividualQueue() {
        when(tour.getJejuImages(any())).thenReturn(List.of(new LocationImage(2, null)));
        warmup.warmup();
        verify(cache).getLocationImageUrl(2L);
        verify(cache, never()).putImageIfAbsent(anyLong(), anyString());
    }

    @Test void concurrentCacheFillIsKeptByNx() {
        when(cache.putImageIfAbsent(2L, "new.jpg")).thenReturn(false);
        warmup.warmup();
        verify(cache).putImageIfAbsent(2L, "new.jpg");
        verify(redis, never()).delete(anyString());
    }

    @Test void anotherServerOwnsLockSoNoLoadingOccurs() {
        when(values.setIfAbsent(eq(LocationImageCacheWarmup.LOCK), anyString(), any(Duration.class))).thenReturn(false);
        warmup.warmup();
        verifyNoInteractions(locations, cache, tour);
    }

    @Test void externalFailureIsIsolatedAndNeverDeletesExistingCache() {
        when(tour.getJejuImages(any())).thenThrow(new IllegalStateException("test upstream failure"));
        assertThatCode(warmup::warmup).doesNotThrowAnyException();
        verify(cache, never()).putImageIfAbsent(anyLong(), anyString());
        verify(redis, never()).delete(anyString());
        verify(redis).execute(any(RedisScript.class), eq(List.of(LocationImageCacheWarmup.LOCK)), any(Object[].class));
    }

    @Test void applicationReadyReturnsWithoutWaitingAndDuplicateEventsShareOneJob() throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(tour.getJejuImages(any())).thenAnswer(invocation -> {
            entered.countDown();
            release.await(5, TimeUnit.SECONDS);
            return List.of(new LocationImage(2, "new.jpg"));
        });
        try {
            Assertions.assertTimeoutPreemptively(Duration.ofMillis(500), warmup::onApplicationReady);
            assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();
            for (int i = 0; i < 10; i++) warmup.onApplicationReady();
            verify(tour).getJejuImages(any());
        } finally {
            release.countDown();
            verify(cache, timeout(2000)).putImageIfAbsent(2L, "new.jpg");
        }
    }

    @Test void lostLeaseStopsFurtherInsertion() {
        doReturn(0L).when(redis).execute(any(RedisScript.class), anyList(), any(Object[].class));
        warmup.warmup();
        verify(cache, never()).putImageIfAbsent(anyLong(), anyString());
    }
}
