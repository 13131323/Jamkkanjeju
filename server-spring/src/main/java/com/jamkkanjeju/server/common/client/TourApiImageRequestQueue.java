package com.jamkkanjeju.server.common.client;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;

/** 서버 인스턴스 전체의 대표 사진 요청을 최대 5개씩 처리하고 묶음 간 간격을 둔다. */
@Slf4j
final class TourApiImageRequestQueue implements AutoCloseable {
    private record Request(Long contentId, CompletableFuture<TourApiImageResult> result) {}

    private final ArrayBlockingQueue<Request> requests = new ArrayBlockingQueue<>(250);
    private final ExecutorService workers = Executors.newFixedThreadPool(5,
            Thread.ofPlatform().daemon().name("tour-image-worker-", 0).factory());
    private final Function<Long, TourApiImageResult> lookup;
    private final long batchIntervalNanos;
    private final long cooldownNanos;
    private final AtomicLong blockedUntil = new AtomicLong();
    private final Thread dispatcher;
    private volatile boolean closed;

    TourApiImageRequestQueue(Function<Long, TourApiImageResult> lookup) {
        this(lookup, Duration.ofSeconds(1), Duration.ofSeconds(60));
    }

    /** 테스트에서는 같은 처리 규칙을 짧은 간격으로 검증한다. */
    TourApiImageRequestQueue(Function<Long, TourApiImageResult> lookup, Duration interval, Duration cooldown) {
        this.lookup = lookup;
        this.batchIntervalNanos = interval.toNanos();
        this.cooldownNanos = cooldown.toNanos();
        this.dispatcher = Thread.ofPlatform().daemon().name("tour-image-dispatcher").start(this::dispatch);
    }

    /** 포화나 429 대기 중에는 HTTP 스레드를 더 쌓지 않고 미조회 결과를 반환한다. */
    TourApiImageResult lookup(Long contentId) {
        CompletableFuture<TourApiImageResult> result = submit(contentId);
        try {
            return result.get();
        } catch (InterruptedException exception) {
            result.cancel(false);
            Thread.currentThread().interrupt();
            return TourApiImageResult.deferred();
        } catch (java.util.concurrent.ExecutionException exception) {
            return TourApiImageResult.failed(false);
        }
    }

    /** 요청 스레드는 대기하지 않고, 완료 결과로 Redis를 채울 수 있다. */
    CompletableFuture<TourApiImageResult> submit(Long contentId) {
        Request request = new Request(contentId, new CompletableFuture<>());
        if (closed || isBlocked() || !requests.offer(request)) {
            request.result().complete(TourApiImageResult.deferred());
        } else if (closed && requests.remove(request)) {
            request.result().complete(TourApiImageResult.deferred());
        }
        return request.result();
    }

    private boolean isBlocked() {
        long until = blockedUntil.get();
        return until != 0 && until - System.nanoTime() > 0;
    }

    /** 한 묶음이 모두 성공 또는 실패로 끝난 뒤에만 다음 묶음을 시작한다. */
    private void dispatch() {
        List<Request> batch = new ArrayList<>(5);
        try {
            while (!closed) {
                batch.clear();
                batch.add(requests.take());
                requests.drainTo(batch, 4);
                List<CompletableFuture<Void>> completed = new ArrayList<>(batch.size());
                for (Request request : batch) {
                    completed.add(CompletableFuture.runAsync(() -> execute(request), workers));
                }
                CompletableFuture.allOf(completed.toArray(CompletableFuture[]::new)).get();
                TimeUnit.NANOSECONDS.sleep(batchIntervalNanos);
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        } catch (java.util.concurrent.ExecutionException exception) {
            log.warn("TourAPI 이미지 대기열 작업이 중단되었습니다.");
        } finally {
            for (Request request : batch) request.result().complete(TourApiImageResult.deferred());
            Request request;
            while ((request = requests.poll()) != null) request.result().complete(TourApiImageResult.deferred());
        }
    }

    private void execute(Request request) {
        try {
            if (closed || isBlocked() || request.result().isCancelled()) {
                request.result().complete(TourApiImageResult.deferred());
                return;
            }
            TourApiImageResult result = lookup.apply(request.contentId());
            if (result.status() == TourApiImageResult.Status.RATE_LIMITED) {
                long delay = Math.max(cooldownNanos, TimeUnit.SECONDS.toNanos(result.retryAfterSeconds()));
                // 상류의 비정상적으로 큰 Retry-After 값에 의한 nanoTime 오버플로를 방지한다.
                delay = Math.min(delay, Duration.ofDays(1).toNanos());
                blockedUntil.accumulateAndGet(System.nanoTime() + delay, Math::max);
                log.warn("TourAPI 이미지 호출을 {}초 동안 중단합니다. 캐시된 사진은 계속 제공합니다.",
                        TimeUnit.NANOSECONDS.toSeconds(delay));
                Request pending;
                while ((pending = requests.poll()) != null) pending.result().complete(TourApiImageResult.deferred());
            }
            request.result().complete(result);
        } catch (RuntimeException exception) {
            request.result().complete(TourApiImageResult.failed(false));
        }
    }

    /** 앱 종료 시 대기 중인 호출자를 해제하고 작업 스레드를 정리한다. */
    @Override
    public void close() {
        closed = true;
        dispatcher.interrupt();
        workers.shutdownNow();
    }
}
