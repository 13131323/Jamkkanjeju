package com.jamkkanjeju.server.domain.guestbook.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mockingDetails;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.support.GuestbookLikeIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.stubbing.Answer;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 독립 HTTP 트랜잭션을 겹쳐 잠금 대기 이후의 최신 상태와 중복 없는 집계를 검증한다. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ToggleGuestbookLikeConcurrencyIntegrationTest extends GuestbookLikeIntegrationTestSupport {
    @ParameterizedTest @ValueSource(booleans = {false, true})
    void 같은사용자의_두요청은_잠금후_최신상태를_각각반전한다(boolean existing) throws Exception {
        Long id = transactions.execute(tx -> {
            Guestbook book = addBook(false, current, GuestbookStatus.ACTIVE);
            if (existing) addLike(book, current);
            em.flush(); return book.getId();
        });
        AtomicInteger order = new AtomicInteger();
        CountDownLatch secondReachedLock = new CountDownLatch(1);
        Answer<?> repositoryDelegate = mockingDetails(books).getMockCreationSettings().getDefaultAnswer();
        doAnswer(invocation -> {
            int position = order.getAndIncrement();
            if (position == 0) {
                Object locked = repositoryDelegate.answer(invocation);
                // 첫 요청이 잠금을 쥔 동안 두 번째 요청이 사용자 조회를 마치고 잠금에 도달하게 한다.
                assertThat(secondReachedLock.await(20, TimeUnit.SECONDS)).isTrue();
                return locked;
            }
            secondReachedLock.countDown();
            return repositoryDelegate.answer(invocation);
        }).when(books).findByIdForUpdate(id);
        List<Result> results = concurrent(id, List.of(bearer(current), bearer(current)));
        assertThat(results).extracting(Result::status).containsOnly(200);
        assertThat(results).extracting(Result::liked).containsExactlyInAnyOrder(true, false);
        assertThat(results).extracting(Result::count).containsExactlyInAnyOrder(0L, 1L);
        assertThat(results).extracting(Result::id).containsOnly(id);
        assertThat(likeCount(id)).isEqualTo(existing ? 1 : 0);
        assertThat(order.get()).isEqualTo(2);
    }

    @Test void 다른사용자들의_동시등록은_한명씩_반영되고_개수가_누락되지않는다() throws Exception {
        Long id = transactions.execute(tx -> addBook(false, current, GuestbookStatus.ACTIVE).getId());
        List<Result> results = concurrent(id, List.of(bearer(current), bearer(other)));
        assertThat(results).extracting(Result::status).containsOnly(200);
        assertThat(results).extracting(Result::liked).containsOnly(true);
        assertThat(results).extracting(Result::count).containsExactlyInAnyOrder(1L, 2L);
        assertThat(likeCount(id)).isEqualTo(2);
        assertThat(likeRows(id)).extracting(row -> row.get("user_id")).containsExactlyInAnyOrder(current.getId(), other.getId());
    }

    /** 독립 스레드가 장벽 이후 동시에 요청하고 각 응답의 처리 시점 상태를 수집한다. */
    private List<Result> concurrent(Long id, List<String> authorizations) throws Exception {
        CountDownLatch ready = new CountDownLatch(authorizations.size());
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(authorizations.size());
        try {
            List<Future<Result>> tasks = new ArrayList<>();
            for (String authorization : authorizations) tasks.add(pool.submit(() -> {
                ready.countDown();
                if (!go.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("요청 장벽 시간 초과");
                var response = mvc.perform(post(URL + "/{id}/like", id).header("Authorization", authorization))
                        .andReturn().getResponse();
                String json = response.getContentAsString(StandardCharsets.UTF_8);
                assertThat(response.getStatus()).withFailMessage(json).isEqualTo(200);
                return new Result(response.getStatus(), ((Number) JsonPath.read(json, "$.guestbookId")).longValue(),
                        JsonPath.read(json, "$.isLiked"), ((Number) JsonPath.read(json, "$.likeCount")).longValue());
            }));
            assertThat(ready.await(20, TimeUnit.SECONDS)).isTrue(); go.countDown();
            List<Result> results = new ArrayList<>();
            for (Future<Result> task : tasks) results.add(task.get(30, TimeUnit.SECONDS));
            return results;
        } finally {
            go.countDown(); pool.shutdownNow(); assertThat(pool.awaitTermination(30, TimeUnit.SECONDS)).isTrue();
        }
    }

    private record Result(int status, Long id, boolean liked, long count) { }
}
