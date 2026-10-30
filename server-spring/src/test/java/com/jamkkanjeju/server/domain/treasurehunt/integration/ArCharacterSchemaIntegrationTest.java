package com.jamkkanjeju.server.domain.treasurehunt.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** 임시 MySQL에서 캐릭터 필요 조각 수의 초기값·필수값·10 초과 설정을 검증한다. */
@SpringBootTest
@Transactional
class ArCharacterSchemaIntegrationTest extends MySqlIntegrationTestSupport {
    @Autowired EntityManager entityManager;
    @Autowired JdbcTemplate jdbc;

    @Test void 초기캐릭터_6종의_필요조각수는_모두10이다() {
        assertThat(jdbc.queryForList("select required_fragment_count from ar_character", Integer.class))
                .hasSize(6).containsOnly(10);
    }

    @Test void 필요조각수는_10을넘겨도_저장과조회가가능하다() {
        ArCharacter character = ArCharacter.builder().name("조각 테스트").description("설명")
                .storyTitle("이야기").acquireCondition("조각 수집").imgUrl("https://example.com/character.png")
                .representativeColor("blue").hashtags(List.of("조각")).requiredFragmentCount(15).build();
        entityManager.persist(character);
        entityManager.flush();
        entityManager.clear();
        assertThat(entityManager.find(ArCharacter.class, character.getId()).getRequiredFragmentCount()).isEqualTo(15);
    }

    @Test void 필요조각수는_NULL로저장할수없다() {
        assertThatThrownBy(() -> jdbc.update("update ar_character set required_fragment_count=null where id=1"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
