package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·HTTP·MySQL로 상태 조회의 단계별 계약과 최초 완료 보상 및 읽기 전용 동작을 검증한다. */
@Transactional
class GetCooperativeMissionStatusApiIntegrationTest extends CooperativeMissionIntegrationTestSupport {
    private static final String STATUS_URL="/api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress";
    @MockitoBean TourApiClient tour;
    @MockitoSpyBean LocationRepository locations;
    @MockitoSpyBean MissionRewardStatusRepository rewards;

    @ParameterizedTest @ValueSource(ints={1,2})
    void 단계별_참가정렬과_역할집계가_같은팀에만_한정된다(int step) throws Exception {
        var host=user(); var guest=user(); var late=user();
        var progress=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,step,false);
        var early=participant(guest,progress,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER);
        var later=participant(late,progress,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER);
        em.persist(early); em.persist(later); em.flush();
        var hostRow=em.createQuery("select p from CooperativeMissionParticipant p where p.user.id=:id",
                CooperativeMissionParticipant.class).setParameter("id",host.getId()).getSingleResult();
        var card1=roleCard(); var card2=roleCard();
        var done=CooperativeMissionRoleProgress.builder().participant(hostRow).roleCard(card1).build();
        done.complete("proof.jpg",JOINED_AT); em.persist(done);
        em.persist(CooperativeMissionRoleProgress.builder().participant(early).roleCard(card2).build());
        var foreign=team(user(),mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        roleProgress(foreign);
        clear();
        jdbc.update("update cooperative_mission_participant set created_at=? where id=?",JOINED_AT,early.getId());
        jdbc.update("update cooperative_mission_participant set created_at=? where id=?",JOINED_AT.plusSeconds(1),later.getId());
        var before=snapshot(progress.getId()); var rewardBefore=rewardSnapshot(host);
        var result=read(host,progress.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStep").value(step))
                .andExpect(jsonPath("$.completedRoleCount").value(1))
                .andExpect(jsonPath("$.totalRoleCount").value(2))
                .andExpect(jsonPath("$.reward").value(nullValue()))
                .andExpect(jsonPath("$.nextLocation").value(nullValue()));
        List<Number> ids=JsonPath.read(result.andReturn().getResponse().getContentAsString(),"$.participants[*].participantId");
        assertThat(ids.stream().map(Number::longValue).toList()).containsExactly(hostRow.getId(),early.getId(),later.getId());
        List<Number> roleIds=JsonPath.read(result.andReturn().getResponse().getContentAsString(),"$.roleProgresses[*].roleCardId");
        assertThat(roleIds.stream().map(Number::longValue).toList()).containsExactly(card1.getId(),card2.getId());
        List<Number> cards=JsonPath.read(result.andReturn().getResponse().getContentAsString(),"$.roleCards[*].roleCardId");
        assertThat(cards.stream().map(Number::longValue).toList()).isSorted();
        clear();
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        assertThat(rewardSnapshot(host)).isEqualTo(rewardBefore);
        verifyNoInteractions(tour);
    }

    @Test void 빈역할은_빈배열과0이고_전체인증완료여도_팀은자동완료하지않는다() throws Exception {
        var user=user();
        var progress=team(user,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false);
        clear();
        read(user,progress.getId()).andExpect(jsonPath("$.roleProgresses").isEmpty())
                .andExpect(jsonPath("$.totalRoleCount").value(0));
        roleProgress(em.find(CooperativeMissionProgress.class,progress.getId())); clear();
        read(user,progress.getId()).andExpect(jsonPath("$.missionProgressStatus").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.completedRoleCount").value(1));
    }

    @Test void 참여후_대기_수락_거절이_다음폴링에_반영된다() throws Exception {
        var host=user(); var guest=user(); var rejected=user();
        var progress=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        clear();
        var joined=body(join(guest,progress.getTeamToken()).andExpect(status().isCreated()));
        long participantId=((Number)joined.get("participantId")).longValue();
        read(guest,progress.getId()).andExpect(jsonPath("$.currentParticipant.participantStatus").value("PENDING"));
        decide(host,progress.getId(),participantId,"ACCEPT").andExpect(status().isNoContent());
        clear();
        read(guest,progress.getId()).andExpect(jsonPath("$.currentParticipant.participantStatus").value("ACCEPTED"));
        var pending=body(join(rejected,progress.getTeamToken()).andExpect(status().isCreated()));
        read(rejected,progress.getId()).andExpect(status().isOk());
        decide(host,progress.getId(),((Number)pending.get("participantId")).longValue(),"REJECT")
                .andExpect(status().isNoContent());
        clear();
        error(read(rejected,progress.getId()),404,"COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND",
                "협동 미션 참여 요청을 찾을 수 없습니다.");
    }

    @ParameterizedTest @ValueSource(ints={0,1,2,3,4,5,6,7})
    void 최초완료는_지급true인_항목만표시하며_조회가_지급하지않는다(int mask) throws Exception {
        var user=user(); var mission=rewardedMission(null);
        var progress=team(user,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,3,true);
        지급상태(user,mission,mask); clear();
        var before=snapshot(progress.getId()); var rewardBefore=rewardSnapshot(user);
        for(int i=0;i<2;i++) {
            var result=read(user,progress.getId()).andExpect(status().isOk());
            if ((mask&1)!=0) result.andExpect(jsonPath("$.reward.arCharacter.id").value(mission.getArCharacter().getId()));
            else result.andExpect(jsonPath("$.reward.arCharacter").value(nullValue()));
            if ((mask&2)!=0) result.andExpect(jsonPath("$.reward.point").value(200));
            else result.andExpect(jsonPath("$.reward.point").value(nullValue()));
            if ((mask&4)!=0) result.andExpect(jsonPath("$.reward.coupon.couponPrice").value(5000));
            else result.andExpect(jsonPath("$.reward.coupon").value(nullValue()));
            result.andExpect(jsonPath("$.currentParticipant").value(nullValue()))
                    .andExpect(jsonPath("$.participants").value(nullValue()))
                    .andExpect(jsonPath("$.roleCards").value(nullValue()))
                    .andExpect(jsonPath("$.roleProgresses").value(nullValue()));
        }
        clear();
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        assertThat(rewardSnapshot(user)).isEqualTo(rewardBefore);
    }

    @Test void 같은팀의_최초완료자와_재도전자는_다른보상이고_과거팀조회는_유지된다() throws Exception {
        var retry=user(); var first=user(); var mission=rewardedMission(null);
        var old=team(retry,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,3,true);
        old.complete(JOINED_AT.minusDays(1));
        var current=team(retry,mission,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER,3,true);
        em.persist(participant(first,current,ParticipantStatus.ACCEPTED,ParticipantRole.HOST));
        지급상태(retry,mission,7); 지급상태(first,mission,7); clear();
        emptyReward(read(retry,current.getId()).andExpect(status().isOk()));
        read(first,current.getId()).andExpect(jsonPath("$.reward.point").value(200));
        read(retry,old.getId()).andExpect(jsonPath("$.reward.point").value(200));
    }

    @Test void 지급기록이없거나_보상설정이없으면_완료해도_빈보상이다() throws Exception {
        var user=user(); var mission=rewardedMission(null);
        var progress=team(user,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,3,true);
        var noReward=CooperativeMission.builder().mission(commonMission(MissionTypeCode.COOPERATIVE))
                .status(MissionActivationStatus.ACTIVE).build(); em.persist(noReward);
        var empty=team(user,noReward,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,3,true);
        지급상태(user,noReward,7); clear();
        emptyReward(read(user,progress.getId()).andExpect(status().isOk()));
        emptyReward(read(user,empty.getId()).andExpect(status().isOk()));
        read(user,progress.getId()).andExpect(jsonPath("$.completedLocation").value(nullValue()));
    }

    @Test void 실제추천에서_완료장소를제외하고_이미지없음과_후보없음을_처리한다() throws Exception {
        var user=user(); var completed=location(0.0); var next=location(0.01);
        var mission=rewardedMission(completed);
        var progress=team(user,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,3,true);
        clear();
        doReturn(List.of(completed,next)).when(locations).findAll(Sort.by("id"));
        var result=read(user,progress.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.completedLocation.locationId").value(completed.getId()))
                .andExpect(jsonPath("$.nextLocation.id").value(next.getId()))
                .andExpect(jsonPath("$.nextLocation.locationImageUrl").value(nullValue()))
                .andExpect(jsonPath("$.nextLocation.mission").value(nullValue()));
        assertThat(((Number)((Map<?,?>)body(result).get("nextLocation")).get("distanceMeter")).intValue()).isPositive();
        verify(tour).getLocationImageUrl(next.getContentId());
        doReturn(List.of(completed)).when(locations).findAll(Sort.by("id"));
        read(user,progress.getId()).andExpect(jsonPath("$.nextLocation").value(nullValue()));
    }

    @Test void 연결된활성미션이있으면_추천미션도_반환한다() throws Exception {
        var user=user(); var next=location(0.01);
        var linked=rewardedMission(next);
        var progress=team(user,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,3,true);
        clear(); doReturn(List.of(next)).when(locations).findAll(Sort.by("id"));
        read(user,progress.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.nextLocation.mission.id").value(linked.getMissionId()))
                .andExpect(jsonPath("$.nextLocation.mission.missionType").value("COOPERATIVE"));
    }

    @Test void 도메인404와_인증401은_기존데이터를_보존한다() throws Exception {
        var user=user(); var outsider=user(); var mission=mission();
        var progress=team(user,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        clear(); var before=snapshot(progress.getId());
        error(read(user,Long.MAX_VALUE),404,"COOPERATIVE_MISSION_PROGRESS_NOT_FOUND","진행 중인 협동 미션을 찾을 수 없습니다.");
        error(read(outsider,progress.getId()),404,"COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND","협동 미션 참여 요청을 찾을 수 없습니다.");
        error(mvc.perform(get(STATUS_URL,progress.getId()).param("latitude","0").param("longitude","0")),
                401,"UNAUTHORIZED","인증이 필요합니다.");
        error(read(activeUser(Long.MAX_VALUE),progress.getId()),401,"UNAUTHORIZED","인증이 필요합니다.");
        clear(); assertThat(snapshot(progress.getId())).isEqualTo(before);
        em.find(CooperativeMission.class,mission.getMissionId()).changeStatus(MissionActivationStatus.INACTIVE); clear();
        error(read(user,progress.getId()),404,"COOPERATIVE_MISSION_INACTIVE","비활성화된 협동 미션입니다.");
        assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @Test void 잘못된경로와_좌표는400_양끝경계는허용한다() throws Exception {
        var user=user(); var progress=team(user,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        clear(); var before=snapshot(progress.getId());
        String bearer="Bearer "+tokens.createAccessToken(user).value();
        for(String[] coords:List.of(new String[]{"","0"},new String[]{"0",""},new String[]{"bad","0"},
                new String[]{"90.01","0"},new String[]{"-90.01","0"},
                new String[]{"0","180.01"},new String[]{"0","-180.01"})) {
            var req=get(STATUS_URL,progress.getId()).header("Authorization",bearer);
            if(!coords[0].isEmpty())req.param("latitude",coords[0]);
            if(!coords[1].isEmpty())req.param("longitude",coords[1]);
            error(mvc.perform(req),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");
        }
        error(read(user,"bad"),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");
        for(String[] coords:List.of(new String[]{"90","180"},new String[]{"-90","-180"}))
            mvc.perform(get(STATUS_URL,progress.getId()).header("Authorization",bearer)
                    .param("latitude",coords[0]).param("longitude",coords[1])).andExpect(status().isOk());
        clear(); assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @Test void 보상조회실패는500이며_내부원인과_데이터변경이없다() throws Exception {
        var user=user(); var mission=rewardedMission(null);
        var progress=team(user,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,3,true);
        clear(); var before=snapshot(progress.getId()); var rewardBefore=rewardSnapshot(user);
        doThrow(new IllegalStateException("status-test-secret")).when(rewards).findById(any());
        var response=read(user,progress.getId());
        error(response,500,"INTERNAL_SERVER_ERROR","서버 내부 오류가 발생했습니다.");
        assertThat(response.andReturn().getResponse().getContentAsString()).doesNotContain("status-test-secret");
        clear(); assertThat(snapshot(progress.getId())).isEqualTo(before);
        assertThat(rewardSnapshot(user)).isEqualTo(rewardBefore);
    }

    @Test void Swagger는_GET필수좌표와_역할복합식별필드를_노출한다() throws Exception {
        String json=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        List<Map<String,Object>> parameters=JsonPath.read(json,"$['paths']['"+STATUS_URL+"']['get']['parameters']");
        assertThat(parameters).filteredOn(p->List.of("latitude","longitude").contains(p.get("name")))
                .hasSize(2).allSatisfy(p->assertThat(p.get("required")).isEqualTo(true));
        Map<String,Object> properties=JsonPath.read(json,"$.components.schemas.GetCooperativeMissionStatusResponse.properties");
        assertThat(properties).containsKeys("currentParticipant","roleProgresses","reward","nextLocation")
                .doesNotContainKey("teamToken");
        assertThat(json).doesNotContain("\"roleProgressId\"");
    }

    /** 지정된 지급 상태를 준비하며 실제 보상을 지급하는 행위는 수행하지 않는다. */
    private void 지급상태(User user,CooperativeMission mission,int mask) {
        var reward=MissionRewardStatus.builder().mission(mission.getMission()).user(user).build();
        if((mask&1)!=0)reward.grantArCharacterReward();
        if((mask&2)!=0)reward.grantPointReward();
        if((mask&4)!=0)reward.grantCouponReward();
        em.persist(reward);
    }
    /** 필수 속성을 모두 채운 실제 보상 설정을 준비한다. */
    private CooperativeMission rewardedMission(Location location) {
        var character=ArCharacter.builder().name("감귤").description("설명").storyTitle("이야기")
                .acquireCondition("완료").imgUrl("character.png").representativeColor("#FFA500").hashtags(List.of()).build();
        em.persist(character);
        var coupon=Coupon.builder().couponPrice(5000).location(location).build(); em.persist(coupon);
        var mission=CooperativeMission.builder().mission(commonMission(MissionTypeCode.COOPERATIVE))
                .status(MissionActivationStatus.ACTIVE).location(location).arCharacter(character).point(200).coupon(coupon).build();
        em.persist(mission); em.flush(); return mission;
    }
    /** 외부 데이터에 의존하지 않는 고유한 장소를 준비한다. */
    private Location location(double longitude) {
        var result=Location.builder().contentId(Math.abs(UUID.randomUUID().getMostSignificantBits()>>>1))
                .title("테스트 장소").address("주소").category("관광지").radius(100).latitude(0).longitude(longitude).build();
        em.persist(result); return result;
    }
    /** 공통 카드 전체와 별개로 테스트에서 배정할 카드를 준비한다. */
    private CooperativeRoleCard roleCard() {
        var card=CooperativeRoleCard.builder().roleName("테스트").roleDescription("역할").locationToFind(List.of("돌담")).build();
        em.persist(card); return card;
    }
    /** 실제 JWT가 포함된 GET 요청을 수행한다. */
    private ResultActions read(User user,Object progressId) throws Exception {
        return mvc.perform(get(STATUS_URL,progressId).header("Authorization","Bearer "+tokens.createAccessToken(user).value())
                .param("latitude","0").param("longitude","0"));
    }
    /** 기존 수락·거절 API를 호출해 폴링과의 연결을 확인한다. */
    private ResultActions decide(User host,Long progressId,long participantId,String decision) throws Exception {
        return mvc.perform(patch("/api/v2/cooperative-missions/{id}/participants/{participantId}",progressId,participantId)
                .header("Authorization","Bearer "+tokens.createAccessToken(host).value()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\""+decision+"\"}"));
    }
    /** 빈 보상도 객체와 세 null 필드를 유지하는지 확인한다. */
    private void emptyReward(ResultActions result) throws Exception {
        result.andExpect(jsonPath("$.reward").isMap())
                .andExpect(jsonPath("$.reward.arCharacter").value(nullValue()))
                .andExpect(jsonPath("$.reward.point").value(nullValue()))
                .andExpect(jsonPath("$.reward.coupon").value(nullValue()));
    }
    /** 명세의 상태·오류 코드·메시지를 확인한다. */
    private void error(ResultActions result,int code,String name,String message) throws Exception {
        result.andExpect(status().is(code)).andExpect(jsonPath("$.code").value(name))
                .andExpect(jsonPath("$.message").value(message));
        assertThat(body(result)).containsOnlyKeys("code","message");
    }
}
