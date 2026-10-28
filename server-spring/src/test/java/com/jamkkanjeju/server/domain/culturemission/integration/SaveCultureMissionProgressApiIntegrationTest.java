package com.jamkkanjeju.server.domain.culturemission.integration;

import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.culturemission.entity.*;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.home.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

/** 실제 JWT·HTTP·MySQL로 저장과 보상, 재요청·격리 및 서비스 트랜잭션 롤백을 검증한다. */
@SpringBootTest(properties={
    "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
    "app.jwt.access-token-expiration=30m", "app.jwt.refresh-token-expiration=14d",
    "app.dev-auth.enabled=false", "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Transactional
class SaveCultureMissionProgressApiIntegrationTest extends MySqlIntegrationTestSupport {
    static final String URL="/api/v2/culture-missions/{id}/progress";
    static final LocalDateTime PREVIOUS=LocalDateTime.of(2026,10,1,12,0);
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider tokens;
    @Autowired SecretKey jwtSigningKey;
    @Autowired JwtProperties jwtProperties;
    @Autowired EntityManager em;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean TourApiClient images;
    @MockitoSpyBean NextLocationRecommender recommender;

    /** 저장 API만을 위한 사용자·미션·퀴즈·진행도·추천 장소와 보상을 준비한다. */
    private Data data(int quizCount, int index, int correctCount) {
        User user=User.builder().email("save-cm-"+UUID.randomUUID()+"@example.com").passwordHash("{test}").nickname("저장테스트").build();
        em.persist(user);
        Location location=Location.builder().contentId(8_000_000_000L+System.nanoTime()%1_000_000_000L)
            .title("저장테스트 장소").address("테스트 주소").category("관광지").radius(50).latitude(10).longitude(10).build();
        em.persist(location);
        Coupon coupon=Coupon.builder().location(location).couponPrice(3000).build();em.persist(coupon);
        ArCharacter character=em.createQuery("select a from ArCharacter a order by a.id",ArCharacter.class).setMaxResults(1).getSingleResult();
        Mission common=common(MissionTypeCode.CULTURE);
        CultureMission mission=CultureMission.builder().mission(common).status(MissionActivationStatus.ACTIVE)
            .arCharacter(character).point(100).coupon(coupon).build();em.persist(mission);em.flush();
        for(int i=1;i<=quizCount;i++) em.persist(CultureMissionQuiz.builder().cultureMission(mission).quizIndex(i)
            .question("문제 "+i).answer("정답"+i).explanation(i==1?null:"해설"+i).build());
        CultureMissionProgress progress=CultureMissionProgress.builder().user(user).cultureMission(mission)
            .missionStatus(MissionProgressStatus.IN_PROGRESS).currentQuizIndex(index).correctCount(correctCount)
            .lastCompletedAt(PREVIOUS).build();em.persist(progress);em.flush();
        return new Data(user,mission,progress,location,coupon);
    }
    private Mission common(MissionTypeCode code) {
        var type=em.createQuery("select t from MissionType t where t.type=:type",MissionType.class).setParameter("type",code).getSingleResult();
        var mission=Mission.builder().missionType(type).build();em.persist(mission);return mission;
    }
    private record Data(User user,CultureMission mission,CultureMissionProgress progress,Location location,Coupon coupon) {}
    private String bearer(User user) { return "Bearer "+tokens.createAccessToken(user).value(); }
    private ResultActions save(Data d,int index,String answer) throws Exception {
        return mvc.perform(patch(URL,d.progress().getId()).header("Authorization",bearer(d.user()))
            .param("latitude","10").param("longitude","10").contentType(MediaType.APPLICATION_JSON)
            .content("{\"quizIndex\":"+index+",\"answer\":\""+answer+"\"}"));
    }
    private void reload() { em.flush();em.clear(); }
    private CultureMissionProgress progress(Data d) { return em.find(CultureMissionProgress.class,d.progress().getId()); }
    private MissionRewardStatus rewardStatus(Data d) {
        return em.find(MissionRewardStatus.class,new MissionRewardStatusId(d.mission().getMissionId(), d.user().getId()));
    }
    private long acquired(String entity,Data d) {
        return em.createQuery("select count(a) from "+entity+" a where a.user.id=:id",Long.class)
            .setParameter("id",d.user().getId()).getSingleResult();
    }
    private void unchanged(Data d) {
        reload();assertThat(progress(d).getCurrentQuizIndex()).isEqualTo(d.progress().getCurrentQuizIndex());
        assertThat(progress(d).getCorrectCount()).isEqualTo(d.progress().getCorrectCount());
        assertThat(progress(d).getLastCompletedAt()).isEqualTo(PREVIOUS);
        assertThat(em.find(User.class,d.user().getId()).getPoint()).isZero();
    }
    private ResultActions error(ResultActions result,int status,String code,String message) throws Exception {
        return result.andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code)).andExpect(jsonPath("$.message").value(message));
    }
    @Test void inProgressResponseAndDatabaseReflectOnlySubmittedQuiz() throws Exception {
        Data d=data(3,1,0);reload();
        var result=save(d,1,"정답1").andExpect(status().isOk()).andExpect(jsonPath("$.isCorrect").value(true))
            .andExpect(jsonPath("$.answer").value("정답1")).andExpect(jsonPath("$.explanation").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.missionProgressStatus").value("IN_PROGRESS"))
            .andExpect(jsonPath("$.quizCount").value(3)).andExpect(jsonPath("$.currentQuizNumber").value(2))
            .andExpect(jsonPath("$.correctNumber").value(1));
        Map<String,Object> body=JsonPath.read(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8),"$");
        assertThat(body).containsOnlyKeys("isCorrect","answer","explanation","missionProgressStatus","quizCount","currentQuizNumber","correctNumber","nextLocation","reward");
        assertThat(body).containsEntry("nextLocation",null).containsEntry("reward",null);
        reload();assertThat(progress(d).getCorrectCount()).isEqualTo(1);assertThat(progress(d).getCurrentQuizIndex()).isEqualTo(2);
        assertThat(progress(d).getLastCompletedAt()).isEqualTo(PREVIOUS);assertThat(rewardStatus(d)).isNull();
        verify(recommender,never()).recommend(anyDouble(),anyDouble());verifyNoInteractions(images);
        assertThat(acquired("AcquiredArCharacter",d)).isZero();assertThat(acquired("AcquiredCoupon",d)).isZero();
    }
    @Test void wrongAnswerAdvancesWithoutIncreasingCountAndRepeatIsConflict() throws Exception {
        Data d=data(3,1,0);reload();
        save(d,1,"오답").andExpect(status().isOk()).andExpect(jsonPath("$.isCorrect").value(false));reload();
        error(save(d,1,"정답1"),409,"CULTURE_MISSION_QUIZ_INDEX_MISMATCH","현재 풀어야 하는 퀴즈 번호와 일치하지 않습니다.");
        reload();assertThat(progress(d).getCurrentQuizIndex()).isEqualTo(2);assertThat(progress(d).getCorrectCount()).isZero();
    }
    @Test void completionPersistsAllRewardsAndCannotBeResubmitted() throws Exception {
        Data d=data(3,3,2);reload();
        var before=LocalDateTime.now().minusSeconds(2);
        save(d,3,"정답3").andExpect(status().isOk()).andExpect(jsonPath("$.missionProgressStatus").value("COMPLETED"))
            .andExpect(jsonPath("$.currentQuizNumber").value(3)).andExpect(jsonPath("$.correctNumber").value(3))
            .andExpect(jsonPath("$.explanation").value("해설3"))
            .andExpect(jsonPath("$.reward.arCharacter.id").value(d.mission().getArCharacter().getId()))
            .andExpect(jsonPath("$.reward.point").value(100)).andExpect(jsonPath("$.reward.coupon.couponPrice").value(3000))
            .andExpect(jsonPath("$.reward.coupon.couponLocation").value("저장테스트 장소"))
            .andExpect(jsonPath("$.nextLocation.id").value(d.location().getId()))
            .andExpect(jsonPath("$.nextLocation.distanceMeter").value(0))
            .andExpect(jsonPath("$.nextLocation.mission").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.nextLocation.locationImageUrl").value(org.hamcrest.Matchers.nullValue()));
        reload();assertThat(progress(d).getLastCompletedAt()).isAfter(before);
        assertThat(progress(d).getMissionStatus()).isEqualTo(MissionProgressStatus.COMPLETED);
        assertThat(em.find(User.class,d.user().getId()).getPoint()).isEqualTo(100);
        assertThat(acquired("AcquiredArCharacter",d)).isEqualTo(1);assertThat(acquired("AcquiredCoupon",d)).isEqualTo(1);
        assertThat(rewardStatus(d).isArCharacterRewardGranted()).isTrue();assertThat(rewardStatus(d).isPointRewardGranted()).isTrue();assertThat(rewardStatus(d).isCouponRewardGranted()).isTrue();
        var acquired=em.createQuery("select a from AcquiredArCharacter a where a.user.id=:id",AcquiredArCharacter.class).setParameter("id",d.user().getId()).getSingleResult();
        assertThat(acquired.getMission().getId()).isEqualTo(d.mission().getMissionId());
        error(save(d,3,"정답3"),404,"CULTURE_MISSION_PROGRESS_NOT_FOUND","진행 중인 문화 미션 진행도를 찾을 수 없습니다.");
        reload();assertThat(em.find(User.class,d.user().getId()).getPoint()).isEqualTo(100);assertThat(acquired("AcquiredCoupon",d)).isEqualTo(1);
    }
    @Test void retriesGrantOnlyRemainingRewardsAndNeverDuplicateOwnedCoupon() throws Exception {
        Data d=data(1,1,0);reload();
        save(d,1,"정답1").andExpect(status().isOk()).andExpect(jsonPath("$.reward.arCharacter.id").isNumber())
            .andExpect(jsonPath("$.reward.point").value(org.hamcrest.Matchers.nullValue()));reload();
        progress(d).restart();reload();
        save(d,1,"정답1").andExpect(status().isOk()).andExpect(jsonPath("$.reward.point").value(100))
            .andExpect(jsonPath("$.reward.arCharacter").value(org.hamcrest.Matchers.nullValue()));reload();
        em.persist(AcquiredCoupon.builder().user(em.find(User.class,d.user().getId())).coupon(em.find(Coupon.class,d.coupon().getId())).acquiredAt(PREVIOUS).build());
        progress(d).restart();reload();
        save(d,1,"정답1").andExpect(status().isOk()).andExpect(jsonPath("$.reward.coupon.couponPrice").value(3000));reload();
        progress(d).restart();reload();
        save(d,1,"정답1").andExpect(status().isOk()).andExpect(jsonPath("$.reward.arCharacter").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.reward.point").value(org.hamcrest.Matchers.nullValue())).andExpect(jsonPath("$.reward.coupon").value(org.hamcrest.Matchers.nullValue()));
        reload();assertThat(acquired("AcquiredArCharacter",d)).isEqualTo(1);assertThat(acquired("AcquiredCoupon",d)).isEqualTo(1);
        assertThat(em.find(User.class,d.user().getId()).getPoint()).isEqualTo(100);
        assertThat(em.find(AcquiredCoupon.class,new AcquiredCouponId(d.coupon().getId(),d.user().getId())).getAcquiredAt()).isEqualTo(PREVIOUS);
    }
    @Test void zeroCorrectCompletesWithEmptyRewardObject() throws Exception {
        Data d=data(1,1,0);reload();
        save(d,1,"오답").andExpect(status().isOk()).andExpect(jsonPath("$.missionProgressStatus").value("COMPLETED"))
            .andExpect(jsonPath("$.reward.arCharacter").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.reward.point").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.reward.coupon").value(org.hamcrest.Matchers.nullValue()));
        reload();assertThat(rewardStatus(d)).isNull();assertThat(em.find(User.class,d.user().getId()).getPoint()).isZero();
    }
    @Test void nextMissionSelectsActiveCandidatesAndExcludesInactiveOnes() throws Exception {
        Data d=data(1,1,0);
        var active=TreasureMission.builder().mission(common(MissionTypeCode.TREASURE)).location(d.location()).itemTotalCount(3).status(MissionActivationStatus.ACTIVE).build();em.persist(active);
        var inactive=CooperativeMission.builder().mission(common(MissionTypeCode.COOPERATIVE)).location(d.location()).status(MissionActivationStatus.INACTIVE).build();em.persist(inactive);reload();
        save(d,1,"정답1").andExpect(status().isOk()).andExpect(jsonPath("$.nextLocation.mission.id").value(active.getMissionId()))
            .andExpect(jsonPath("$.nextLocation.mission.missionType").value("TREASURE"));
    }
    @Test void anotherUsersProgressAndUnknownProgressAreRejectedWithoutChanges() throws Exception {
        Data d=data(2,1,0);Data other=data(2,1,0);reload();
        var request=patch(URL,d.progress().getId()).header("Authorization",bearer(other.user())).param("latitude","10").param("longitude","10")
            .contentType(MediaType.APPLICATION_JSON).content("{\"quizIndex\":1,\"answer\":\"정답1\"}");
        error(mvc.perform(request),404,"CULTURE_MISSION_PROGRESS_NOT_FOUND","진행 중인 문화 미션 진행도를 찾을 수 없습니다.");
        error(mvc.perform(patch(URL,Long.MAX_VALUE).header("Authorization",bearer(d.user())).param("latitude","10").param("longitude","10")
            .contentType(MediaType.APPLICATION_JSON).content("{\"quizIndex\":1,\"answer\":\"정답1\"}")),404,"CULTURE_MISSION_PROGRESS_NOT_FOUND","진행 중인 문화 미션 진행도를 찾을 수 없습니다.");
        unchanged(d);unchanged(other);
    }
    @Test void inactiveMissionRejectsEvenExistingProgress() throws Exception {
        Data d=data(2,1,0);ReflectionTestUtils.setField(d.mission(),"status",MissionActivationStatus.INACTIVE);reload();
        error(save(d,1,"정답1"),404,"CULTURE_MISSION_INACTIVE","비활성화된 문화 미션입니다.");unchanged(d);
    }
    @ParameterizedTest @ValueSource(strings={"{}","{\"quizIndex\":1}","{\"answer\":\"정답1\"}","{", "{\"quizIndex\":\"abc\",\"answer\":\"정답1\"}"})
    void malformedOrMissingBodyFieldsReturn400(String body) throws Exception {
        Data d=data(2,1,0);reload();
        error(mvc.perform(patch(URL,d.progress().getId()).header("Authorization",bearer(d.user())).param("latitude","10").param("longitude","10")
            .contentType(MediaType.APPLICATION_JSON).content(body)),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");unchanged(d);
    }
    @Test void invalidPathAndCoordinatesReturn400() throws Exception {
        Data d=data(2,1,0);reload();
        for(String[] values:new String[][]{{"abc","10","10"},{d.progress().getId().toString(),"91","10"},{d.progress().getId().toString(),"10","181"},{d.progress().getId().toString(),"abc","10"},{d.progress().getId().toString(),"","10"},{d.progress().getId().toString(),"10",""}}) {
            error(mvc.perform(patch(URL,values[0]).header("Authorization",bearer(d.user())).param("latitude",values[1]).param("longitude",values[2])
                .contentType(MediaType.APPLICATION_JSON).content("{\"quizIndex\":1,\"answer\":\"정답1\"}")),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");
        }
        unchanged(d);
    }
    @Test void authenticationErrorsDoNotMutateProgress() throws Exception {
        Data d=data(2,1,0);reload();
        String expired=new JwtTokenProvider(jwtSigningKey,jwtProperties,Clock.offset(Clock.systemDefaultZone(),Duration.ofHours(-1))).createAccessToken(d.user()).value();
        String refresh=tokens.createRefreshToken(d.user()).value();
        User ghost=User.builder().email("ghost-save@example.com").passwordHash("test").build();ReflectionTestUtils.setField(ghost,"id",Long.MAX_VALUE);
        String[] headers={"",bearer(d.user())+"a","Bearer "+expired,"Bearer "+refresh,bearer(ghost)};
        String[] codes={"UNAUTHORIZED","INVALID_TOKEN","EXPIRED_TOKEN","INVALID_TOKEN","UNAUTHORIZED"};
        String[] messages={"인증이 필요합니다.","유효하지 않은 토큰입니다.","만료된 토큰입니다.","유효하지 않은 토큰입니다.","인증이 필요합니다."};
        for(int i=0;i<headers.length;i++) {
            var request=patch(URL,d.progress().getId()).param("latitude","10").param("longitude","10").contentType(MediaType.APPLICATION_JSON).content("{\"quizIndex\":1,\"answer\":\"정답1\"}");
            if(!headers[i].isEmpty())request.header("Authorization",headers[i]);
            error(mvc.perform(request),401,codes[i],messages[i]);
        }
        unchanged(d);
    }
    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void requiredRecommendationFailureRollsBackProgressAndAllGrantedRewards() throws Exception {
        Data d=transactions.execute(tx->data(3,3,2));
        try {
            doReturn(Optional.empty()).when(recommender).recommend(10,10);
            error(save(d,3,"정답3"),500,"INTERNAL_SERVER_ERROR","서버 내부 오류가 발생했습니다.");
            transactions.executeWithoutResult(tx->{
                em.clear();var saved=progress(d);
                assertThat(saved.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
                assertThat(saved.getCurrentQuizIndex()).isEqualTo(3);assertThat(saved.getCorrectCount()).isEqualTo(2);
                assertThat(saved.getLastCompletedAt()).isEqualTo(PREVIOUS);
                assertThat(em.find(User.class,d.user().getId()).getPoint()).isZero();
                assertThat(acquired("AcquiredArCharacter",d)).isZero();assertThat(acquired("AcquiredCoupon",d)).isZero();assertThat(rewardStatus(d)).isNull();
            });
            verify(recommender).recommend(10,10);
        } finally {
            reset(recommender);
            // 커밋해 준비한 이 테스트의 데이터만 FK 순서대로 정리한다.
            jdbc.update("delete from acquired_ar_character where user_id=?",d.user().getId());
            jdbc.update("delete from acquired_coupon where user_id=?",d.user().getId());
            jdbc.update("delete from mission_reward_status where user_id=?",d.user().getId());
            jdbc.update("delete from culture_mission_progress where user_id=?",d.user().getId());
            jdbc.update("delete from culture_mission_quiz where culture_mission_id=?",d.mission().getMissionId());
            jdbc.update("delete from culture_mission where mission_id=?",d.mission().getMissionId());
            jdbc.update("delete from mission where id=?",d.mission().getMissionId());
            jdbc.update("delete from coupon where id=?",d.coupon().getId());
            jdbc.update("delete from location where id=?",d.location().getId());
            jdbc.update("delete from user where id=?",d.user().getId());
        }
    }
}
