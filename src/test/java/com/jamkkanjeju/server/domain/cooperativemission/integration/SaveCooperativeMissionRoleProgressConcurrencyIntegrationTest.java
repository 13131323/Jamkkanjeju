package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.CLOCK;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionRoleProgressIntegrationSupport;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.*;

/** 독립 트랜잭션의 동시 사진 인증이 한 번만 업로드·완료되는지 검증한다. */
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class SaveCooperativeMissionRoleProgressConcurrencyIntegrationTest extends CooperativeMissionRoleProgressIntegrationSupport {
    @Test void 동시인증은_한번만저장하고_후행요청은_완료오류다() throws Exception {
        var d=transactions.execute(tx -> data()); var before=snapshot(d.team().getId()).subList(0,2); var rewards=rewardSnapshot(d.user());
        var ready=new CountDownLatch(2); var go=new CountDownLatch(1); var pool=Executors.newFixedThreadPool(2);
        try {
            Callable<org.springframework.mock.web.MockHttpServletResponse> call=() -> {
                ready.countDown(); if(!go.await(20,TimeUnit.SECONDS))throw new IllegalStateException("장벽 시간 초과");
                return verifyPhoto(d).andReturn().getResponse();
            };
            var first=pool.submit(call); var second=pool.submit(call);
            assertThat(ready.await(20,TimeUnit.SECONDS)).isTrue(); go.countDown();
            var results=List.of(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS));
            assertThat(results).extracting(r -> r.getStatus()).containsExactlyInAnyOrder(200,409);
            for(var result:results) {
                if(result.getStatus()==200)assertThat(result.getContentAsString()).isEqualTo("{\"isVerified\":true}");
                else assertThat(result.getContentAsString()).contains("COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED");
            }
            verify(storage,times(1)).upload(any(),anyString(),anyString()); verify(storage,never()).delete(anyString());
            verify(verifier,times(1)).verify(any(),anyString(),anyString(),anyString(),any());
            var rows=assignmentRows(d.team().getId(),d.card().getId()); assertThat(rows).hasSize(1);
            assertThat(rows.getFirst()).containsEntry("progress_status","COMPLETED");
            assertThat(rows.getFirst().get("completed_at")).isEqualTo(LocalDateTime.now(CLOCK));
            assertThat(snapshot(d.team().getId()).subList(0,2)).isEqualTo(before); assertThat(rewardSnapshot(d.user())).isEqualTo(rewards);
        } finally { go.countDown(); pool.shutdownNow(); assertThat(pool.awaitTermination(30,TimeUnit.SECONDS)).isTrue(); }
    }
}
