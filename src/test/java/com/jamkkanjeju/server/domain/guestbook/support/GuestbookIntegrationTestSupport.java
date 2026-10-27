package com.jamkkanjeju.server.domain.guestbook.support;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.client.BlobStorageClient.UploadedBlob;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/** 임시 DB·실제 JWT·고정 UTC Clock과 Mock Blob을 공유하며 직접 커밋한 준비 데이터도 정리한다. */
public abstract class GuestbookIntegrationTestSupport extends MySqlIntegrationTestSupport {
    protected static final String URL = "/api/v2/guestbooks";
    private static final AtomicLong SEQUENCE = new AtomicLong();
    @Autowired protected EntityManager em;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected JwtTokenProvider tokens;
    @Autowired protected TransactionTemplate transactions;
    @MockitoBean protected BlobStorageClient storage;
    @MockitoBean protected Clock clock;
    protected User current;
    protected User other;
    protected Location location;

    @BeforeEach
    void setupData() {
        when(clock.instant()).thenReturn(CLOCK.instant()); when(clock.getZone()).thenReturn(CLOCK.getZone());
        clearInvocations(storage);
        when(storage.upload(any(), anyString(), anyString())).thenAnswer(invocation ->
                new UploadedBlob(invocation.getArgument(1), "https://example.invalid/media/" + invocation.getArgument(1)));
        transactions.execute(status -> {
            long sequence = SEQUENCE.incrementAndGet();
            current = persist(User.builder().email("create-book-" + sequence + "@example.com").passwordHash("test").point(17).build());
            other = persist(User.builder().email("create-book-other-" + sequence + "@example.com").passwordHash("test").point(18).build());
            location = persist(Location.builder().contentId(9_300_000_000L + sequence).title("작성 장소").address("제주")
                    .category("관광지").latitude(33).longitude(126).radius(100).build());
            persist(VisitedLocation.builder().user(current).location(location).lastVisitedAt(NOW.minusDays(3)).build());
            em.flush(); return null;
        });
    }

    protected <T> T persist(T entity) { em.persist(entity); return entity; }
    protected String bearer(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }
    protected void reload() { em.flush(); em.clear(); }
    protected List<Map<String, Object>> rows() { return jdbc.queryForList("select * from guestbook where user_id=? order by id", current.getId()); }

    /** 새로 작성될 방명록을 제외한 기존 사용자·방문·미션·보상·방명록을 비교한다. */
    protected List<Object> snapshot() {
        List<Object> result = new ArrayList<>();
        for (String table : List.of("user", "visited_location", "location", "mission", "culture_mission_progress",
                "treasure_mission_progress", "cooperative_mission_progress", "cooperative_mission_participant",
                "mission_reward_status", "acquired_ar_character", "acquired_coupon")) result.add(jdbc.queryForList("select * from " + table));
        result.add(jdbc.queryForList("select * from guestbook where user_id is null or user_id<>?", current.getId()));
        return result;
    }

    /** NOT_SUPPORTED 테스트에서만 직접 커밋한 이번 사용자·장소·방명록을 정리한다. */
    @AfterEach
    void cleanupCommittedData() {
        if (current == null || TransactionSynchronizationManager.isActualTransactionActive()) return;
        jdbc.update("delete from guestbook where user_id in (?, ?)", current.getId(), other.getId());
        jdbc.update("delete from visited_location where user_id in (?, ?)", current.getId(), other.getId());
        jdbc.update("delete from location where id=?", location.getId());
        jdbc.update("delete from user where id in (?, ?)", current.getId(), other.getId());
    }
}
