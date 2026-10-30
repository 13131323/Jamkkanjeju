package com.jamkkanjeju.server.domain.map.integration;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·HTTP·JPA·임시 MySQL에서 지도 모달 응답과 조회 전용 데이터 보존을 검증한다. */
@SpringBootTest(properties = {
        "app.dev-auth.enabled=false", "app.blob-storage.container=media",
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m", "app.jwt.refresh-token-expiration=14d",
        "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Transactional
class GetMapModalApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/map/modals";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenProvider tokens;
    @Autowired TravelEstimator travel;
    @MockitoBean Clock clock;
    @MockitoBean TourApiClient images;
    @MockitoSpyBean MissionRewardStatusRepository rewards;
    User current;
    Location location;
    int sequence;

    @BeforeEach
    void setup() {
        when(clock.instant()).thenReturn(Instant.parse("2026-10-26T03:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
        when(images.getLocationImageUrl(anyLong())).thenReturn("https://example.com/location.jpg");
        current = newUser();
        location = persist(location(null, 8_000_000_001L));
    }

    /** 준비 데이터만 저장한다. 테스트 종료 시 같은 트랜잭션에서 롤백한다. */
    private <T> T persist(T entity) { em.persist(entity); return entity; }

    private User newUser() {
        return persist(user(null, "map-modal-" + (++sequence) + "@example.com"));
    }

    private Mission mission(MissionTypeCode code) {
        MissionType type = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class)
                .setParameter("type", code).getSingleResult();
        return persist(Mission.builder().missionType(type).build());
    }

    private TreasureMission treasure(MissionActivationStatus status, boolean withRewards) {
        ArCharacter character = null;
        Coupon coupon = null;
        if (withRewards) {
            character = persist(ArCharacter.builder().requiredFragmentCount(10).name("돌담이").description("설명").storyTitle("이야기")
                    .acquireCondition("미션").imgUrl("https://example.com/character.png")
                    .representativeColor("blue").hashtags(List.of("여행")).build());
            coupon = persist(Coupon.builder().couponPrice(3000).location(null).build());
        }
        return persist(TreasureMission.builder().mission(mission(MissionTypeCode.TREASURE)).location(location)
                .status(status).itemTotalCount(3).arCharacter(character).point(withRewards ? 100 : null).coupon(coupon).build());
    }

    private CooperativeMission cooperative() {
        return persist(CooperativeMission.builder().mission(mission(MissionTypeCode.COOPERATIVE))
                .location(location).status(MissionActivationStatus.ACTIVE).point(100).build());
    }

    private CooperativeMissionProgress team(CooperativeMission mission, User user, ParticipantStatus status,
                                             MissionProgressStatus progressStatus, String token) {
        CooperativeMissionProgress progress = persist(CooperativeMissionProgress.builder().cooperativeMission(mission)
                .missionStatus(progressStatus).teamToken(token).build());
        persist(CooperativeMissionParticipant.builder().cooperativeMissionProgress(progress).user(user)
                .participantStatus(status).participantRole(ParticipantRole.MEMBER).joinedAt(TIME).build());
        return progress;
    }

    private VisitedLocation visit(User user, Location target) {
        return persist(VisitedLocation.builder().user(user).location(target).lastVisitedAt(TIME).build());
    }

    private LocationGuestbook book(User author, VisitedLocation visit, GuestbookStatus status,
                                   java.time.LocalDate date, Mission mission) {
        Guestbook common = persist(guestbook(null, author, status, date));
        return persist(LocationGuestbook.builder().guestbook(common).visitedLocation(visit).mission(mission).build());
    }

    private RoadGuestbook road(User author, GuestbookStatus status, boolean content) {
        Guestbook common = content ? guestbook(null, author, status, DATE)
                : Guestbook.builder().user(author).status(status).visitedAt(DATE).savedAt(TIME).build();
        persist(common);
        return persist(RoadGuestbook.builder().guestbook(common).locationAlias("성산 바다 앞")
                .latitude(33.46).longitude(126.93).build());
    }

    private MockHttpServletRequestBuilder query(String type, Object id) {
        return get(URL).param("targetType", type).param("targetId", id.toString())
                .param("userLatitude", "33.45").param("userLongitude", "126.92");
    }

    private String token(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }

    private ResultActions request(User user, String type, Object id) throws Exception {
        return mvc.perform(query(type, id).header("Authorization", token(user)));
    }

    private void reload() { em.flush(); em.clear(); }

    /** 응답 조회가 대상 데이터와 보상·방문·진행 이력을 변경하지 않았는지 비교한다. */
    private Map<String, List<Map<String, Object>>> snapshot() {
        reload();
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (String table : List.of("user", "location", "visited_location", "guestbook", "location_guestbook",
                "road_guestbook", "mission", "treasure_mission", "cooperative_mission", "mission_reward_status",
                "treasure_mission_progress", "cooperative_mission_progress", "cooperative_mission_participant",
                "acquired_coupon", "acquired_ar_character")) {
            result.put(table, jdbc.queryForList("select * from " + table));
        }
        return result;
    }

    private void error(ResultActions response, int status, String code, String message) throws Exception {
        response.andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
    }

    @Test
    void 보물찾기_전체_보상과_수령여부_방문_완료는_사용자별로_격리된다() throws Exception {
        TreasureMission mission = treasure(MissionActivationStatus.ACTIVE, true);
        User other = newUser();
        visit(current, location);
        persist(TreasureMissionProgress.builder().treasureMission(mission).user(current)
                .missionStatus(MissionProgressStatus.COMPLETED).completedAt(TIME).build());
        MissionRewardStatus saved = persist(MissionRewardStatus.builder().mission(mission.getMission()).user(current).build());
        saved.grantArCharacterReward();
        // 다른 미션에서 지급받았어도 현재 미션의 수령 여부에 영향을 주지 않는다.
        Mission otherMission = mission(MissionTypeCode.CULTURE);
        MissionRewardStatus otherStatus = persist(MissionRewardStatus.builder().mission(otherMission).user(other).build());
        otherStatus.grantPointReward();
        Map<String, List<Map<String, Object>>> before = snapshot();
        String body = request(current, "LOCATION", location.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(location.getId())).andExpect(jsonPath("$.locationTitle").value(location.getTitle()))
                .andExpect(jsonPath("$.locationCategory").value("관광지"))
                .andExpect(jsonPath("$.representativeImageUrl").value("https://example.com/location.jpg"))
                .andExpect(jsonPath("$.distanceMeter").value(0)).andExpect(jsonPath("$.durationMinutes").value(0))
                .andExpect(jsonPath("$.isVisited").value(true)).andExpect(jsonPath("$.mission.missionId").value(mission.getMissionId()))
                .andExpect(jsonPath("$.mission.missionType").value("TREASURE"))
                .andExpect(jsonPath("$.mission.missionTitle").value(mission.getMission().getMissionType().getTitle()))
                .andExpect(jsonPath("$.mission.isCompleted").value(true))
                .andExpect(jsonPath("$.mission.rewardDetail.arCharacter.id").value(mission.getArCharacter().getId()))
                .andExpect(jsonPath("$.mission.rewardDetail.arCharacter.name").value("돌담이"))
                .andExpect(jsonPath("$.mission.rewardDetail.arCharacter.imageUrl").value("https://example.com/character.png"))
                .andExpect(jsonPath("$.mission.rewardDetail.arCharacter.isReceived").value(true))
                .andExpect(jsonPath("$.mission.rewardDetail.point.amount").value(100))
                .andExpect(jsonPath("$.mission.rewardDetail.point.isReceived").value(false))
                .andExpect(jsonPath("$.mission.rewardDetail.coupon.couponPrice").value(3000))
                .andExpect(jsonPath("$.mission.rewardDetail.coupon.couponLocation").value(nullValue()))
                .andExpect(jsonPath("$.mission.rewardDetail.coupon.isReceived").value(false))
                .andExpect(jsonPath("$.guestbooksCount").value(0)).andExpect(jsonPath("$.guestbooks").isEmpty())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> json = JsonPath.read(body, "$");
        assertThat(json.keySet()).containsExactlyInAnyOrder("id", "locationTitle", "locationCategory", "representativeImageUrl",
                "distanceMeter", "durationMinutes", "isVisited", "mission", "guestbooksCount", "guestbooks");
        assertThat(request(current, "LOCATION", location.getId()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8)).isEqualTo(body);
        request(other, "LOCATION", location.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.isVisited").value(false)).andExpect(jsonPath("$.mission.isCompleted").value(false))
                .andExpect(jsonPath("$.mission.rewardDetail.arCharacter.isReceived").value(false))
                .andExpect(jsonPath("$.mission.rewardDetail.point.isReceived").value(false));
        assertThat(snapshot()).isEqualTo(before);
        MissionRewardStatus reloaded = em.find(MissionRewardStatus.class, new MissionRewardStatusId(mission.getMissionId(), current.getId()));
        reloaded.grantPointReward();
        reloaded.grantCouponReward();
        before = snapshot();
        request(current, "LOCATION", location.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.mission.rewardDetail.arCharacter.isReceived").value(true))
                .andExpect(jsonPath("$.mission.rewardDetail.point.isReceived").value(true))
                .andExpect(jsonPath("$.mission.rewardDetail.coupon.isReceived").value(true))
                .andExpect(jsonPath("$.mission.rewardDetail.point.amount").value(100));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 협동_과거완료가_있으면_재진행중이어도_완료이고_PENDING완료는_제외한다() throws Exception {
        CooperativeMission mission = cooperative();
        team(mission, current, ParticipantStatus.ACCEPTED, MissionProgressStatus.COMPLETED, "completed-team");
        team(mission, current, ParticipantStatus.ACCEPTED, MissionProgressStatus.IN_PROGRESS, "retry-team");
        User other = newUser();
        team(mission, other, ParticipantStatus.PENDING, MissionProgressStatus.COMPLETED, "pending-team");
        Map<String, List<Map<String, Object>>> before = snapshot();
        request(current, "LOCATION", location.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.mission.missionType").value("COOPERATIVE"))
                .andExpect(jsonPath("$.mission.isCompleted").value(true))
                .andExpect(jsonPath("$.mission.rewardDetail.point.amount").value(100))
                .andExpect(jsonPath("$.mission.rewardDetail.point.isReceived").value(false));
        request(other, "LOCATION", location.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.mission.isCompleted").value(false));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void ACTIVE만_집계하고_방문일과_ID_내림차순으로_최대3건을_조회한다() throws Exception {
        OnboardingResult profile = persist(onboarding());
        current.assignOnboardingResult(profile);
        VisitedLocation visit = visit(current, location);
        Mission mission = mission(MissionTypeCode.TREASURE);
        book(current, visit, GuestbookStatus.ACTIVE, DATE.minusDays(1), mission);
        LocationGuestbook first = book(current, visit, GuestbookStatus.ACTIVE, DATE, mission);
        User noProfile = newUser();
        LocationGuestbook second = book(noProfile, visit, GuestbookStatus.ACTIVE, DATE, null);
        LocationGuestbook third = book(null, visit, GuestbookStatus.ACTIVE, DATE, null);
        book(current, visit, GuestbookStatus.INACTIVE, DATE.plusDays(1), mission);
        book(current, null, GuestbookStatus.ACTIVE, DATE.plusDays(1), mission);
        Location elsewhere = persist(location(null, 8_000_000_002L));
        book(current, visit(current, elsewhere), GuestbookStatus.ACTIVE, DATE.plusDays(1), mission);
        road(current, GuestbookStatus.ACTIVE, true);
        Map<String, List<Map<String, Object>>> before = snapshot();
        request(current, "LOCATION", location.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.guestbooksCount").value(4)).andExpect(jsonPath("$.guestbooks.length()").value(3))
                .andExpect(jsonPath("$.guestbooks[0].id").value(third.getGuestbookId()))
                .andExpect(jsonPath("$.guestbooks[0].userId").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[0].userNickname").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[0].characterImgUrl").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[0].missionTitle").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[1].id").value(second.getGuestbookId()))
                .andExpect(jsonPath("$.guestbooks[1].userNickname").value("지도 작성자"))
                .andExpect(jsonPath("$.guestbooks[1].characterImgUrl").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[2].id").value(first.getGuestbookId()))
                .andExpect(jsonPath("$.guestbooks[2].userId").value(current.getId()))
                .andExpect(jsonPath("$.guestbooks[2].characterImgUrl").value("https://example.com/profile.png"))
                .andExpect(jsonPath("$.guestbooks[2].missionTitle").value(mission.getMissionType().getTitle()))
                .andExpect(jsonPath("$.guestbooks[2].representativeImageUrl").value("https://example.com/photo.jpg"))
                .andExpect(jsonPath("$.guestbooks[2].visitedAt").value(DATE.toString()))
                .andExpect(jsonPath("$.guestbooks[2].contentWriting").value("제주 산책 기록"));
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 미션이_없거나_비활성뿐이면_장소는_유지하고_이미지는_null일수있다(boolean inactive) throws Exception {
        if (inactive) treasure(MissionActivationStatus.INACTIVE, false);
        when(images.getLocationImageUrl(location.getContentId())).thenReturn(null);
        Map<String, List<Map<String, Object>>> before = snapshot();
        request(current, "LOCATION", location.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.mission").value(nullValue()))
                .andExpect(jsonPath("$.representativeImageUrl").value(nullValue()))
                .andExpect(jsonPath("$.guestbooksCount").value(0)).andExpect(jsonPath("$.guestbooks").isEmpty());
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 보상_미설정이어도_미션과_빈_보상객체를_유지한다() throws Exception {
        treasure(MissionActivationStatus.ACTIVE, false);
        reload();
        request(current, "LOCATION", location.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.mission.rewardDetail").isMap())
                .andExpect(jsonPath("$.mission.rewardDetail.arCharacter").value(nullValue()))
                .andExpect(jsonPath("$.mission.rewardDetail.point").value(nullValue()))
                .andExpect(jsonPath("$.mission.rewardDetail.coupon").value(nullValue()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 길바닥_방명록은_작성자_유무와_무관하게_단일콘텐츠를_반환한다(boolean author) throws Exception {
        if (author) current.assignOnboardingResult(persist(onboarding()));
        RoadGuestbook road = road(author ? current : null, GuestbookStatus.ACTIVE, true);
        Map<String, List<Map<String, Object>>> before = snapshot();
        TravelEstimator.TravelEstimate expected = travel.estimate(33.45, 126.92, 33.46, 126.93);
        String body = request(current, "ROAD_GUESTBOOK", road.getGuestbookId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(road.getGuestbookId()))
                .andExpect(jsonPath("$.userNickname").value(author ? equalTo("지도 작성자") : nullValue()))
                .andExpect(jsonPath("$.characterImgUrl").value(author ? equalTo("https://example.com/profile.png") : nullValue()))
                .andExpect(jsonPath("$.locationAlias").value("성산 바다 앞"))
                .andExpect(jsonPath("$.distanceMeter").value(expected.distanceMeter()))
                .andExpect(jsonPath("$.durationMinutes").value(expected.durationMinutes()))
                .andExpect(jsonPath("$.visitedAt").value(DATE.toString()))
                .andExpect(jsonPath("$.contentImageUrl").value("https://example.com/photo.jpg"))
                .andExpect(jsonPath("$.contentAudioUrl").value("https://example.com/audio.mp3"))
                .andExpect(jsonPath("$.contentWriting").value("제주 산책 기록"))
                .andExpect(jsonPath("$.contentWeather").value("맑음"))
                .andExpect(jsonPath("$.contentColorCode").value("#123456"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> json = JsonPath.read(body, "$");
        assertThat(json.keySet()).containsExactlyInAnyOrder("id", "userNickname", "characterImgUrl", "locationAlias", "distanceMeter",
                "durationMinutes", "visitedAt", "contentImageUrl", "contentWriting", "contentAudioUrl", "contentWeather", "contentColorCode");
        assertThat(request(current, "ROAD_GUESTBOOK", road.getGuestbookId()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8)).isEqualTo(body);
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 콘텐츠가_없어도_nullable키를_유지한다() throws Exception {
        RoadGuestbook road = road(null, GuestbookStatus.ACTIVE, false);
        reload();
        String body = request(current, "ROAD_GUESTBOOK", road.getGuestbookId()).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> json = JsonPath.read(body, "$");
        for (String field : List.of("userNickname", "contentImageUrl", "contentAudioUrl", "contentWriting", "contentWeather", "contentColorCode")) {
            assertThat(json).containsEntry(field, null);
        }
    }

    @Test
    void 대상없음과_비활성_길바닥은_동일404이며_DB를_유지한다() throws Exception {
        RoadGuestbook inactive = road(current, GuestbookStatus.INACTIVE, true);
        Map<String, List<Map<String, Object>>> before = snapshot();
        for (String type : List.of("LOCATION", "ROAD_GUESTBOOK")) {
            error(request(current, type, Long.MAX_VALUE), 404, "MAP_MODAL_TARGET_NOT_FOUND",
                    "조회할 장소 또는 길바닥 방명록을 찾을 수 없습니다.");
        }
        error(request(current, "ROAD_GUESTBOOK", inactive.getGuestbookId()), 404, "MAP_MODAL_TARGET_NOT_FOUND",
                "조회할 장소 또는 길바닥 방명록을 찾을 수 없습니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 중복미션은_유형과_무관하게_공통500이며_DB를_유지한다(boolean mixed) throws Exception {
        treasure(MissionActivationStatus.ACTIVE, true);
        if (mixed) cooperative(); else treasure(MissionActivationStatus.ACTIVE, false);
        Map<String, List<Map<String, Object>>> before = snapshot();
        error(request(current, "LOCATION", location.getId()), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 보상조회_DB오류도_공통500이며_내부원인을_노출하지_않는다() throws Exception {
        treasure(MissionActivationStatus.ACTIVE, true);
        Map<String, List<Map<String, Object>>> before = snapshot();
        doThrow(new IllegalStateException("내부 DB 오류 원인")).when(rewards).findById(any());
        error(request(current, "LOCATION", location.getId()), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 잘못된_쿼리는_공통400이다() throws Exception {
        Map<String, List<Map<String, Object>>> before = snapshot();
        for (String field : List.of("targetType", "targetId", "userLatitude", "userLongitude")) {
            MockHttpServletRequestBuilder builder = query("LOCATION", location.getId()).header("Authorization", token(current));
            builder.with(request -> { request.removeParameter(field); return request; });
            error(mvc.perform(builder), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        for (String id : List.of("0", "-1", "1.5", "9223372036854775808")) {
            error(request(current, "LOCATION", id), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        error(request(current, "MISSION", location.getId()), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        for (String value : List.of("90.01", "-90.01", "NaN", "Infinity", "abc")) {
            MockHttpServletRequestBuilder builder = query("LOCATION", location.getId()).header("Authorization", token(current));
            builder.with(request -> { request.setParameter("userLatitude", value); return request; });
            error(mvc.perform(builder), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 인증없이_호출하거나_잘못된토큰과_없는사용자는_401이다() throws Exception {
        Map<String, List<Map<String, Object>>> before = snapshot();
        error(mvc.perform(query("LOCATION", location.getId())), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        error(mvc.perform(query("LOCATION", location.getId()).header("Authorization", "Bearer invalid-token")),
                401, "INVALID_TOKEN", "유효하지 않은 토큰입니다.");
        User missing = user(Long.MAX_VALUE, "missing@example.com");
        error(request(missing, "LOCATION", location.getId()), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        assertThat(snapshot()).isEqualTo(before);
    }
}
