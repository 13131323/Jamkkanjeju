package com.jamkkanjeju.server.domain.guestbook.integration;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.guestbook.support.GuestbookIntegrationTestSupport;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import com.jamkkanjeju.server.domain.map.support.MapModalFixtures;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·임시 MySQL에서 독립 Slice·연결 삭제·좋아요·조회 전후 상태 보존을 검증한다. */
@SpringBootTest(properties = {"app.blob-storage.container=media", "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Transactional
class GetGuestbooksApiIntegrationTest extends GuestbookIntegrationTestSupport {
    @Autowired MockMvc mvc;
    int sequence;

    @BeforeEach void clearSeedGuestbooks() {
        // 실행별 임시 DB의 초기 방명록만 테스트 트랜잭션 안에서 비워 페이지를 결정적으로 준비한다.
        jdbc.update("delete from guestbook");
    }

    private MockHttpServletRequestBuilder query() { return get(URL).header("Authorization", bearer(current)); }
    private ResultActions request() throws Exception { return mvc.perform(query()); }
    private String json(ResultActions result) throws Exception {
        return result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }
    private List<Long> ids(String body, String field) {
        List<Number> values = JsonPath.read(body, "$." + field + "[*].id");
        return values.stream().map(Number::longValue).toList();
    }
    private Guestbook book(User author, GuestbookStatus status, LocalDateTime savedAt) {
        return persist(Guestbook.builder().user(author).status(status).visitedAt(DATE).savedAt(savedAt)
                .contentImgUrl("https://example.com/image.jpg").contentAudioUrl("https://example.com/audio.m4a")
                .audioTitle("제주의 소리").contentWriting("기록").contentWeather("맑음")
                .contentTemperatureCelsius(new BigDecimal("24.5")).contentColorCode("#123456").build());
    }
    private VisitedLocation visit(User user, Location place, LocalDateTime time) {
        return persist(VisitedLocation.builder().user(user).location(place).lastVisitedAt(time).build());
    }
    private VisitedLocation ownVisit() {
        return em.createQuery("select v from VisitedLocation v where v.user.id=:id", VisitedLocation.class)
                .setParameter("id", current.getId()).getSingleResult();
    }
    private Location place() {
        return persist(Location.builder().contentId(9_500_000_000L + ++sequence).title("추가 장소 " + sequence)
                .address("제주 주소").category("카페").latitude(33.4).longitude(126.5).radius(100).build());
    }
    private LocationGuestbook general(User author, VisitedLocation visit, GuestbookStatus status, LocalDateTime time, Mission mission) {
        return persist(LocationGuestbook.builder().guestbook(book(author, status, time)).visitedLocation(visit).mission(mission).build());
    }
    private RoadGuestbook road(User author, GuestbookStatus status, LocalDateTime time) {
        return persist(RoadGuestbook.builder().guestbook(book(author, status, time)).locationAlias("바닷길")
                .latitude(33.5).longitude(126.6).build());
    }
    private void like(Guestbook book, User user) { persist(GuestbookLike.builder().guestbook(book).user(user).build()); }

    /** 조회 성공·실패·반복에서 방명록·사용자·방문·미션·보상 전체 저장값을 비교한다. */
    private Map<String, List<Map<String, Object>>> state() {
        reload();
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (String table : List.of("guestbook", "location_guestbook", "road_guestbook", "guestbook_like", "user",
                "visited_location", "location", "mission", "mission_reward_status", "acquired_coupon", "acquired_ar_character")) {
            result.put(table, jdbc.queryForList("select * from " + table));
        }
        return result;
    }

    @Test void 기본은_각각10개이며_독립페이지와_마지막_범위밖을_반환한다() throws Exception {
        VisitedLocation v = ownVisit();
        for (int i = 0; i < 11; i++) { general(other, v, GuestbookStatus.ACTIVE, NOW, null); road(other, GuestbookStatus.ACTIVE, NOW); }
        reload();
        String first = json(request().andExpect(jsonPath("$.generalGuestbooks", hasSize(10)))
                .andExpect(jsonPath("$.roadGuestbooks", hasSize(10)))
                .andExpect(jsonPath("$.generalGuestbooksPage.size").value(10)).andExpect(jsonPath("$.roadGuestbooksPage.size").value(10))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(true)).andExpect(jsonPath("$.roadGuestbooksPage.hasNext").value(true)));
        assertThat(ids(first, "generalGuestbooks")).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        assertThat(ids(first, "roadGuestbooks")).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        mvc.perform(query().param("generalPage", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.generalGuestbooks", hasSize(1))).andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(false))
                .andExpect(jsonPath("$.roadGuestbooks", hasSize(10))).andExpect(jsonPath("$.roadGuestbooksPage.page").value(0));
        mvc.perform(query().param("generalPage", "1").param("generalSize", "3").param("roadPage", "1").param("roadSize", "4"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.generalGuestbooks", hasSize(3)))
                .andExpect(jsonPath("$.generalGuestbooks[0].id").value(ids(first, "generalGuestbooks").get(3)))
                .andExpect(jsonPath("$.roadGuestbooks", hasSize(4)))
                .andExpect(jsonPath("$.roadGuestbooks[0].id").value(ids(first, "roadGuestbooks").get(4)));
        mvc.perform(query().param("generalPage", "99").param("roadPage", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.generalGuestbooks", hasSize(0))).andExpect(jsonPath("$.generalGuestbooksPage.size").value(10))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(false)).andExpect(jsonPath("$.roadGuestbooks", hasSize(1)))
                .andExpect(jsonPath("$.roadGuestbooksPage.hasNext").value(false));
    }

    @Test void 저장시각으로_정렬하고_방문날짜와_작성자와_좋아요는_정렬에_영향없다() throws Exception {
        LocationGuestbook old = general(current, ownVisit(), GuestbookStatus.ACTIVE, NOW.minusHours(1), null);
        RoadGuestbook oldRoad = road(current, GuestbookStatus.ACTIVE, NOW.minusHours(1));
        LocationGuestbook recent = general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW, null);
        RoadGuestbook recentRoad = road(other, GuestbookStatus.ACTIVE, NOW);
        like(old.getGuestbook(), current); like(oldRoad.getGuestbook(), current);
        reload();
        jdbc.update("update guestbook set visited_at='2000-01-01' where id in (?,?)", recent.getGuestbookId(), recentRoad.getGuestbookId());
        String body = json(request());
        assertThat(ids(body, "generalGuestbooks")).containsExactly(recent.getGuestbookId(), old.getGuestbookId());
        assertThat(ids(body, "roadGuestbooks")).containsExactly(recentRoad.getGuestbookId(), oldRoad.getGuestbookId());
    }

    @Test void 비활성과_끊긴장소는_페이지전에_제외하고_작성자삭제는_유지한다() throws Exception {
        LocationGuestbook valid = general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW, null);
        RoadGuestbook validRoad = road(other, GuestbookStatus.ACTIVE, NOW);
        general(current, null, GuestbookStatus.ACTIVE, NOW.plusHours(1), null);
        general(current, ownVisit(), GuestbookStatus.INACTIVE, NOW.plusHours(1), null);
        road(current, GuestbookStatus.INACTIVE, NOW.plusHours(1));
        Location removed = place(); VisitedLocation removedVisit = visit(current, removed, NOW);
        general(current, removedVisit, GuestbookStatus.ACTIVE, NOW.plusHours(1), null);
        Location removedVisitPlace = place(); VisitedLocation v = visit(current, removedVisitPlace, NOW);
        general(current, v, GuestbookStatus.ACTIVE, NOW.plusHours(1), null);
        reload();
        jdbc.update("delete from location where id=?", removed.getId());
        jdbc.update("delete from visited_location where id=?", v.getId());
        jdbc.update("delete from user where id=?", other.getId()); em.clear();
        mvc.perform(query().param("generalSize", "1").param("roadSize", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.generalGuestbooks", hasSize(1))).andExpect(jsonPath("$.generalGuestbooks[0].id").value(valid.getGuestbookId()))
                .andExpect(jsonPath("$.generalGuestbooks[0].userId").value(nullValue()))
                .andExpect(jsonPath("$.generalGuestbooks[0].userNickname").value(nullValue()))
                .andExpect(jsonPath("$.generalGuestbooks[0].characterImgUrl").value(nullValue()))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(false))
                .andExpect(jsonPath("$.roadGuestbooks[0].id").value(validRoad.getGuestbookId()))
                .andExpect(jsonPath("$.roadGuestbooks[0].userId").value(nullValue()))
                .andExpect(jsonPath("$.roadGuestbooks[0].userNickname").value(nullValue()))
                .andExpect(jsonPath("$.roadGuestbooks[0].characterImgUrl").value(nullValue()))
                .andExpect(jsonPath("$.roadGuestbooksPage.hasNext").value(false));
    }

    @Test void 방문장소는_본인전체를_중복없이_최근방문과_장소ID순으로_반환한다() throws Exception {
        VisitedLocation original = ownVisit();
        Location one = place(); Location two = place(); Location notMine = place();
        visit(current, one, NOW); visit(current, two, NOW); visit(other, notMine, NOW.plusDays(1));
        general(other, original, GuestbookStatus.ACTIVE, NOW, null);
        reload();
        String body = json(mvc.perform(query().param("generalSize", "1").param("roadPage", "99")));
        assertThat(ids(body, "visitedLocations")).containsExactly(two.getId(), one.getId(), location.getId());
        assertThat(ids(body, "visitedLocations")).doesNotHaveDuplicates();
    }

    @Test void 좋아요는_사용자별이며_반복조회는_확인시각만_갱신한다() throws Exception {
        LocationGuestbook g = general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW, null);
        RoadGuestbook r = road(other, GuestbookStatus.ACTIVE, NOW);
        road(current, GuestbookStatus.ACTIVE, NOW.minusHours(1));
        like(g.getGuestbook(), current); like(g.getGuestbook(), other); like(r.getGuestbook(), other);
        Map<String, List<Map<String, Object>>> before = state();
        String first = json(request().andExpect(jsonPath("$.generalGuestbooks[0].likeCount").value(2))
                .andExpect(jsonPath("$.generalGuestbooks[0].isLiked").value(true))
                .andExpect(jsonPath("$.roadGuestbooks[0].likeCount").value(1)).andExpect(jsonPath("$.roadGuestbooks[0].isLiked").value(false))
                .andExpect(jsonPath("$.roadGuestbooks[1].likeCount").value(0)).andExpect(jsonPath("$.roadGuestbooks[1].isLiked").value(false)));
        reload();
        assertThat(em.find(User.class, current.getId()).getGuestbookLastCheckedAt()).isEqualTo(NOW);
        Object otherCheckedAt = before.get("user").stream()
                .filter(row -> ((Number) row.get("id")).longValue() == other.getId())
                .findFirst().orElseThrow().get("guestbook_last_checked_at");
        assertThat(jdbc.queryForMap("select * from user where id=?", other.getId()).get("guestbook_last_checked_at"))
                .isEqualTo(otherCheckedAt);
        when(clock.instant()).thenReturn(CLOCK.instant().plusSeconds(60));
        assertThat(json(request())).isEqualTo(first);
        reload();
        assertThat(em.find(User.class, current.getId()).getGuestbookLastCheckedAt()).isEqualTo(NOW.plusMinutes(1));
        mvc.perform(get(URL).header("Authorization", bearer(other))).andExpect(status().isOk())
                .andExpect(jsonPath("$.generalGuestbooks[0].isLiked").value(true)).andExpect(jsonPath("$.generalGuestbooks[0].likeCount").value(2))
                .andExpect(jsonPath("$.roadGuestbooks[0].isLiked").value(true)).andExpect(jsonPath("$.roadGuestbooks[0].likeCount").value(1))
                .andExpect(jsonPath("$.visitedLocations", hasSize(0)));
        Map<String, List<Map<String, Object>>> after = state();
        // 정상 조회한 두 사용자의 확인 시각과 Auditing 수정 시각만 변경될 수 있다.
        for (Map<String, Object> row : before.get("user")) {
            long id = ((Number) row.get("id")).longValue();
            if (id == current.getId() || id == other.getId()) {
                Map<String, Object> actual = after.get("user").stream()
                        .filter(value -> ((Number) value.get("id")).longValue() == id).findFirst().orElseThrow();
                row.put("guestbook_last_checked_at", actual.get("guestbook_last_checked_at"));
                row.put("updated_at", actual.get("updated_at"));
            }
        }
        assertThat(after).isEqualTo(before); verifyNoInteractions(storage);
    }

    @ParameterizedTest @EnumSource(MissionTypeCode.class)
    void 비활성_미완료_미션도_저장된연결과_콘텐츠를_유지한다(MissionTypeCode code) throws Exception {
        current.assignOnboardingResult(persist(MapModalFixtures.onboarding()));
        MissionType type = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class).setParameter("type", code).getSingleResult();
        Mission mission = persist(Mission.builder().missionType(type).build());
        switch (code) {
            case CULTURE -> persist(CultureMission.builder().mission(mission).status(MissionActivationStatus.INACTIVE).build());
            case TREASURE -> persist(TreasureMission.builder().mission(mission).status(MissionActivationStatus.INACTIVE).itemTotalCount(3).build());
            case COOPERATIVE -> persist(CooperativeMission.builder().mission(mission).status(MissionActivationStatus.INACTIVE).build());
        }
        general(current, ownVisit(), GuestbookStatus.ACTIVE, NOW, mission); road(current, GuestbookStatus.ACTIVE, NOW); reload();
        request().andExpect(status().isOk()).andExpect(jsonPath("$.generalGuestbooks[0].mission.id").value(mission.getId()))
                .andExpect(jsonPath("$.generalGuestbooks[0].mission.missionType").value(code.name()))
                .andExpect(jsonPath("$.generalGuestbooks[0].mission.missionTitle").value(type.getTitle()))
                .andExpect(jsonPath("$.generalGuestbooks[0].location.id").value(location.getId()))
                .andExpect(jsonPath("$.generalGuestbooks[0].location.locationAddress").value("제주"))
                .andExpect(jsonPath("$.generalGuestbooks[0].location.latitude").value(33.0))
                .andExpect(jsonPath("$.generalGuestbooks[0].characterImgUrl").value("https://example.com/profile.png"))
                .andExpect(jsonPath("$.roadGuestbooks[0].characterImgUrl").value("https://example.com/profile.png"))
                .andExpect(jsonPath("$.generalGuestbooks[0].contentImageUrl").value("https://example.com/image.jpg"))
                .andExpect(jsonPath("$.generalGuestbooks[0].contentAudioUrl").value("https://example.com/audio.m4a"))
                .andExpect(jsonPath("$.roadGuestbooks[0].audioTitle").value("제주의 소리"))
                .andExpect(jsonPath("$.generalGuestbooks[0].contentTemperatureCelsius").value(24.5))
                .andExpect(jsonPath("$.generalGuestbooks[0].savedAt").value("2026-10-27T12:00:00"))
                .andExpect(jsonPath("$.generalGuestbooks[0].visitedAt").value(DATE.toString()));
    }

    @Test void 미션삭제와_없는프로필_선택콘텐츠는_null키를_유지하고_길바닥이_비어도_성공한다() throws Exception {
        MissionType type = em.createQuery("select t from MissionType t", MissionType.class).setMaxResults(1).getSingleResult();
        Mission mission = persist(Mission.builder().missionType(type).build());
        LocationGuestbook g = general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW, mission); reload();
        jdbc.update("delete from mission where id=?", mission.getId());
        jdbc.update("update guestbook set content_img_url=null,content_audio_url=null,audio_title=null,content_writing=null,content_weather=null,content_temperature_celsius=null,content_color_code=null where id=?", g.getGuestbookId());
        em.clear();
        String body = json(request().andExpect(jsonPath("$.roadGuestbooks", hasSize(0))));
        Map<String, Object> item = JsonPath.read(body, "$.generalGuestbooks[0]");
        for (String field : List.of("mission", "characterImgUrl", "userNickname", "contentImageUrl", "contentAudioUrl", "audioTitle", "contentWriting", "contentWeather", "contentTemperatureCelsius", "contentColorCode")) {
            assertThat(item).containsEntry(field, null);
        }
    }

    @Test void 전체가_비어도_필수목록과_페이지는_있으며_일반GET은_파일검증에_막히지않는다() throws Exception {
        jdbc.update("delete from visited_location where user_id=?", current.getId()); em.clear();
        request().andExpect(status().isOk()).andExpect(jsonPath("$.visitedLocations", hasSize(0)))
                .andExpect(jsonPath("$.generalGuestbooks", hasSize(0))).andExpect(jsonPath("$.roadGuestbooks", hasSize(0)))
                .andExpect(jsonPath("$.generalGuestbooksPage.page").value(0)).andExpect(jsonPath("$.generalGuestbooksPage.size").value(10))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(false)).andExpect(jsonPath("$.roadGuestbooksPage.size").value(10))
                .andExpect(jsonPath("$.roadGuestbooksPage.hasNext").value(false));
        reload();
        assertThat(em.find(User.class, current.getId()).getGuestbookLastCheckedAt()).isEqualTo(NOW);
        road(other, GuestbookStatus.ACTIVE, NOW); reload();
        request().andExpect(status().isOk()).andExpect(jsonPath("$.generalGuestbooks", hasSize(0)))
                .andExpect(jsonPath("$.roadGuestbooks", hasSize(1)));
    }

    @ParameterizedTest @CsvSource({"generalPage,-1", "generalSize,0", "roadPage,-1", "roadSize,-1", "generalPage,0.5", "roadSize,abc", "generalSize,11", "roadSize,11", "guestbookType,LOCATION", "sort,new", "sort,''"})
    void 잘못된페이지는_공통400이며_데이터는_유지한다(String field, String value) throws Exception {
        Map<String, List<Map<String, Object>>> before = state();
        mvc.perform(query().param(field, value)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST")).andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
        assertThat(state()).isEqualTo(before);
    }

    @Test void 인증누락_잘못된토큰_없는사용자는_401이며_저장하지않는다() throws Exception {
        Map<String, List<Map<String, Object>>> before = state();
        mvc.perform(get(URL)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get(URL).header("Authorization", "Bearer invalid")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        User missing = MapModalFixtures.user(Long.MAX_VALUE, "missing@example.com");
        mvc.perform(get(URL).header("Authorization", bearer(missing))).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        assertThat(state()).isEqualTo(before); verifyNoInteractions(storage);
    }

    @Test void 스웨거에_네페이지조건과_조회응답이있고_POST는_multipart를_유지한다() throws Exception {
        String body = json(mvc.perform(get("/v3/api-docs")));
        List<String> names = JsonPath.read(body, "$.paths['/api/v2/guestbooks'].get.parameters[*].name");
        assertThat(names).containsExactlyInAnyOrder("generalPage", "generalSize", "roadPage", "roadSize", "guestbookType", "sort");
        List<Object> defaults = JsonPath.read(body, "$.paths['/api/v2/guestbooks'].get.parameters[*].schema.default");
        assertThat(defaults.stream().filter(Number.class::isInstance).map(Number.class::cast).map(Number::intValue).toList()).containsExactlyInAnyOrder(0, 10, 0, 10);
        Map<String, Object> properties = JsonPath.read(body, "$.components.schemas.GetGuestbooksResponse.properties");
        assertThat(properties).containsOnlyKeys("visitedLocations", "generalGuestbooks", "roadGuestbooks", "generalGuestbooksPage", "roadGuestbooksPage");
        Map<String, Object> content = JsonPath.read(body, "$.paths['/api/v2/guestbooks'].post.requestBody.content");
        assertThat(content).containsKey("multipart/form-data");
    }

    @ParameterizedTest @CsvSource({"ALL,1,1", "GENERAL,1,0", "ROAD,0,1"})
    void 유형필터는_선택한목록만_반환한다(String type, int generalCount, int roadCount) throws Exception {
        general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW, null);
        road(other, GuestbookStatus.ACTIVE, NOW); reload();
        mvc.perform(query().param("guestbookType", type))
                .andExpect(status().isOk()).andExpect(jsonPath("$.generalGuestbooks", hasSize(generalCount)))
                .andExpect(jsonPath("$.roadGuestbooks", hasSize(roadCount)))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(false))
                .andExpect(jsonPath("$.roadGuestbooksPage.hasNext").value(false));
    }

    @ParameterizedTest @CsvSource({"content_writing", "content_img_url", "content_audio_url", "content_weather"})
    void 콘텐츠유무와_관계없이_최신순으로_페이지를반환한다(String column) throws Exception {
        LocationGuestbook old = general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW.minusDays(1), null);
        RoadGuestbook oldRoad = road(other, GuestbookStatus.ACTIVE, NOW.minusDays(1));
        LocationGuestbook blank = general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW, null);
        RoadGuestbook missing = road(other, GuestbookStatus.ACTIVE, NOW); reload();
        jdbc.update("update guestbook set " + column + "='   ' where id=?", blank.getGuestbookId());
        jdbc.update("update guestbook set " + column + "=null where id=?", missing.getGuestbookId());
        String first = json(mvc.perform(query().param("generalSize", "1").param("roadSize", "1"))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(true))
                .andExpect(jsonPath("$.roadGuestbooksPage.hasNext").value(true)));
        assertThat(ids(first, "generalGuestbooks")).containsExactly(blank.getGuestbookId());
        assertThat(ids(first, "roadGuestbooks")).containsExactly(missing.getGuestbookId());
        String second = json(mvc.perform(query().param("generalSize", "1").param("roadSize", "1")
                .param("generalPage", "1").param("roadPage", "1"))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(false))
                .andExpect(jsonPath("$.roadGuestbooksPage.hasNext").value(false)));
        assertThat(ids(second, "generalGuestbooks")).containsExactly(old.getGuestbookId());
        assertThat(ids(second, "roadGuestbooks")).containsExactly(oldRoad.getGuestbookId());
    }

    @Test void 내글과_좋아요필터는_인증사용자기준이며_첨부가없어도_포함한다() throws Exception {
        LocationGuestbook mine = general(current, ownVisit(), GuestbookStatus.ACTIVE, NOW.minusHours(2), null);
        LocationGuestbook theirs = general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW, null);
        RoadGuestbook mineRoad = road(current, GuestbookStatus.ACTIVE, NOW.minusHours(1));
        RoadGuestbook theirsRoad = road(other, GuestbookStatus.ACTIVE, NOW);
        like(mine.getGuestbook(), other); like(theirs.getGuestbook(), current);
        like(mineRoad.getGuestbook(), current); like(theirsRoad.getGuestbook(), other); reload();
        String mineBody = json(mvc.perform(query().param("sort", "MINE")));
        assertThat(ids(mineBody, "generalGuestbooks")).containsExactly(mine.getGuestbookId());
        assertThat(ids(mineBody, "roadGuestbooks")).containsExactly(mineRoad.getGuestbookId());
        String likedBody = json(mvc.perform(query().param("sort", "LIKED")));
        assertThat(ids(likedBody, "generalGuestbooks")).containsExactly(theirs.getGuestbookId());
        assertThat(ids(likedBody, "roadGuestbooks")).containsExactly(mineRoad.getGuestbookId());
        String otherBody = json(mvc.perform(get(URL).header("Authorization", bearer(other)).param("sort", "LIKED")));
        assertThat(ids(otherBody, "generalGuestbooks")).containsExactly(mine.getGuestbookId());
        assertThat(ids(otherBody, "roadGuestbooks")).containsExactly(theirsRoad.getGuestbookId());
        jdbc.update("update guestbook set content_img_url=null where id=?", theirs.getGuestbookId()); em.clear();
        mvc.perform(query().param("sort", "LIKED").param("guestbookType", "GENERAL"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.generalGuestbooks", hasSize(1)))
                .andExpect(jsonPath("$.roadGuestbooks", hasSize(0)));
    }

    @Test void 인기순은_전체후보에서_정렬한뒤_페이지를자르고_동률은_저장시각과ID순이다() throws Exception {
        LocationGuestbook popular = general(other, ownVisit(), GuestbookStatus.ACTIVE, NOW.minusDays(2), null);
        RoadGuestbook popularRoad = road(other, GuestbookStatus.ACTIVE, NOW.minusDays(2));
        for (int i = 0; i < 12; i++) {
            general(current, ownVisit(), GuestbookStatus.ACTIVE, NOW, null);
            road(current, GuestbookStatus.ACTIVE, NOW);
        }
        like(popular.getGuestbook(), current); like(popular.getGuestbook(), other);
        like(popularRoad.getGuestbook(), current); like(popularRoad.getGuestbook(), other); reload();
        String latest = json(request());
        String first = json(mvc.perform(query().param("sort", "POPULAR"))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(true))
                .andExpect(jsonPath("$.roadGuestbooksPage.hasNext").value(true))
                .andExpect(jsonPath("$.generalGuestbooks[0].likeCount").value(2)));
        assertThat(ids(first, "generalGuestbooks")).startsWith(popular.getGuestbookId());
        assertThat(ids(first, "roadGuestbooks")).startsWith(popularRoad.getGuestbookId());
        assertThat(ids(first, "generalGuestbooks").subList(1, 10)).containsExactlyElementsOf(ids(latest, "generalGuestbooks").subList(0, 9));
        String second = json(mvc.perform(query().param("sort", "POPULAR").param("generalPage", "1").param("roadPage", "1"))
                .andExpect(jsonPath("$.generalGuestbooks", hasSize(3)))
                .andExpect(jsonPath("$.roadGuestbooks", hasSize(3)))
                .andExpect(jsonPath("$.generalGuestbooksPage.hasNext").value(false)));
        assertThat(ids(second, "generalGuestbooks")).doesNotContainAnyElementsOf(ids(first, "generalGuestbooks"));
        assertThat(ids(second, "roadGuestbooks")).doesNotContainAnyElementsOf(ids(first, "roadGuestbooks"));
    }
}
