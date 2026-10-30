package com.jamkkanjeju.server.domain.mypage.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·임시 MySQL에서 조각 완성과 후보 제한을 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GetMyPageApiIntegrationTest extends MySqlIntegrationTestSupport {
    static final String URL = "/api/v2/users/me/mypage";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenProvider tokens;

    private User newUser() {
        User user = User.builder().email(UUID.randomUUID()+"@example.com").passwordHash("test").build();
        em.persist(user); em.flush(); return user;
    }
    private String body(User user) throws Exception {
        return mvc.perform(get(URL).header("Authorization", "Bearer "+tokens.createAccessToken(user).value()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }
    private void fragment(User user, Integer mission, String time) {
        jdbc.update("insert into acquired_ar_character(ar_character_id,user_id,mission_id,created_at,updated_at) values(4,?,?,?,?)",
                user.getId(), mission, time, time);
    }

    @Test void 초기사용자_응답과_조회전후_저장값을유지한다() throws Exception {
        var before = jdbc.queryForMap("select * from user where id=1");
        mvc.perform(get(URL).header("Authorization", "Bearer "+tokens.createAccessToken(em.find(User.class,1L)).value()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.completedMissionCount").value(10))
                .andExpect(jsonPath("$.arCharacters", hasSize(6)))
                .andExpect(jsonPath("$.arCharacters[3].acquiredFragmentCount").value(10))
                .andExpect(jsonPath("$.arCharacters[3].isAcquired").value(true))
                .andExpect(jsonPath("$.arCharacters[3].availableMissions", hasSize(0)))
                .andExpect(jsonPath("$.arCharacters[4].availableMissions[0].missionId").value(31))
                .andExpect(jsonPath("$.profile.characterImgUrl").isNotEmpty())
                .andExpect(jsonPath("$.profile.selectedArCharacter").doesNotExist())
                .andExpect(jsonPath("$.arCharacters[0].acquiredLocation").doesNotExist())
                .andExpect(jsonPath("$.arCharacters[0].acquiredMissions").doesNotExist());
        assertThat(jdbc.queryForMap("select * from user where id=1")).isEqualTo(before);
    }

    @ParameterizedTest @CsvSource({"6,3", "8,2", "9,1", "10,0"})
    void 완료와_기지급을제외한뒤_남은후보만반환한다(int count, int expected) throws Exception {
        User user = newUser();
        jdbc.update("update culture_mission set status='INACTIVE' where mission_id>10");
        for (int i=1;i<=count;i++) {
            fragment(user,i,"2026-10-01 12:00:00");
            jdbc.update("insert into culture_mission_progress(culture_mission_id,user_id,mission_status,current_quiz_index,correct_count,last_completed_at) values(?,?,'COMPLETED',3,1,'2026-10-01 12:00:00')",i,user.getId());
        }
        String json = body(user);
        List<Number> missions = JsonPath.read(json,"$.arCharacters[3].availableMissions[*].missionId");
        assertThat(missions).hasSize(expected);
        if(expected>0) assertThat(missions.getFirst().intValue()).isEqualTo(count+1);
        assertThat((Integer)JsonPath.read(json,"$.arCharacters[3].acquiredFragmentCount")).isEqualTo(count);
        assertThat((Boolean)JsonPath.read(json,"$.arCharacters[3].isAcquired")).isEqualTo(count>=10);
    }

    @Test void 초과조각은_실제개수를반환하고_열번째조각날짜를사용한다() throws Exception {
        User user = newUser();
        for(int i=1;i<=12;i++) fragment(user,null,String.format("2026-10-%02d 12:00:00",i));
        String json = body(user);
        assertThat((Integer)JsonPath.read(json,"$.arCharacters[3].acquiredFragmentCount")).isEqualTo(12);
        assertThat((String)JsonPath.read(json,"$.arCharacters[3].acquiredAt")).isEqualTo("2026-10-10");
        jdbc.update("update ar_character set required_fragment_count=15 where id=4");
        em.clear();
        json=body(user);
        assertThat((Boolean)JsonPath.read(json,"$.arCharacters[3].isAcquired")).isFalse();
        assertThat((Object)JsonPath.read(json,"$.arCharacters[3].acquiredAt")).isNull();
    }

    @Test void 인증없는요청은_공통401이다() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test void 협동미션은_수락된팀만_집계하고_대기는제외한다() throws Exception {
        User user=newUser();
        for(int i=0;i<4;i++) {
            String token=UUID.randomUUID().toString();
            String state=i==2 ? "IN_PROGRESS" : "COMPLETED";
            jdbc.update("insert into cooperative_mission_progress(cooperative_mission_id,current_step,mission_status,team_token) values(31,?,?,?)",i==2?2:3,state,token);
            Long progressId=jdbc.queryForObject("select id from cooperative_mission_progress where team_token=?",Long.class,token);
            jdbc.update("insert into cooperative_mission_participant(cooperative_mission_progress_id,user_id,participant_status,participant_role,joined_at) values(?,?,?,'HOST',CURRENT_TIMESTAMP)",progressId,user.getId(),i==3?"PENDING":"ACCEPTED");
        }
        String json=body(user);
        assertThat((Integer)JsonPath.read(json,"$.summary.completedMissionCount")).isEqualTo(2);
        assertThat((List<?>)JsonPath.read(json,"$.progressMissions")).hasSize(1);
        assertThat((Integer)JsonPath.read(json,"$.progressMissions[0].currentCount")).isEqualTo(2);
        assertThat((List<?>)JsonPath.read(json,"$.arCharacters[4].availableMissions")).isEmpty();
    }

    @Test void 스웨거는_홈의진행도와_다른_응답스키마를유지한다() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.MyPageProgressMissionInfo.properties.currentCount").exists())
                .andExpect(jsonPath("$.components.schemas.GetMyPageResponse.properties.arCharacters").exists());
    }
}
