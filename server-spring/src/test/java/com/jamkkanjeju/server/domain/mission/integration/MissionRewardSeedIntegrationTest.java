package com.jamkkanjeju.server.domain.mission.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** 협동·보물찾기 초기 미션의 세 보상과 쿠폰 사용 장소를 검증한다. */
@SpringBootTest
@Transactional
class MissionRewardSeedIntegrationTest extends MySqlIntegrationTestSupport {
    @Autowired JdbcTemplate jdbc;

    @ParameterizedTest
    @CsvSource({"cooperative_mission,5,200,4,2,2000", "treasure_mission,6,100,5,1,1000"})
    void 초기미션의_보상3종과_쿠폰장소가_설정되어있다(
            String table, int characterId, int point, int couponId, int locationId, int price) {
        assertThat(jdbc.queryForObject("select count(*) from " + table + " m "
                + "join ar_character a on a.id=m.ar_character_id "
                + "join coupon c on c.id=m.coupon_id "
                + "where m.ar_character_id=? and m.point=? and m.coupon_id=? "
                + "and m.location_id=? and c.location_id=m.location_id and c.coupon_price=?",
                Integer.class, characterId, point, couponId, locationId, price)).isEqualTo(1);
    }
}
