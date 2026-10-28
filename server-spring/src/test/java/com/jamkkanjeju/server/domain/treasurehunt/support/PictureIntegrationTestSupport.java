package com.jamkkanjeju.server.domain.treasurehunt.support;

import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.client.BlobStorageClient.UploadedBlob;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.treasurehunt.entity.PictureWithCharacter;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

/** 사진 통합 테스트의 임시 DB·고정 시각·사용자와 외부 업로드 Mock을 공유한다. */
public abstract class PictureIntegrationTestSupport extends MySqlIntegrationTestSupport {
    protected static final String URL = "/api/v2/treasure-missions/pictures-with-character";
    protected static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-19T03:00:00Z"), ZoneOffset.UTC);
    protected static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 19, 12, 0);
    private static final AtomicLong SEQUENCE = new AtomicLong();
    @Autowired protected EntityManager em;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected JwtTokenProvider tokens;
    @Autowired protected TransactionTemplate transactions;
    @MockitoBean protected BlobStorageClient storage;

    /** 외부 스토리지 호출 없이 생성한 이름에 대응하는 접근 URL을 반환한다. */
    @BeforeEach
    void mockStorage() {
        // 이전 테스트의 트랜잭션 종료 콜백은 Mockito 초기화 이후 실행될 수 있다.
        clearInvocations(storage);
        when(storage.upload(any(), anyString(), anyString())).thenAnswer(invocation -> {
            String name = invocation.getArgument(1);
            return new UploadedBlob(name, "https://example.invalid/test-media/" + name);
        });
    }

    /** UTC Clock을 주입해 서비스가 명시적으로 KST를 저장하는지 확인한다. */
    @TestConfiguration(proxyBeanMethods = false)
    public static class FixedTime {
        @Bean @Primary Clock pictureTestClock() { return CLOCK; }
    }

    /** 현재·타 사용자 및 보존 여부를 확인할 기존 사진 두 건을 준비한다. */
    protected Data data() {
        long sequence = SEQUENCE.incrementAndGet();
        User user = User.builder().email("picture-" + sequence + "@example.com").passwordHash("test").point(10).build();
        User other = User.builder().email("picture-other-" + sequence + "@example.com").passwordHash("test").point(20).build();
        em.persist(user); em.persist(other);
        var old = PictureWithCharacter.builder().user(user).pictureUrl("https://example.invalid/old.png")
                .savedAt(NOW.minusDays(1)).build();
        var otherOld = PictureWithCharacter.builder().user(other).pictureUrl("https://example.invalid/other.png")
                .savedAt(NOW.minusDays(2)).build();
        em.persist(old); em.persist(otherOld); em.flush();
        return new Data(user, other, old.getId(), otherOld.getId());
    }

    /** 실제 액세스 토큰을 발급한다. */
    protected String bearer(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }

    /** 이번 사용자 사진 기록을 실제 DB에서 번호순으로 읽는다. */
    protected List<Map<String, Object>> rows(Data d) {
        return jdbc.queryForList("select * from picture_with_character where user_id=? order by id", d.user().getId());
    }

    /** 기존 두 사용자의 사진과 포인트·진행도·보상 관련 데이터 상태를 비교한다. */
    protected List<Object> snapshot(Data d) {
        var related = new ArrayList<Object>();
        related.add(jdbc.queryForList("select id, point from user where id in (?, ?) order by id", d.user().getId(), d.other().getId()));
        for (String table : List.of("treasure_mission_progress", "treasure_mission_progress_item", "culture_mission_progress",
                "cooperative_mission_progress", "mission_reward_status", "acquired_ar_character", "acquired_coupon")) {
            related.add(jdbc.queryForList("select * from " + table));
        }
        return List.of(jdbc.queryForList("select * from picture_with_character where id in (?, ?) order by id", d.oldId(), d.otherId()), related);
    }

    /** 직접 커밋한 이번 사진·사용자만 정리한다. */
    protected void clean(Data d) {
        jdbc.update("delete from picture_with_character where user_id in (?, ?)", d.user().getId(), d.other().getId());
        jdbc.update("delete from user where id in (?, ?)", d.user().getId(), d.other().getId());
    }

    /** 영속성 컨텍스트를 비워 실제 DB 저장 값을 다시 읽는다. */
    protected void reload() { em.flush(); em.clear(); }

    /** 이번 테스트가 소유하는 사용자와 기존 사진 식별자이다. */
    protected record Data(User user, User other, Long oldId, Long otherId) {
    }
}
