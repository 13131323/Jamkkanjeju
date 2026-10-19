package com.jamkkanjeju.server.domain.cooperativemission.support;

import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.http.MediaType;
import org.springframework.transaction.support.TransactionTemplate;

/** 임시 MySQL·실제 JWT와 테스트 전용 데이터 준비·정리를 공유한다. */
@SpringBootTest(properties = {"app.dev-auth.enabled=false", "app.blob-storage.container=test",
        "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Import(CooperativeMissionIntegrationTestSupport.FixedClockConfig.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public abstract class CooperativeMissionIntegrationTestSupport extends MySqlIntegrationTestSupport {
    protected static final String URL = "/api/v2/cooperative-missions/{missionId}/progress";
    protected static final String JOIN_URL = "/api/v2/cooperative-missions/join-requests";
    @Autowired protected MockMvc mvc;
    @Autowired protected EntityManager em;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected JwtTokenProvider tokens;
    @Autowired protected TransactionTemplate transactions;
    private final List<Long> userIds = new ArrayList<>();
    private final List<Long> missionIds = new ArrayList<>();
    private final List<Long> cardIds = new ArrayList<>();

    /** 매 실행마다 유일한 테스트 사용자만 저장한다. */
    protected User user() {
        var user = User.builder().email("coop-" + UUID.randomUUID() + "@example.com")
                .passwordHash("test-hash").point(500).build();
        em.persist(user);
        userIds.add(user.getId());
        return user;
    }

    /** 초기 데이터의 유형 코드로 공통 미션을 저장한다. */
    protected Mission commonMission(MissionTypeCode code) {
        var type = em.createQuery("select t from MissionType t where t.type=:code", MissionType.class)
                .setParameter("code", code).getSingleResult();
        var mission = Mission.builder().missionType(type).build();
        em.persist(mission);
        missionIds.add(mission.getId());
        return mission;
    }

    /** 장소 없는 활성 협동 미션을 저장한다. */
    protected CooperativeMission mission() {
        var mission = CooperativeMission.builder().mission(commonMission(MissionTypeCode.COOPERATIVE))
                .status(MissionActivationStatus.ACTIVE).point(100).build();
        em.persist(mission);
        em.flush();
        return mission;
    }

    /** 기존 두 번째 단계 팀과 본인 참가 기록을 저장한다. */
    protected CooperativeMissionProgress team(User user, CooperativeMission mission,
                                               ParticipantStatus status, ParticipantRole role, boolean completed) {
        return team(user, mission, status, role, 2, completed);
    }

    /** 지정한 단계의 기존 팀과 본인 참가 기록을 저장한다. */
    protected CooperativeMissionProgress team(User user, CooperativeMission mission,
                                               ParticipantStatus status, ParticipantRole role,
                                               int currentStep, boolean completed) {
        var progress = CooperativeMissionProgress.builder().cooperativeMission(mission).currentStep(currentStep)
                .teamToken("fixture-" + UUID.randomUUID()).build();
        if (completed) progress.complete(JOINED_AT);
        em.persist(progress);
        em.persist(participant(user, progress, status, role));
        em.flush();
        return progress;
    }

    /** 기존 팀에 역할 수행 기록을 추가해 시작 요청이 이를 바꾸지 않는지 검증한다. */
    protected void roleProgress(CooperativeMissionProgress progress) {
        var participant = em.createQuery("select p from CooperativeMissionParticipant p where p.cooperativeMissionProgress.id=:id",
                CooperativeMissionParticipant.class).setParameter("id", progress.getId()).getResultList().getFirst();
        var card = CooperativeRoleCard.builder().roleName("테스트 역할").roleDescription("역할 설명")
                .locationToFind(List.of("대상")).build();
        em.persist(card);
        cardIds.add(card.getId());
        em.persist(CooperativeMissionRoleProgress.builder().participant(participant).roleCard(card)
                .itemImgUrl("https://example.com/proof.jpg").progressStatus(MissionProgressStatus.COMPLETED)
                .completedAt(JOINED_AT).build());
    }

    /** JWT를 포함한 실제 HTTP 요청을 보낸다. */
    protected ResultActions start(User user, Object missionId) throws Exception {
        return mvc.perform(post(URL, missionId)
                .header("Authorization", "Bearer " + tokens.createAccessToken(user).value()));
    }

    /** JWT와 팀 토큰을 포함한 URL 참여 요청을 보낸다. */
    protected ResultActions join(User user, String teamToken) throws Exception {
        return mvc.perform(post(JOIN_URL)
                .header("Authorization", "Bearer " + tokens.createAccessToken(user).value())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"teamToken\":\"" + teamToken + "\"}"));
    }

    /** 응답 객체를 필드 수까지 비교 가능한 Map으로 읽는다. */
    protected Map<String, Object> body(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$");
    }

    /** 실제 DB를 다시 조회하도록 준비 변경을 반영하고 영속성 컨텍스트를 비운다. */
    protected void clear() { em.flush(); em.clear(); }

    /** 팀과 모든 참가자·역할 수행 기록을 원본 행 전체로 비교한다. */
    protected List<Object> snapshot(Long id) {
        return List.of(jdbc.queryForList("select * from cooperative_mission_progress where id=?", id),
                jdbc.queryForList("select * from cooperative_mission_participant where cooperative_mission_progress_id=? order by id", id),
                jdbc.queryForList("select r.* from cooperative_mission_role_progress r join cooperative_mission_participant p on p.id=r.cooperative_mission_participant_id where p.cooperative_mission_progress_id=? order by p.id,r.cooperative_role_card_id", id));
    }

    /** 포인트·보상 지급·획득 이력과 역할 수행 전체 개수가 요청으로 변하지 않는지 비교한다. */
    protected List<Object> rewardSnapshot(User user) {
        return List.of(jdbc.queryForObject("select point from user where id=?", Integer.class, user.getId()),
                jdbc.queryForList("select * from mission_reward_status where user_id=? order by mission_id", user.getId()),
                jdbc.queryForList("select * from acquired_ar_character where user_id=?", user.getId()),
                jdbc.queryForList("select * from acquired_coupon where user_id=?", user.getId()),
                count("cooperative_mission_role_progress"));
    }

    /** 테이블 전체 행 수를 읽는다. 테이블명은 테스트 코드의 상수만 전달한다. */
    protected long count(String table) { return jdbc.queryForObject("select count(*) from " + table, Long.class); }

    /** 특정 미션의 팀 수를 읽는다. */
    protected long teamCount(Long missionId) {
        return jdbc.queryForObject("select count(*) from cooperative_mission_progress where cooperative_mission_id=?", Long.class, missionId);
    }

    /** 직접 커밋한 테스트 데이터만 FK 역순으로 정리한다. 일반 테스트는 테스트 트랜잭션이 롤백한다. */
    @AfterEach
    void cleanCommittedData() {
        if (TestTransaction.isActive()) return;
        transactions.executeWithoutResult(tx -> {
            for (Long id : missionIds) {
                jdbc.update("delete r from cooperative_mission_role_progress r join cooperative_mission_participant p on p.id=r.cooperative_mission_participant_id join cooperative_mission_progress g on g.id=p.cooperative_mission_progress_id where g.cooperative_mission_id=?", id);
                jdbc.update("delete p from cooperative_mission_participant p join cooperative_mission_progress g on g.id=p.cooperative_mission_progress_id where g.cooperative_mission_id=?", id);
                jdbc.update("delete from cooperative_mission_progress where cooperative_mission_id=?", id);
                jdbc.update("delete from mission_reward_status where mission_id=?", id);
                jdbc.update("delete from cooperative_mission where mission_id=?", id);
                jdbc.update("delete from mission where id=?", id);
            }
            for (Long id : cardIds) jdbc.update("delete from cooperative_role_card where id=?", id);
            for (Long id : userIds) jdbc.update("delete from user where id=?", id);
        });
    }

    /** JWT와 합류 시각이 같은 고정 시계를 사용한다. */
    @TestConfiguration(proxyBeanMethods = false)
    public static class FixedClockConfig {
        @Bean @Primary
        Clock cooperativeTestClock() { return CLOCK; }
    }
}
