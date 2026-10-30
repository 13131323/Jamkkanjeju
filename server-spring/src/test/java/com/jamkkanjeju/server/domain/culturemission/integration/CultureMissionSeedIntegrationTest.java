package com.jamkkanjeju.server.domain.culturemission.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** 문화미션 1~10번을 정답 1개로 완료하고 캐릭터만 받은 초기 데이터를 검증한다. */
@SpringBootTest
@Transactional
class CultureMissionSeedIntegrationTest extends MySqlIntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;

    @Test void 사용자1은_문화미션10개를_정답1개로_완료했다() {
        assertThat(jdbc.queryForList("""
                select culture_mission_id from culture_mission_progress
                where user_id=1 and mission_status='COMPLETED'
                  and current_quiz_index=3 and correct_count=1 and last_completed_at is not null
                order by culture_mission_id
                """, Long.class)).containsExactly(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);
    }

    @Test void 캐릭터만_지급완료이며_각미션의_실제획득기록이있다() {
        assertThat(jdbc.queryForList("""
                select mission_id from mission_reward_status
                where user_id=1 and ar_character_reward_granted=true
                  and point_reward_granted=false and coupon_reward_granted=false
                order by mission_id
                """, Long.class)).containsExactly(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);
        assertThat(jdbc.queryForObject("""
                select count(*) from acquired_ar_character a
                join culture_mission c on c.mission_id=a.mission_id and c.ar_character_id=a.ar_character_id
                where a.user_id=1 and a.mission_id between 1 and 10
                """, Integer.class)).isEqualTo(10);
    }

    @Test void 포인트와_기존쿠폰보유내역은_유지한다() {
        assertThat(jdbc.queryForObject("select point from user where id=1", Integer.class)).isZero();
        assertThat(jdbc.queryForList("select coupon_id from acquired_coupon where user_id=1 order by coupon_id", Long.class))
                .containsExactly(1L, 2L);
    }
}
