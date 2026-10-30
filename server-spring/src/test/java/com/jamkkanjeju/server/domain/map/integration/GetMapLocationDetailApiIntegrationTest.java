package com.jamkkanjeju.server.domain.map.integration;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
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
import java.util.ArrayList;
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

/** 실제 JWT·HTTP·임시 MySQL로 상세 응답·거리순 추천·방명록 페이지·상태 보존을 검증한다. */
@SpringBootTest(properties = {
        "app.dev-auth.enabled=false", "app.blob-storage.container=media",
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m", "app.jwt.refresh-token-expiration=14d",
        "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Transactional
class GetMapLocationDetailApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/map/locations/{locationId}";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenProvider tokens;
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
        when(images.getLocationOverview(anyLong())).thenReturn("장소 설명");
        when(images.getLocationDetailImageUrls(anyLong(), anyInt())).thenReturn(List.of("detail-1.jpg", "detail-2.jpg"));
        when(images.getLocationImageUrl(anyLong())).thenReturn("representative.jpg");
        // 임시 DB의 초기 추천 후보만 이번 트랜잭션에서 제외하고 준비한 좌표로 결과를 고정한다.
        jdbc.update("update treasure_mission set status='INACTIVE'");
        jdbc.update("update cooperative_mission set status='INACTIVE'");
        current = newUser();
        location = place(0);
    }

    private <T> T persist(T entity) { em.persist(entity); return entity; }

    private User newUser() { return persist(user(null, "location-detail-" + (++sequence) + "@example.com")); }

    private Location place(double longitude) {
        return persist(Location.builder().contentId(9_100_000_000L + (++sequence)).title("상세 장소" + sequence)
                .category("관광지").address("제주 상세 주소").latitude(0).longitude(longitude).radius(100).build());
    }

    private Mission mission(MissionTypeCode code) {
        MissionType type = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class)
                .setParameter("type", code).getSingleResult();
        return persist(Mission.builder().missionType(type).build());
    }

    private TreasureMission treasure(Location target, MissionActivationStatus status, boolean withRewards) {
        ArCharacter character = null;
        Coupon coupon = null;
        if (withRewards) {
            character = persist(ArCharacter.builder().requiredFragmentCount(10).name("돌담이").description("설명").storyTitle("이야기")
                    .acquireCondition("미션").imgUrl("character.png").representativeColor("blue").hashtags(List.of("여행")).build());
            coupon = persist(Coupon.builder().location(null).couponPrice(3000).build());
        }
        return persist(TreasureMission.builder().mission(mission(MissionTypeCode.TREASURE)).location(target)
                .status(status).itemTotalCount(3).point(withRewards ? 100 : null).arCharacter(character).coupon(coupon).build());
    }

    private CooperativeMission cooperative(Location target, MissionActivationStatus status) {
        return persist(CooperativeMission.builder().mission(mission(MissionTypeCode.COOPERATIVE)).location(target)
                .status(status).point(150).build());
    }

    private void team(CooperativeMission mission, User user, ParticipantStatus status, MissionProgressStatus progressStatus) {
        CooperativeMissionProgress progress = persist(CooperativeMissionProgress.builder().cooperativeMission(mission)
                .missionStatus(progressStatus).teamToken("detail-team-" + (++sequence)).completedAt(TIME).build());
        persist(CooperativeMissionParticipant.builder().cooperativeMissionProgress(progress).user(user)
                .participantStatus(status).participantRole(ParticipantRole.MEMBER).joinedAt(TIME).build());
    }

    private VisitedLocation visit(User user, Location target) {
        return persist(VisitedLocation.builder().user(user).location(target).lastVisitedAt(TIME).build());
    }

    private LocationGuestbook book(User author, VisitedLocation visit, GuestbookStatus status,
                                   java.time.LocalDate date, Mission mission) {
        Guestbook common = persist(guestbook(null, author, status, date));
        return persist(LocationGuestbook.builder().guestbook(common).visitedLocation(visit).mission(mission).build());
    }

    private MockHttpServletRequestBuilder query(Object id) {
        return get(URL, id).param("userLatitude", "0").param("userLongitude", "0");
    }

    private String token(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }

    private ResultActions request(User user, Object id, Integer page, Integer size) throws Exception {
        MockHttpServletRequestBuilder builder = query(id).header("Authorization", token(user));
        if (page != null) builder.param("page", page.toString());
        if (size != null) builder.param("size", size.toString());
        return mvc.perform(builder);
    }

    private ResultActions request() throws Exception { return request(current, location.getId(), null, null); }

    private void reload() { em.flush(); em.clear(); }

    /** 정상·오류·반복 조회 전후 방문·방명록·미션·보상 상태를 비교한다. */
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

    private void error(ResultActions response, int expectedStatus, String code, String message) throws Exception {
        response.andExpect(status().is(expectedStatus)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
    }

    @Test
    void 기본정보_현재미션_전체보상과_수령여부를_조회하고_반복해도_DB는_유지된다() throws Exception {
        TreasureMission mission = treasure(location, MissionActivationStatus.ACTIVE, true);
        visit(current, location);
        MissionRewardStatus saved = persist(MissionRewardStatus.builder().mission(mission.getMission()).user(current).build());
        saved.grantArCharacterReward();
        Map<String, List<Map<String, Object>>> before = snapshot();
        String body = request().andExpect(status().isOk())
                .andExpect(jsonPath("$.locationTitle").value(location.getTitle()))
                .andExpect(jsonPath("$.locationCategory").value("관광지"))
                .andExpect(jsonPath("$.locationAddress").value("제주 상세 주소"))
                .andExpect(jsonPath("$.distanceMeter").value(0)).andExpect(jsonPath("$.durationMinutes").value(0))
                .andExpect(jsonPath("$.isVisited").value(true))
                .andExpect(jsonPath("$.locationDescription").value("장소 설명"))
                .andExpect(jsonPath("$.locationImageUrls[0]").value("detail-1.jpg"))
                .andExpect(jsonPath("$.locationImageUrls[1]").value("detail-2.jpg"))
                .andExpect(jsonPath("$.locationMission.missionId").value(mission.getMissionId()))
                .andExpect(jsonPath("$.locationMission.missionType").value("TREASURE"))
                .andExpect(jsonPath("$.locationMission.description").value(mission.getMission().getMissionType().getDescription()))
                .andExpect(jsonPath("$.locationMission.rewardDetail.arCharacter.isReceived").value(true))
                .andExpect(jsonPath("$.locationMission.rewardDetail.arCharacter.imageUrl").value("character.png"))
                .andExpect(jsonPath("$.locationMission.rewardDetail.point.amount").value(100))
                .andExpect(jsonPath("$.locationMission.rewardDetail.point.isReceived").value(false))
                .andExpect(jsonPath("$.locationMission.rewardDetail.coupon.couponLocation").value(nullValue()))
                .andExpect(jsonPath("$.nearbyMissions[0].missionId").value(mission.getMissionId()))
                .andExpect(jsonPath("$.nearbyMissions[0].locationTitle").value(location.getTitle()))
                .andExpect(jsonPath("$.nearbyMissions[0].representativeImageUrl").value("representative.jpg"))
                .andExpect(jsonPath("$.nearbyMissions[0].rewardDetail.arCharacter.isReceived").value(true))
                .andExpect(jsonPath("$.guestbooksPage.page").value(0)).andExpect(jsonPath("$.guestbooksPage.size").value(20))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> json = JsonPath.read(body, "$");
        assertThat(json.keySet()).containsExactlyInAnyOrder("locationTitle", "locationCategory", "distanceMeter", "durationMinutes",
                "locationAddress", "isVisited", "locationDescription", "locationImageUrls", "nearbyMissions", "guestbooks", "guestbooksPage", "locationMission");
        assertThat(request().andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)).isEqualTo(body);
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 추천은_두유형합계_가까운3건이며_완료_비활성_장소없음을_제외한다() throws Exception {
        TreasureMission first = treasure(place(.01), MissionActivationStatus.ACTIVE, false);
        CooperativeMission second = cooperative(place(.02), MissionActivationStatus.ACTIVE);
        TreasureMission third = treasure(place(.03), MissionActivationStatus.ACTIVE, false);
        cooperative(place(.04), MissionActivationStatus.ACTIVE);
        treasure(place(.001), MissionActivationStatus.INACTIVE, false);
        cooperative(place(.002), MissionActivationStatus.INACTIVE);
        treasure(null, MissionActivationStatus.ACTIVE, false);
        cooperative(null, MissionActivationStatus.ACTIVE);
        TreasureMission completed = treasure(place(.005), MissionActivationStatus.ACTIVE, false);
        persist(TreasureMissionProgress.builder().treasureMission(completed).user(current)
                .missionStatus(MissionProgressStatus.COMPLETED).completedAt(TIME).build());
        CooperativeMission completedTeam = cooperative(place(.006), MissionActivationStatus.ACTIVE);
        team(completedTeam, current, ParticipantStatus.ACCEPTED, MissionProgressStatus.COMPLETED);
        team(completedTeam, current, ParticipantStatus.ACCEPTED, MissionProgressStatus.IN_PROGRESS);
        User other = newUser();
        Map<String, List<Map<String, Object>>> before = snapshot();
        request().andExpect(status().isOk()).andExpect(jsonPath("$.nearbyMissions.length()").value(3))
                .andExpect(jsonPath("$.nearbyMissions[0].missionId").value(first.getMissionId()))
                .andExpect(jsonPath("$.nearbyMissions[1].missionId").value(second.getMissionId()))
                .andExpect(jsonPath("$.nearbyMissions[2].missionId").value(third.getMissionId()));
        request(other, location.getId(), null, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.nearbyMissions[0].missionId").value(completed.getMissionId()));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 현재장소의_완료미션은_표시하지만_추천에서_제외하고_사용자별로_분리한다() throws Exception {
        CooperativeMission mission = cooperative(location, MissionActivationStatus.ACTIVE);
        team(mission, current, ParticipantStatus.ACCEPTED, MissionProgressStatus.COMPLETED);
        User pending = newUser();
        team(mission, pending, ParticipantStatus.PENDING, MissionProgressStatus.COMPLETED);
        MissionRewardStatus saved = persist(MissionRewardStatus.builder().mission(mission.getMission()).user(current).build());
        saved.grantPointReward();
        visit(current, location);
        Map<String, List<Map<String, Object>>> before = snapshot();
        request().andExpect(status().isOk()).andExpect(jsonPath("$.nearbyMissions").isEmpty())
                .andExpect(jsonPath("$.locationMission.isCompleted").value(true))
                .andExpect(jsonPath("$.locationMission.rewardDetail.point.isReceived").value(true));
        request(pending, location.getId(), null, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.isVisited").value(false))
                .andExpect(jsonPath("$.nearbyMissions[0].missionId").value(mission.getMissionId()))
                .andExpect(jsonPath("$.locationMission.isCompleted").value(false))
                .andExpect(jsonPath("$.locationMission.rewardDetail.point.isReceived").value(false));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 기본20건_다음1건_빈페이지와_size변경을_정렬대로_조회한다() throws Exception {
        VisitedLocation visit = visit(current, location);
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < 21; i++) {
            ids.add(book(current, visit, GuestbookStatus.ACTIVE, i == 0 ? DATE.plusDays(1) : DATE, null).getGuestbookId());
        }
        Map<String, List<Map<String, Object>>> before = snapshot();
        String body = request().andExpect(status().isOk()).andExpect(jsonPath("$.guestbooks.length()").value(20))
                .andExpect(jsonPath("$.guestbooksPage.hasNext").value(true))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        List<Number> firstPage = JsonPath.read(body, "$.guestbooks[*].id");
        List<Long> expected = new ArrayList<>();
        expected.add(ids.getFirst());
        for (int i = 20; i >= 2; i--) expected.add(ids.get(i));
        assertThat(firstPage.stream().map(Number::longValue).toList()).containsExactlyElementsOf(expected);
        request(current, location.getId(), 1, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.guestbooks.length()").value(1)).andExpect(jsonPath("$.guestbooks[0].id").value(ids.get(1)))
                .andExpect(jsonPath("$.guestbooksPage.page").value(1)).andExpect(jsonPath("$.guestbooksPage.size").value(20))
                .andExpect(jsonPath("$.guestbooksPage.hasNext").value(false));
        request(current, location.getId(), 2, 20).andExpect(status().isOk())
                .andExpect(jsonPath("$.guestbooks").isEmpty()).andExpect(jsonPath("$.guestbooksPage.hasNext").value(false));
        request(current, location.getId(), 0, 7).andExpect(status().isOk())
                .andExpect(jsonPath("$.guestbooks.length()").value(7)).andExpect(jsonPath("$.guestbooksPage.size").value(7))
                .andExpect(jsonPath("$.guestbooksPage.hasNext").value(true));
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 20})
    void 없거나_정확히20건이면_다음페이지가_없다(int count) throws Exception {
        VisitedLocation visit = visit(current, location);
        for (int i = 0; i < count; i++) book(current, visit, GuestbookStatus.ACTIVE, DATE, null);
        reload();
        request().andExpect(status().isOk()).andExpect(jsonPath("$.guestbooks.length()").value(count))
                .andExpect(jsonPath("$.guestbooksPage.hasNext").value(false));
    }

    @Test
    void 작성자_온보딩_미션이_없어도_유지하고_다른장소와_비활성은_제외한다() throws Exception {
        OnboardingResult profile = persist(onboarding());
        current.assignOnboardingResult(profile);
        VisitedLocation visit = visit(current, location);
        Mission reference = mission(MissionTypeCode.TREASURE);
        LocationGuestbook withProfile = book(current, visit, GuestbookStatus.ACTIVE, DATE, reference);
        User noProfile = newUser();
        LocationGuestbook withoutProfile = book(noProfile, visit, GuestbookStatus.ACTIVE, DATE, null);
        LocationGuestbook withoutAuthor = book(null, visit, GuestbookStatus.ACTIVE, DATE, null);
        book(current, visit, GuestbookStatus.INACTIVE, DATE.plusDays(1), null);
        book(current, null, GuestbookStatus.ACTIVE, DATE.plusDays(1), null);
        book(current, visit(current, place(10)), GuestbookStatus.ACTIVE, DATE.plusDays(1), null);
        Guestbook roadCommon = persist(guestbook(null, current, GuestbookStatus.ACTIVE, DATE));
        persist(RoadGuestbook.builder().guestbook(roadCommon).locationAlias("길바닥").latitude(0).longitude(0).build());
        Map<String, List<Map<String, Object>>> before = snapshot();
        request().andExpect(status().isOk()).andExpect(jsonPath("$.guestbooks.length()").value(3))
                .andExpect(jsonPath("$.guestbooks[0].id").value(withoutAuthor.getGuestbookId()))
                .andExpect(jsonPath("$.guestbooks[0].userId").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[0].userNickname").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[0].characterImgUrl").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[1].id").value(withoutProfile.getGuestbookId()))
                .andExpect(jsonPath("$.guestbooks[1].characterImgUrl").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[1].missionTitle").value(nullValue()))
                .andExpect(jsonPath("$.guestbooks[2].id").value(withProfile.getGuestbookId()))
                .andExpect(jsonPath("$.guestbooks[2].characterImgUrl").value("https://example.com/profile.png"))
                .andExpect(jsonPath("$.guestbooks[2].missionTitle").value(reference.getMissionType().getTitle()))
                .andExpect(jsonPath("$.guestbooks[2].visitedAt").value(DATE.toString()));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 설명과이미지_미션_추천이_없어도_장소를_반환한다() throws Exception {
        treasure(location, MissionActivationStatus.INACTIVE, false);
        when(images.getLocationOverview(anyLong())).thenReturn(null);
        when(images.getLocationDetailImageUrls(anyLong(), anyInt())).thenReturn(null);
        Map<String, List<Map<String, Object>>> before = snapshot();
        request().andExpect(status().isOk()).andExpect(jsonPath("$.locationDescription").value(nullValue()))
                .andExpect(jsonPath("$.locationImageUrls").value(nullValue())).andExpect(jsonPath("$.nearbyMissions").isEmpty())
                .andExpect(jsonPath("$.locationMission").value(nullValue())).andExpect(jsonPath("$.guestbooks").isEmpty());
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 같은유형과_다른유형_활성미션중복은_공통500이다(boolean mixed) throws Exception {
        treasure(location, MissionActivationStatus.ACTIVE, false);
        if (mixed) cooperative(location, MissionActivationStatus.ACTIVE);
        else treasure(location, MissionActivationStatus.ACTIVE, false);
        Map<String, List<Map<String, Object>>> before = snapshot();
        error(request(), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void DB오류는_공통500으로_반환하고_내부원인을_숨긴다() throws Exception {
        treasure(location, MissionActivationStatus.ACTIVE, true);
        Map<String, List<Map<String, Object>>> before = snapshot();
        doThrow(new IllegalStateException("내부 지급상태 오류")).when(rewards).findAllByIdUserIdAndIdMissionIdIn(anyLong(), any());
        error(request(), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 장소없음은_명세의_404이다() throws Exception {
        Map<String, List<Map<String, Object>>> before = snapshot();
        error(request(current, Long.MAX_VALUE, null, null), 404, "LOCATION_NOT_FOUND", "장소를 찾을 수 없습니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 잘못된_Path_좌표_페이지는_공통400이다() throws Exception {
        Map<String, List<Map<String, Object>>> before = snapshot();
        for (String id : List.of("0", "-1", "1.5", "abc", "9223372036854775808")) {
            error(request(current, id, null, null), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        for (String field : List.of("userLatitude", "userLongitude", "page", "size")) {
            for (String value : List.of("abc", "1.5", "2147483648")) {
                if (field.startsWith("user") && value.equals("1.5")) continue;
                MockHttpServletRequestBuilder builder = query(location.getId()).header("Authorization", token(current));
                builder.with(request -> { request.setParameter(field, value); return request; });
                error(mvc.perform(builder), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
            }
        }
        for (String coordinate : List.of("NaN", "Infinity", "-Infinity", "90.01")) {
            MockHttpServletRequestBuilder builder = query(location.getId()).header("Authorization", token(current));
            builder.with(request -> { request.setParameter("userLatitude", coordinate); return request; });
            error(mvc.perform(builder), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        for (String field : List.of("userLatitude", "userLongitude")) {
            MockHttpServletRequestBuilder builder = query(location.getId()).header("Authorization", token(current));
            builder.with(request -> { request.removeParameter(field); return request; });
            error(mvc.perform(builder), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        error(request(current, location.getId(), -1, 20), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        error(request(current, location.getId(), 0, 0), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 인증없음_잘못된토큰_없는사용자는_401이다() throws Exception {
        Map<String, List<Map<String, Object>>> before = snapshot();
        error(mvc.perform(query(location.getId())), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        error(mvc.perform(query(location.getId()).header("Authorization", "Bearer invalid")),
                401, "INVALID_TOKEN", "유효하지 않은 토큰입니다.");
        error(request(user(Long.MAX_VALUE, "missing@example.com"), location.getId(), null, null),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        assertThat(snapshot()).isEqualTo(before);
    }
}
