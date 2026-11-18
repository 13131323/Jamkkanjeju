package com.jamkkanjeju.server.domain.agent.integration;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.agent.dto.SyncLocationsRequest;
import com.jamkkanjeju.server.domain.agent.entity.LocationSyncExecution;
import com.jamkkanjeju.server.domain.agent.repository.LocationSyncExecutionRepository;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.home.entity.*;
import com.jamkkanjeju.server.domain.map.entity.*;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import jakarta.persistence.EntityManager;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/** 실제 임시 MySQL에서 승인 대상만 반영하고 실패·중복 시 원자성을 유지하는지 확인한다. */
@SpringBootTest(properties = {"app.agent.token=sync-test-secret", "app.blob-storage.container=sync-test"})
@AutoConfigureMockMvc
class AgentLocationSyncApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/agent/locations/sync";
    private static final AtomicLong CONTENT = new AtomicLong(9_900_000_000L);
    @Autowired MockMvc mvc;
    @Autowired JsonMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @Autowired TransactionTemplate transactions;
    @Autowired JwtTokenProvider tokens;
    @MockitoSpyBean LocationSyncExecutionRepository executions;
    private final List<Fixture> createdFixtures = new ArrayList<>();
    private final List<Long> additionIds = new ArrayList<>();
    private final List<String> requestIds = new ArrayList<>();

    @AfterEach void removeOnlyOwnData() {
        transactions.executeWithoutResult(status -> {
            for (Fixture fixture : createdFixtures) {
                jdbc.update("delete from guestbook where id=?", fixture.guestbookId());
                jdbc.update("delete from mission where id in (?,?)", fixture.treasureId(), fixture.cooperativeId());
                jdbc.update("delete from `user` where id=?", fixture.userId());
                jdbc.update("delete from coupon where id=?", fixture.couponId());
                jdbc.update("delete from location where id=?", fixture.locationId());
            }
            for (Long id : additionIds) jdbc.update("delete from location where content_id=?", id);
            for (String id : requestIds) jdbc.update("delete from agent_location_sync_execution where request_id=?", id);
        });
    }

    record Fixture(long locationId, long contentId, long userId, long treasureId, long cooperativeId,
                   long treasureProgressId, long cooperativeProgressId, long participantId,
                   long couponId, long guestbookId) {}

    private <T> T persist(T entity) { em.persist(entity); return entity; }
    private Mission mission(MissionTypeCode type) {
        MissionType missionType = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class)
                .setParameter("type", type).getSingleResult();
        return persist(Mission.builder().missionType(missionType).build());
    }
    private Fixture fixture() {
        Fixture fixture = transactions.execute(status -> {
            long contentId = CONTENT.incrementAndGet();
            Location location = persist(location(null, contentId));
            User user = persist(user(null, "sync-" + UUID.randomUUID() + "@example.com"));
            Coupon coupon = persist(Coupon.builder().location(location).couponPrice(1000).build());
            ArCharacter character = em.createQuery("select c from ArCharacter c order by c.id", ArCharacter.class).setMaxResults(1).getSingleResult();
            Mission treasureDefinition = mission(MissionTypeCode.TREASURE);
            TreasureMission treasure = persist(TreasureMission.builder().mission(treasureDefinition).location(location)
                    .status(MissionActivationStatus.ACTIVE).itemTotalCount(3).arCharacter(character).point(100).coupon(coupon).build());
            TreasureMissionProgress treasureProgress = persist(TreasureMissionProgress.builder().treasureMission(treasure)
                    .user(user).foundItemCount(0).missionStatus(MissionProgressStatus.IN_PROGRESS).build());
            persist(TreasureMissionProgressItem.builder().treasureMissionProgress(treasureProgress).itemIndex(1)
                    .latitude(33.5).longitude(126.5).build());
            Mission cooperativeDefinition = mission(MissionTypeCode.COOPERATIVE);
            CooperativeMission cooperative = persist(CooperativeMission.builder().mission(cooperativeDefinition).location(location)
                    .status(MissionActivationStatus.ACTIVE).arCharacter(character).point(100).coupon(coupon).build());
            CooperativeMissionProgress cooperativeProgress = persist(CooperativeMissionProgress.builder().cooperativeMission(cooperative)
                    .currentStep(1).missionStatus(MissionProgressStatus.IN_PROGRESS).teamToken(UUID.randomUUID().toString()).build());
            CooperativeMissionParticipant participant = persist(CooperativeMissionParticipant.builder().cooperativeMissionProgress(cooperativeProgress)
                    .user(user).participantStatus(ParticipantStatus.ACCEPTED).participantRole(ParticipantRole.HOST).joinedAt(TIME).build());
            CooperativeRoleCard role = em.createQuery("select c from CooperativeRoleCard c order by c.id", CooperativeRoleCard.class).setMaxResults(1).getSingleResult();
            persist(CooperativeMissionRoleProgress.builder().participant(participant).roleCard(role).build());
            for (Mission definition : List.of(treasureDefinition, cooperativeDefinition)) {
                var reward = MissionRewardStatus.builder().mission(definition).user(user).build();
                reward.grantArCharacterReward(); reward.grantPointReward(); reward.grantCouponReward(); persist(reward);
                persist(AcquiredArCharacter.builder().arCharacter(character).user(user).mission(definition).build());
            }
            persist(AcquiredCoupon.builder().coupon(coupon).user(user).acquiredAt(TIME).build());
            VisitedLocation visit = persist(VisitedLocation.builder().user(user).location(location).lastVisitedAt(TIME).build());
            Guestbook book = persist(guestbook(null, user, GuestbookStatus.ACTIVE, DATE));
            persist(LocationGuestbook.builder().guestbook(book).visitedLocation(visit).mission(treasureDefinition).build());
            em.flush();
            return new Fixture(location.getId(), contentId, user.getId(), treasure.getMissionId(), cooperative.getMissionId(),
                    treasureProgress.getId(), cooperativeProgress.getId(), participant.getId(), coupon.getId(), book.getId());
        });
        createdFixtures.add(fixture);
        return fixture;
    }
    private SyncLocationsRequest request(Fixture target) {
        var addition = new SyncLocationsRequest.AddedLocation(CONTENT.incrementAndGet(), "새 장소", "제주시", "음식", 100, 33.5, 126.5);
        var request = new SyncLocationsRequest("location-sync-" + UUID.randomUUID().toString().replace("-", ""), "db-test", "tourapi-test",
                List.of(addition), List.of(new SyncLocationsRequest.DeletedLocation(target.locationId(), target.contentId())));
        additionIds.add(addition.contentId());
        requestIds.add(request.requestId());
        return request;
    }
    private ResultActions send(SyncLocationsRequest request) throws Exception {
        return mvc.perform(post(URL).header("X-Agent-Token", "sync-test-secret").header("Idempotency-Key", request.requestId())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)));
    }
    private long count(String table, String column, Object id) {
        return jdbc.queryForObject("select count(*) from " + table + " where " + column + "=?", Long.class, id);
    }

    @Test void insertsDeletesAndCleansOnlyRelatedMissionsWhileKeepingGrantedRewards() throws Exception {
        Fixture target = fixture(), untouched = fixture();
        var request = request(target);
        send(request).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.addedContentIds[0]").value(request.addLocations().getFirst().contentId()))
                .andExpect(jsonPath("$.deletedContentIds[0]").value(target.contentId()));
        assertThat(count("location", "id", target.locationId())).isZero();
        assertThat(count("location", "content_id", request.addLocations().getFirst().contentId())).isEqualTo(1);
        for (String table : List.of("treasure_mission", "cooperative_mission")) {
            long id = table.equals("treasure_mission") ? target.treasureId() : target.cooperativeId();
            assertThat(jdbc.queryForObject("select status from " + table + " where mission_id=?", String.class, id)).isEqualTo("INACTIVE");
            assertThat(jdbc.queryForObject("select location_id from " + table + " where mission_id=?", Long.class, id)).isNull();
            assertThat(count("mission_reward_status", "mission_id", id)).isZero();
            assertThat(count("mission", "id", id)).isEqualTo(1);
        }
        assertThat(count("treasure_mission_progress", "id", target.treasureProgressId())).isZero();
        assertThat(count("treasure_mission_progress_item", "treasure_mission_progress_id", target.treasureProgressId())).isZero();
        assertThat(count("cooperative_mission_progress", "id", target.cooperativeProgressId())).isZero();
        assertThat(count("cooperative_mission_participant", "id", target.participantId())).isZero();
        assertThat(count("cooperative_mission_role_progress", "cooperative_mission_participant_id", target.participantId())).isZero();
        assertThat(count("acquired_ar_character", "user_id", target.userId())).isEqualTo(2);
        assertThat(count("acquired_coupon", "user_id", target.userId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select point from `user` where id=?", Integer.class, target.userId())).isEqualTo(17);
        assertThat(jdbc.queryForObject("select location_id from coupon where id=?", Long.class, target.couponId())).isNull();
        assertThat(count("guestbook", "id", target.guestbookId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select visited_location_id from location_guestbook where guestbook_id=?", Long.class, target.guestbookId())).isNull();
        assertThat(count("treasure_mission_progress", "id", untouched.treasureProgressId())).isEqualTo(1);
    }

    @Test void replayReturnsOriginalResultAndChangedBodyConflicts() throws Exception {
        Fixture target = fixture(); var request = request(target);
        String first = send(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(send(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).isEqualTo(first);
        var changed = new SyncLocationsRequest(request.requestId(), request.storedSnapshotId(), "different-snapshot", request.addLocations(), request.deleteLocations());
        send(changed).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LOCATION_SYNC_CONFLICT"));
        assertThat(count("agent_location_sync_execution", "request_id", request.requestId())).isEqualTo(1);
    }

    @Test void wrongDeletionIdentityOrExistingAdditionLeavesEverythingUnchanged() throws Exception {
        Fixture target = fixture(); var request = request(target);
        var wrong = new SyncLocationsRequest(request.requestId(), "db-test", "tourapi-test", request.addLocations(),
                List.of(new SyncLocationsRequest.DeletedLocation(target.locationId(), target.contentId() + 999)));
        send(wrong).andExpect(status().isConflict());
        assertThat(count("treasure_mission_progress", "id", target.treasureProgressId())).isEqualTo(1);
        assertThat(count("agent_location_sync_execution", "request_id", request.requestId())).isZero();
        var original = request.addLocations().getFirst();
        var duplicate = new SyncLocationsRequest(request.requestId(), "db-test", "tourapi-test",
                List.of(new SyncLocationsRequest.AddedLocation(target.contentId(), original.title(), original.address(), "음식", 100, 33.5, 126.5)), List.of());
        send(duplicate).andExpect(status().isConflict());
        assertThat(count("location", "id", target.locationId())).isEqualTo(1);
    }

    @Test void failureAfterDeletesRollsBackPlacesMissionsChildrenAndExecution() throws Exception {
        Fixture target = fixture(); var request = request(target);
        doThrow(new IllegalStateException("forced final write failure")).when(executions).saveAndFlush(any(LocationSyncExecution.class));
        send(request).andExpect(status().isInternalServerError());
        assertThat(count("location", "id", target.locationId())).isEqualTo(1);
        assertThat(count("location", "content_id", request.addLocations().getFirst().contentId())).isZero();
        assertThat(count("treasure_mission_progress", "id", target.treasureProgressId())).isEqualTo(1);
        assertThat(count("cooperative_mission_participant", "id", target.participantId())).isEqualTo(1);
        assertThat(count("mission_reward_status", "mission_id", target.treasureId())).isEqualTo(1);
        assertThat(count("agent_location_sync_execution", "request_id", request.requestId())).isZero();
        assertThat(jdbc.queryForObject("select status from treasure_mission where mission_id=?", String.class, target.treasureId())).isEqualTo("ACTIVE");
    }

    @Test void authHeaderAndInvalidPlansAreRejected() throws Exception {
        Fixture target = fixture(); var request = request(target); String json = mapper.writeValueAsString(request);
        mvc.perform(post(URL).header("Idempotency-Key", request.requestId()).contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isUnauthorized());
        mvc.perform(post(URL).header("X-Agent-Token", "wrong").header("Idempotency-Key", request.requestId()).contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isUnauthorized());
        String jwt = transactions.execute(status -> tokens.createAccessToken(em.find(User.class, target.userId())).value());
        mvc.perform(post(URL).header("Authorization", "Bearer " + jwt).header("Idempotency-Key", request.requestId()).contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isUnauthorized());
        mvc.perform(post(URL).header("X-Agent-Token", "sync-test-secret").header("Idempotency-Key", "different").contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isBadRequest());
        mvc.perform(post(URL).header("X-Agent-Token", "sync-test-secret").header("Idempotency-Key", request.requestId()).contentType(MediaType.APPLICATION_JSON).content(json.replace("\"radius\":100", "\"radius\":-1"))).andExpect(status().isBadRequest());
        assertThat(count("location", "id", target.locationId())).isEqualTo(1);
    }

    @Test void concurrentSameRequestExecutesOnce() throws Exception {
        Fixture target = fixture(); var request = request(target);
        try (var pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            Callable<String> call = () -> { start.await(); return send(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(); };
            var first = pool.submit(call); var second = pool.submit(call); start.countDown();
            assertThat(first.get(15, TimeUnit.SECONDS)).isEqualTo(second.get(15, TimeUnit.SECONDS));
        }
        assertThat(count("agent_location_sync_execution", "request_id", request.requestId())).isEqualTo(1);
        assertThat(count("location", "content_id", request.addLocations().getFirst().contentId())).isEqualTo(1);
    }
}
