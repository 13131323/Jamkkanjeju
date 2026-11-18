package com.jamkkanjeju.server.common.client;

import com.jamkkanjeju.server.common.config.LocationImageCacheProperties;
import java.util.stream.IntStream;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/** 지도 대표 사진의 Redis 캐시를 공유하며 외부 조회 실패는 캐싱하지 않는다. */
@Slf4j
@Component
public class LocationImageCache {
    static final String KEY_PREFIX = "tourapi:location-image:v1:";
    static final String NO_IMAGE = "NO_IMAGE";
    private static final String URL_PREFIX = "URL:";
    private static final int MAX_ATTEMPTS = 3;

    private final StringRedisTemplate redis;
    private final TourApiImageRequestQueue requestQueue;
    private final LocationImageCacheProperties properties;
    private final Set<Long> pending = ConcurrentHashMap.newKeySet();
    // 단일 Spring 인스턴스에서 같은 장소의 동시 캐시 미스를 묶는다. 무한한 장소별 잠금은 만들지 않는다.
    private final Object[] locks = IntStream.range(0, 64).mapToObj(index -> new Object()).toArray();

    public LocationImageCache(StringRedisTemplate redis, TourApiClient tourApiClient,
                              LocationImageCacheProperties properties) {
        this.redis = redis;
        this.properties = properties;
        this.requestQueue = new TourApiImageRequestQueue(tourApiClient::lookupLocationImage);
    }

    @PreDestroy
    public void close() {
        requestQueue.close();
    }

    /** 지도 홈은 Redis만 읽고, 캐시 미스는 공유 대기열에 등록한 뒤 즉시 반환한다. */
    public String getCachedLocationImageUrl(Long contentId) {
        if (contentId == null || contentId <= 0) return null;
        String cached = redis.opsForValue().get(KEY_PREFIX + contentId);
        if (cached != null) return decode(cached);
        if (pending.add(contentId)) fillInBackground(contentId, 1);
        return null;
    }

    /** URL이 아직 응답에 없을 때 정상 사진 없음과 미조회 상태를 구분한다. Redis 장애는 전파한다. */
    public boolean needsImageRefresh(Long contentId) {
        if (contentId == null || contentId <= 0) return false;
        return !NO_IMAGE.equals(redis.opsForValue().get(KEY_PREFIX + contentId));
    }

    private void fillInBackground(Long contentId, int attempt) {
        requestQueue.submit(contentId).whenComplete((result, exception) -> {
            boolean retry = false;
            try {
                if (exception != null) return;
                String key = KEY_PREFIX + contentId;
                if (result.status() == TourApiImageResult.Status.FOUND) {
                    redis.opsForValue().set(key, URL_PREFIX + result.imageUrl(), properties.imageTtl());
                } else if (result.status() == TourApiImageResult.Status.NO_IMAGE) {
                    redis.opsForValue().set(key, NO_IMAGE, properties.noImageTtl());
                } else if (result.retryable() && attempt < MAX_ATTEMPTS) {
                    retry = true;
                }
            } catch (RuntimeException failure) {
                log.warn("지도 사진 백그라운드 캐시 저장 실패: contentId={}", contentId);
            } finally {
                if (retry) fillInBackground(contentId, attempt + 1);
                else pending.remove(contentId);
            }
        });
    }

    /** 기동 작업은 한 번의 Redis 조회로 만료·미적재 키를 찾는다. NO_IMAGE도 유효한 hit다. */
    public List<Long> missingContentIds(List<Long> contentIds) {
        if (contentIds.isEmpty()) return List.of();
        List<String> values = redis.opsForValue().multiGet(contentIds.stream().map(id -> KEY_PREFIX + id).toList());
        if (values == null || values.size() != contentIds.size()) throw new IllegalStateException("Redis 사진 캐시 조회 불일치");
        return IntStream.range(0, contentIds.size()).filter(index -> values.get(index) == null)
                .mapToObj(contentIds::get).toList();
    }

    /** 기동 중 다른 요청이 먼저 채운 캐시의 값과 TTL도 덮어쓰지 않는다. */
    public boolean putImageIfAbsent(Long contentId, String imageUrl) {
        return Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(KEY_PREFIX + contentId,
                URL_PREFIX + imageUrl, properties.imageTtl()));
    }

    /** Redis 장애는 숨기지 않아 GlobalExceptionHandler의 공통 500 응답으로 전달한다. */
    public String getLocationImageUrl(Long contentId) {
        if (contentId == null || contentId <= 0) return null;
        String key = KEY_PREFIX + contentId;
        String cached = redis.opsForValue().get(key);
        if (cached != null) return decode(cached);
        synchronized (locks[Math.floorMod(contentId.hashCode(), locks.length)]) {
            // 앞선 요청이 같은 사진을 저장했다면 다시 TourAPI를 호출하지 않는다.
            cached = redis.opsForValue().get(key);
            if (cached != null) return decode(cached);
            for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                TourApiImageResult result = requestQueue.lookup(contentId);
                if (result.status() == TourApiImageResult.Status.RATE_LIMITED
                        || result.status() == TourApiImageResult.Status.DEFERRED) return null;
                if (result.status() == TourApiImageResult.Status.FOUND) {
                    redis.opsForValue().set(key, URL_PREFIX + result.imageUrl(), properties.imageTtl());
                    return result.imageUrl();
                }
                if (result.status() == TourApiImageResult.Status.NO_IMAGE) {
                    redis.opsForValue().set(key, NO_IMAGE, properties.noImageTtl());
                    return null;
                }
                if (!result.retryable() || attempt == MAX_ATTEMPTS) break;
                try {
                    Thread.sleep(100L * attempt);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    return null;
                }
            }
            log.warn("TourAPI 대표 사진 조회 실패: contentId={}, 실패 결과는 캐싱하지 않습니다.", contentId);
            return null;
        }
    }

    /** 캐시 키 부재와 NO_IMAGE를 구분하며 알 수 없는 캐시 값은 정상 결과로 취급하지 않는다. */
    private String decode(String value) {
        if (NO_IMAGE.equals(value)) return null;
        if (value.startsWith(URL_PREFIX) && value.length() > URL_PREFIX.length()) {
            return value.substring(URL_PREFIX.length());
        }
        throw new IllegalStateException("Redis 대표 사진 캐시 형식이 올바르지 않습니다.");
    }
}
