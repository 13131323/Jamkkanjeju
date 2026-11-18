package com.jamkkanjeju.server.common.client;

import static org.assertj.core.api.Assertions.*;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

/** 실제 TourAPI 없이 묶음 처리·대기·실패 복구를 검증한다. */
@Timeout(10)
class TourApiImageRequestQueueTest {
    @Test void atMostFiveRunAndNextBatchWaitsForEveryPreviousTaskAndInterval() throws Exception {
        AtomicInteger active = new AtomicInteger();
        AtomicInteger maxActive = new AtomicInteger();
        AtomicInteger calls = new AtomicInteger();
        AtomicLong lastEnd = new AtomicLong();
        AtomicLong shortestGap = new AtomicLong(Long.MAX_VALUE);
        try (var queue = new TourApiImageRequestQueue(id -> {
            int count = active.incrementAndGet();
            maxActive.accumulateAndGet(count, Math::max);
            long priorEnd = lastEnd.get();
            if (count == 1 && priorEnd != 0) shortestGap.accumulateAndGet(System.nanoTime() - priorEnd, Math::min);
            calls.incrementAndGet();
            try {
                Thread.sleep(id % 2 == 0 ? 60 : 15);
                return TourApiImageResult.found("photo-" + id);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return TourApiImageResult.deferred();
            } finally {
                lastEnd.set(System.nanoTime());
                active.decrementAndGet();
            }
        }, Duration.ofMillis(80), Duration.ofMillis(100));
             var callers = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<TourApiImageResult>> results = new ArrayList<>();
            for (long id = 1; id <= 16; id++) {
                long contentId = id;
                results.add(callers.submit(() -> queue.lookup(contentId)));
            }
            for (var result : results) assertThat(result.get().status()).isEqualTo(TourApiImageResult.Status.FOUND);
            assertThat(calls.get()).isEqualTo(16);
            assertThat(maxActive.get()).isBetween(2, 5);
            // 일부 작업 완료만으로 빈 슬롯을 채우면 이 간격 검증을 통과하지 못한다.
            assertThat(shortestGap.get()).isGreaterThanOrEqualTo(Duration.ofMillis(70).toNanos());
        }
    }

    @Test void oneFailureDoesNotStopLaterRequests() {
        try (var queue = new TourApiImageRequestQueue(id -> {
            if (id == 1) throw new IllegalStateException("test failure");
            return TourApiImageResult.found("ok");
        }, Duration.ZERO, Duration.ofMillis(100))) {
            assertThat(queue.lookup(1L).status()).isEqualTo(TourApiImageResult.Status.FAILED);
            assertThat(queue.lookup(2L).imageUrl()).isEqualTo("ok");
        }
    }

    @Test void rateLimitDefersAllLocationsThenRecovers() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        try (var queue = new TourApiImageRequestQueue(id -> calls.incrementAndGet() == 1
                ? new TourApiImageResult(TourApiImageResult.Status.RATE_LIMITED, null, false, 0)
                : TourApiImageResult.found("recovered"), Duration.ZERO, Duration.ofMillis(150))) {
            assertThat(queue.lookup(1L).status()).isEqualTo(TourApiImageResult.Status.RATE_LIMITED);
            assertThat(queue.lookup(2L).status()).isEqualTo(TourApiImageResult.Status.DEFERRED);
            assertThat(calls.get()).isEqualTo(1);
            Thread.sleep(180);
            assertThat(queue.lookup(3L).imageUrl()).isEqualTo("recovered");
        }
    }

    @Test void shutdownReleasesWaitingCallers() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        var queue = new TourApiImageRequestQueue(id -> {
            started.countDown();
            try { new CountDownLatch(1).await(); }
            catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
            return TourApiImageResult.deferred();
        }, Duration.ZERO, Duration.ofSeconds(1));
        try (var callers = Executors.newVirtualThreadPerTaskExecutor()) {
            var result = callers.submit(() -> queue.lookup(1L));
            assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
            queue.close();
            assertThat(result.get(2, TimeUnit.SECONDS).status()).isEqualTo(TourApiImageResult.Status.DEFERRED);
            assertThat(queue.lookup(2L).status()).isEqualTo(TourApiImageResult.Status.DEFERRED);
        } finally { queue.close(); }
    }
}
