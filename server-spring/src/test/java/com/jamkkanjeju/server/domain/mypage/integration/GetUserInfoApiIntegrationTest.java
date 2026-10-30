package com.jamkkanjeju.server.domain.mypage.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.onboarding.entity.*;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·임시 MySQL에서 선택 관계·읽기 전용 동작·공통 오류를 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GetUserInfoApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL="/api/v2/users/me";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenProvider tokens;

    private User user(Long resultId) {
        User user=User.builder().email(UUID.randomUUID()+"@example.com").passwordHash("test")
                .nickname("여행자").targetStep(12345).point(77)
                .onboardingResult(resultId==null?null:em.find(OnboardingResult.class,resultId)).build();
        em.persist(user); em.flush(); return user;
    }
    private String token(User user) { return "Bearer "+tokens.createAccessToken(user).value(); }
    private void select(User user,int expectationId,int transportationId,int styleId) {
        em.persist(UserExpectation.builder().user(user).expectation(em.find(Expectation.class,(long)expectationId)).build());
        em.persist(UserTransportation.builder().user(user).transportation(em.find(Transportation.class,(long)transportationId)).build());
        em.persist(UserTravelStyle.builder().user(user).travelStyle(em.find(TravelStyle.class,(long)styleId)).build());
        em.flush(); em.clear();
    }
    private Map<String,Object> getInfo(User user) throws Exception {
        String json=mvc.perform(get(URL).header("Authorization",token(user))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return JsonPath.read(json,"$");
    }
    private Map<String,List<Map<String,Object>>> snapshot(User user) {
        Map<String,List<Map<String,Object>>> rows=new LinkedHashMap<>();
        rows.put("user",jdbc.queryForList("select * from user where id=?",user.getId()));
        for(String table:List.of("user_expectation","user_transportation","user_travel_style","acquired_ar_character","mission_reward_status")) {
            rows.put(table,jdbc.queryForList("select * from "+table+" where user_id=?",user.getId()));
        }
        return rows;
    }

    @Test void 응답7개필드가_현재저장값과일치하고_반복조회는상태를바꾸지않는다() throws Exception {
        User user=user(2L);
        String userType=user.getOnboardingResult().getUserType();
        String image=user.getOnboardingResult().getProfileImgUrl();
        select(user,1,2,1);
        em.persist(UserExpectation.builder().user(em.find(User.class,user.getId())).expectation(em.find(Expectation.class,5L)).build());
        em.flush(); em.clear();
        var before=snapshot(user);
        Map<String,Object> result=getInfo(user);
        assertThat(result).containsOnlyKeys("userType","characterImgUrl","nickname","expectations","transportation","travelStyle","targetStepCount");
        assertThat(result).containsEntry("userType",userType).containsEntry("characterImgUrl",image)
                .containsEntry("nickname","여행자").containsEntry("transportation","BUS")
                .containsEntry("travelStyle","RIGHT_HERE").containsEntry("targetStepCount",12345);
        assertThat(((List<?>)result.get("expectations")).stream().map(Object::toString).toList()).containsExactlyInAnyOrder("PHOTO","CAFE");
        assertThat(getInfo(user)).isEqualTo(result);
        assertThat(snapshot(user)).isEqualTo(before);
    }

    @Test void 온보딩과선택값이없으면_null키와빈배열을유지한다() throws Exception {
        User user=user(null);
        jdbc.update("update user set nickname=null where id=?",user.getId()); em.clear();
        Map<String,Object> result=getInfo(user);
        assertThat(result).containsEntry("userType",null).containsEntry("characterImgUrl",null)
                .containsEntry("nickname",null).containsEntry("transportation",null).containsEntry("travelStyle",null)
                .containsEntry("targetStepCount",12345);
        assertThat((List<?>)result.get("expectations")).isEmpty();
    }

    @Test void 온보딩결과가없어도_여행선택관계는그대로반환한다() throws Exception {
        User user=user(null); select(user,2,1,2);
        Map<String,Object> result=getInfo(user);
        assertThat(result).containsEntry("userType",null).containsEntry("characterImgUrl",null)
                .containsEntry("transportation","WALK").containsEntry("travelStyle","NEAR_AROUND");
        assertThat(result.get("expectations")).isEqualTo(List.of("LOCAL"));
    }

    @Test void 온보딩나중에하기후에는_선택값이비고_기본결과를반환한다() throws Exception {
        User user=user(2L); select(user,1,2,1);
        mvc.perform(patch(URL).header("Authorization",token(user)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        em.flush(); em.clear();
        Map<String,Object> result=getInfo(user);
        assertThat(result).containsEntry("userType","여행자").containsEntry("transportation",null)
                .containsEntry("travelStyle",null).containsEntry("targetStepCount",12345);
        assertThat((List<?>)result.get("expectations")).isEmpty();
    }

    @Test void 다른사용자의프로필과선택값은섞이지않는다() throws Exception {
        User first=user(2L); select(first,1,2,1);
        User second=user(3L); select(second,2,1,2);
        assertThat(getInfo(first)).containsEntry("transportation","BUS").containsEntry("travelStyle","RIGHT_HERE");
        assertThat(getInfo(first).get("expectations")).isEqualTo(List.of("PHOTO"));
        assertThat(getInfo(second)).containsEntry("transportation","WALK").containsEntry("travelStyle","NEAR_AROUND");
        assertThat(getInfo(second).get("expectations")).isEqualTo(List.of("LOCAL"));
    }

    @Test void 인증누락과잘못된토큰은_공통401이며_저장상태를유지한다() throws Exception {
        User user=user(2L); var before=snapshot(user);
        mvc.perform(get(URL)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get(URL).header("Authorization","Bearer invalid")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        assertThat(snapshot(user)).isEqualTo(before);
    }

    @Test void 토큰사용자가삭제되었으면_공통인증오류다() throws Exception {
        User user=user(null); String header=token(user);
        jdbc.update("delete from user where id=?",user.getId()); em.clear();
        mvc.perform(get(URL).header("Authorization",header)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test void 스웨거의GET응답은전용7개필드이고_기존PATCH도유지한다() throws Exception {
        String json=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String,Object> properties=JsonPath.read(json,"$.components.schemas.GetUserInfoResponse.properties");
        assertThat(properties).containsOnlyKeys("userType","characterImgUrl","nickname","expectations","transportation","travelStyle","targetStepCount");
        mvc.perform(get("/v3/api-docs")).andExpect(jsonPath("$.paths['/api/v2/users/me'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v2/users/me'].patch.requestBody").exists());
    }
}
