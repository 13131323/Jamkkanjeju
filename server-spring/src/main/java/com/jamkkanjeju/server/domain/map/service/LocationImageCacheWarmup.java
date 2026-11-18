package com.jamkkanjeju.server.domain.map.service;

import com.jamkkanjeju.server.common.client.LocationImageCache;
import com.jamkkanjeju.server.common.client.TourApiLocationImageClient;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/** 서버가 준비되면 DB 장소 중 Redis에 없는 대표 사진만 별도 스레드에서 준비한다. */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.location-image-cache", name = "warmup-enabled", havingValue = "true", matchIfMissing = true)
public class LocationImageCacheWarmup {
    static final String LOCK = "tourapi:location-image:warmup:lock";
    private static final Duration LEASE = Duration.ofMinutes(10);
    private static final DefaultRedisScript<Long> EXTEND = new DefaultRedisScript<>(
            "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end", Long.class);
    private static final DefaultRedisScript<Long> RELEASE = new DefaultRedisScript<>(
            "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", Long.class);

    private final StringRedisTemplate redis;
    private final LocationRepository locations;
    private final TourApiLocationImageClient tour;
    private final LocationImageCache cache;
    private final AtomicBoolean running = new AtomicBoolean();
    private final ExecutorService executor = Executors.newSingleThreadExecutor(
            Thread.ofPlatform().daemon().name("startup-image-warmup").factory());

    /** 시작 이벤트는 작업만 전달한다. 웹 서버와 사용자 요청은 적재 완료를 기다리지 않는다. */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!running.compareAndSet(false, true)) return;
        try {
            executor.execute(this::warmup);
        } catch (RuntimeException exception) {
            running.set(false);
            log.warn("기동 사진 사전 적재 작업을 시작하지 못했습니다.");
        }
    }

    void warmup() {
        String token = UUID.randomUUID().toString();
        boolean acquired = false;
        try {
            acquired = Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(LOCK, token, LEASE));
            if (!acquired) return;
            List<Long> ids = locations.findAll().stream().map(Location::getContentId).distinct().sorted().toList();
            List<Long> missing = cache.missingContentIds(ids);
            if (missing.isEmpty()) {
                log.info("기동 사진 사전 적재 생략: DB 장소={}, 미적재=0", ids.size());
                return;
            }
            Map<Long, String> images = tour.getJejuImages(() -> heartbeat(token)).stream()
                    .filter(image -> image.imageUrl() != null)
                    .collect(Collectors.toMap(TourApiLocationImageClient.LocationImage::contentId,
                            TourApiLocationImageClient.LocationImage::imageUrl));
            int inserted = 0;
            for (Long id : missing) {
                if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("기동 적재 중단");
                String url = images.get(id);
                if (url == null) continue;
                heartbeat(token);
                if (cache.putImageIfAbsent(id, url)) inserted++;
            }
            List<Long> unresolved = missing.stream().filter(id -> !images.containsKey(id)).toList();
            // 목록에 URL이 없다고 사진 없음으로 단정하지 않는다. 기존 5개 대기열에서 직접 확인한다.
            try (var callers = Executors.newVirtualThreadPerTaskExecutor()) {
                for (int start = 0; start < unresolved.size(); start += 5) {
                    heartbeat(token);
                    List<Long> batch = unresolved.subList(start, Math.min(start + 5, unresolved.size()));
                    var pending = batch.stream().map(id -> callers.submit(() -> cache.getLocationImageUrl(id))).toList();
                    for (var result : pending) result.get();
                }
            }
            log.info("기동 사진 사전 적재 완료: DB 장소={}, 미적재={}, 신규 목록 URL={}, 개별 확인 대상={}",
                    ids.size(), missing.size(), inserted, unresolved.size());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        } catch (java.util.concurrent.ExecutionException exception) {
            log.warn("기동 사진 개별 확인 실패. 정상 적재한 기존 캐시는 유지합니다.");
        } catch (RuntimeException exception) {
            log.warn("기동 사진 사전 적재 실패. 서버 이용과 지도 miss 적재는 계속됩니다. errorType={}",
                    exception.getClass().getSimpleName());
        } finally {
            if (acquired) {
                try { redis.execute(RELEASE, List.of(LOCK), token); }
                catch (RuntimeException ignored) { /* 서버 장애 시 잠금 TTL로 복구한다. */ }
            }
            running.set(false);
        }
    }

    private void heartbeat(String token) {
        if (!Long.valueOf(1).equals(redis.execute(EXTEND, List.of(LOCK), token, Long.toString(LEASE.toMillis())))) {
            throw new IllegalStateException("기동 적재 잠금 소유권 상실");
        }
    }

    @PreDestroy
    public void close() { executor.shutdownNow(); }
}
