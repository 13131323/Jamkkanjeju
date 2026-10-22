package com.jamkkanjeju.server.domain.cooperativemission.integration;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionIntegrationTestSupport;
import com.jamkkanjeju.server.domain.home.entity.*;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 실제 HTTP·임시 MySQL로 단계·지급·조회 연결과 실패 시 전체 롤백을 검증한다. */
@Transactional
class SaveCooperativeMissionProgressApiIntegrationTest extends CooperativeMissionIntegrationTestSupport {
    private static final String SAVE_URL = "/api/v2/cooperative-missions/{id}/progress";
    @MockitoBean NextLocationRecommender recommender;
    @MockitoSpyBean MissionRewardGranter granter;

    @Test void 수행단계는_단계만변경하고_반복과_다른팀역할을_구분한다() throws Exception {
        var host=user(); var mission=mission();
        var progress=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var other=team(user(),mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        roleProgress(other); clear();
        var before=snapshot(progress.getId()); var otherBefore=snapshot(other.getId()); var rewards=rewardSnapshot(host);
        error(save(host,progress.getId(),2),409,"COOPERATIVE_PARTICIPANT_ROLE_REQUIRED","모든 수락된 참가자에게 역할을 배정해야 합니다.");
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        roleProgress(em.find(CooperativeMissionProgress.class,progress.getId())); clear();
        var unchanged=jdbc.queryForList("select * from cooperative_mission_role_progress order by cooperative_mission_participant_id,cooperative_role_card_id");
        save(host,progress.getId(),2).andExpect(status().isNoContent()).andExpect(content().string("")); clear();
        assertThat(jdbc.queryForObject("select current_step from cooperative_mission_progress where id=?",Integer.class,progress.getId())).isEqualTo(2);
        assertThat(em.find(CooperativeMissionProgress.class,progress.getId()).getCompletedAt()).isNull();
        assertThat(em.find(CooperativeMissionProgress.class,progress.getId()).getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(jdbc.queryForList("select * from cooperative_mission_role_progress order by cooperative_mission_participant_id,cooperative_role_card_id")).isEqualTo(unchanged);
        // 역할 한 건 추가 외에 포인트·지급·획득 데이터는 그대로이다.
        assertThat(rewardSnapshot(host).subList(0,4)).isEqualTo(rewards.subList(0,4));
        assertThat(snapshot(other.getId())).isEqualTo(otherBefore);
        error(save(host,progress.getId(),2),409,"COOPERATIVE_MISSION_STEP_NOT_ALLOWED","현재 단계에서 허용되지 않는 요청입니다.");
    }

    @Test void 대기와_미배정과_미인증은_오류이며_기존행을_보존한다() throws Exception {
        var host=user(); var progress=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var pending=participant(user(),progress,ParticipantStatus.PENDING,ParticipantRole.MEMBER); em.persist(pending); clear();
        var before=snapshot(progress.getId());
        error(save(host,progress.getId(),2),409,"COOPERATIVE_MISSION_PENDING_PARTICIPANT_EXISTS","대기 중인 참여 요청을 모두 처리해야 합니다.");
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        em.find(CooperativeMissionParticipant.class,pending.getId()).accept(LocalDateTime.now(CLOCK)); clear();
        before=snapshot(progress.getId());
        error(save(host,progress.getId(),2),409,"COOPERATIVE_PARTICIPANT_ROLE_REQUIRED","모든 수락된 참가자에게 역할을 배정해야 합니다.");
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        var p=em.find(CooperativeMissionProgress.class,progress.getId()); p.moveToNextStep();
        var hostP=participantOf(p,host); var card=card();
        em.persist(CooperativeMissionRoleProgress.builder().participant(hostP).roleCard(card).build()); clear();
        before=snapshot(progress.getId());
        error(save(host,progress.getId(),3),409,"COOPERATIVE_MISSION_STEP_NOT_ALLOWED","현재 단계에서 허용되지 않는 요청입니다.");
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        verifyNoInteractions(granter);
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void 최초완료는_세보상을지급하고_조회와_재시도에서도_중복지급하지않는다(boolean existingFalse) throws Exception {
        var host=user(); var mission=fullRewardMission();
        var progress=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false); roleProgress(progress);
        if(existingFalse) rewardStatus(host,mission,0);
        clear(); var roleBefore=snapshot(progress.getId()).subList(1,3);
        save(host,progress.getId(),3).andExpect(status().isNoContent()).andExpect(content().string("")); clear();
        assertPaid(host,mission,7,700);
        assertThat(em.find(CooperativeMissionProgress.class,progress.getId()).getCompletedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        assertThat(snapshot(progress.getId()).subList(1,3)).isEqualTo(roleBefore);
        var before=snapshot(progress.getId()); var paid=rewardSnapshot(host);
        error(save(host,progress.getId(),3),409,"COOPERATIVE_MISSION_STEP_NOT_ALLOWED","현재 단계에서 허용되지 않는 요청입니다.");
        when(recommender.recommend(anyDouble(),anyDouble(),isNull())).thenReturn(Optional.empty());
        read(host,progress.getId()).andExpect(status().isOk()).andExpect(jsonPath("$.currentStep").value(3))
                .andExpect(jsonPath("$.reward.point").value(200)).andExpect(jsonPath("$.reward.arCharacter.id").value(mission.getArCharacter().getId()))
                .andExpect(jsonPath("$.reward.coupon.couponPrice").value(5000));
        read(host,progress.getId()).andExpect(status().isOk());
        assertThat(snapshot(progress.getId())).isEqualTo(before); assertThat(rewardSnapshot(host)).isEqualTo(paid);
        var retry=team(em.find(User.class,host.getId()),em.find(CooperativeMission.class,mission.getMissionId()),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false);
        roleProgress(retry); clear(); var retryBefore=rewardSnapshot(host).subList(0,4);
        save(host,retry.getId(),3).andExpect(status().isNoContent()); clear();
        read(host,retry.getId()).andExpect(jsonPath("$.reward.point").isEmpty()).andExpect(jsonPath("$.reward.arCharacter").isEmpty())
                .andExpect(jsonPath("$.reward.coupon").isEmpty());
        assertThat(rewardSnapshot(host).subList(0,4)).isEqualTo(retryBefore);
    }

    @Test void 혼합팀은_최초완료자만지급하며_대기와_재도전은_제외한다() throws Exception {
        var first=user(); var retry=user(); var pending=user(); var mission=fullRewardMission();
        team(retry,mission,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER,3,true);
        rewardStatus(retry,mission,7);
        var progress=team(first,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false);
        em.persist(participant(retry,progress,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER));
        em.persist(participant(pending,progress,ParticipantStatus.PENDING,ParticipantRole.MEMBER)); roleProgress(progress); clear();
        var retryBefore=rewardSnapshot(retry).subList(0,4); var pendingBefore=rewardSnapshot(pending).subList(0,4);
        save(first,progress.getId(),3).andExpect(status().isNoContent()); clear();
        assertPaid(first,mission,7,700);
        assertThat(rewardSnapshot(retry).subList(0,4)).isEqualTo(retryBefore);
        assertThat(rewardSnapshot(pending).subList(0,4)).isEqualTo(pendingBefore);
    }

    @ParameterizedTest @ValueSource(ints={1,2,3,4,5,6,7})
    void 지급상태가_하나라도true이면_최초이력이없어도_추가지급하지않는다(int mask) throws Exception {
        var host=user(); var mission=fullRewardMission();
        var progress=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false); roleProgress(progress);
        rewardStatus(host,mission,mask); clear(); var before=rewardSnapshot(host);
        save(host,progress.getId(),3).andExpect(status().isNoContent()); clear();
        assertThat(rewardSnapshot(host)).isEqualTo(before); verifyNoInteractions(granter);
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void 기존완료자는_지급상태없음이나_false여도_지급하지않는다(boolean falseRow) throws Exception {
        var host=user(); var mission=fullRewardMission();
        team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER,3,true);
        if(falseRow)rewardStatus(host,mission,0);
        var progress=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false); roleProgress(progress); clear();
        var before=rewardSnapshot(host);
        save(host,progress.getId(),3).andExpect(status().isNoContent()); clear();
        assertThat(rewardSnapshot(host)).isEqualTo(before); verifyNoInteractions(granter);
    }

    @Test void 미설정보상과_기존보유보상은_공통규칙을_따른다() throws Exception {
        var host=user(); var pointOnly=mission();
        var pointTeam=team(host,pointOnly,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false); roleProgress(pointTeam); clear();
        save(host,pointTeam.getId(),3).andExpect(status().isNoContent()); clear(); assertPaid(host,pointOnly,2,600);
        var all=fullRewardMission();
        em.persist(AcquiredArCharacter.builder().user(em.find(User.class,host.getId())).arCharacter(all.getArCharacter()).mission(pointOnly.getMission()).build());
        em.persist(AcquiredCoupon.builder().user(em.find(User.class,host.getId())).coupon(all.getCoupon()).acquiredAt(JOINED_AT).build());
        var team=team(em.find(User.class,host.getId()),all,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false); roleProgress(team); clear();
        save(host,team.getId(),3).andExpect(status().isNoContent()); clear(); assertPaid(host,all,7,800);
        var empty=CooperativeMission.builder().mission(commonMission(MissionTypeCode.COOPERATIVE)).status(MissionActivationStatus.ACTIVE).build(); em.persist(empty);
        var emptyTeam=team(em.find(User.class,host.getId()),empty,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false); roleProgress(emptyTeam); clear();
        var before=rewardSnapshot(host).subList(0,4);
        save(host,emptyTeam.getId(),3).andExpect(status().isNoContent()); clear();
        assertThat(rewardSnapshot(host).subList(0,4)).isEqualTo(before);
        assertThat(em.find(CooperativeMissionProgress.class,emptyTeam.getId()).getMissionStatus()).isEqualTo(MissionProgressStatus.COMPLETED);
        var emptyRetry=team(em.find(User.class,host.getId()),em.find(CooperativeMission.class,empty.getMissionId()),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false);
        roleProgress(emptyRetry); clear();
        save(host,emptyRetry.getId(),3).andExpect(status().isNoContent()); clear();
        assertThat(rewardSnapshot(host).subList(0,4)).isEqualTo(before);
    }

    @Test void 오류와_인증실패는_데이터를_보존한다() throws Exception {
        var host=user(); var other=user(); var mission=mission();
        var progress=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false); clear();
        var before=snapshot(progress.getId()); var rewardBefore=rewardSnapshot(host);
        error(save(host,Long.MAX_VALUE,2),404,"COOPERATIVE_MISSION_PROGRESS_NOT_FOUND","진행 중인 협동 미션을 찾을 수 없습니다.");
        error(save(other,progress.getId(),2),403,"COOPERATIVE_MISSION_HOST_ONLY","협동 미션 방장만 참여 요청을 처리할 수 있습니다.");
        var member=participant(em.find(User.class,other.getId()),em.find(CooperativeMissionProgress.class,progress.getId()),ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER); em.persist(member); clear();
        error(save(other,progress.getId(),2),403,"COOPERATIVE_MISSION_HOST_ONLY","협동 미션 방장만 참여 요청을 처리할 수 있습니다.");
        for(int next:new int[]{0,1,3,4,-1,Integer.MAX_VALUE}) error(save(host,progress.getId(),next),409,"COOPERATIVE_MISSION_STEP_NOT_ALLOWED","현재 단계에서 허용되지 않는 요청입니다.");
        error(mvc.perform(patch(SAVE_URL,progress.getId()).contentType(MediaType.APPLICATION_JSON).content("{\"currentStep\":2}")),401,"UNAUTHORIZED","인증이 필요합니다.");
        error(save(activeUser(Long.MAX_VALUE),progress.getId(),2),401,"UNAUTHORIZED","인증이 필요합니다.");
        // 준비 과정에서 추가한 팀원 외에 기존 팀 상태와 보상은 유지된다.
        assertThat(snapshot(progress.getId()).getFirst()).isEqualTo(before.getFirst());
        assertThat(rewardSnapshot(host)).isEqualTo(rewardBefore);
        em.find(CooperativeMission.class,mission.getMissionId()).changeStatus(MissionActivationStatus.INACTIVE); clear();
        error(save(host,progress.getId(),2),404,"COOPERATIVE_MISSION_INACTIVE","비활성화된 협동 미션입니다.");
        var pendingTeam=team(host,mission(),ParticipantStatus.PENDING,ParticipantRole.HOST,1,false); clear();
        error(save(host,pendingTeam.getId(),2),403,"COOPERATIVE_MISSION_HOST_ONLY","협동 미션 방장만 참여 요청을 처리할 수 있습니다.");
    }

    @Test void 잘못된본문과_경로는400이며_Swagger는_필수단계와204를_공개한다() throws Exception {
        var host=user(); var progress=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false); clear();
        var before=snapshot(progress.getId());
        for(String json:List.of("", "{}", "null", "{\"currentStep\":null}", "{\"currentStep\":\"bad\"}", "{", "{\"currentStep\":{}}",
                "{\"currentStep\":2.5}", "{\"currentStep\":true}", "{\"currentStep\":[]}")) {
            error(request(host,progress.getId(),json),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");
        }
        error(request(host,"bad","{\"currentStep\":2}"),400,"INVALID_REQUEST","요청값이 올바르지 않습니다.");
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress'].patch.responses['204']").exists())
                .andExpect(jsonPath("$.components.schemas.SaveCooperativeMissionProgressRequest.required[0]").value("currentStep"));
    }

    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void 실제지급후실패는_모든참가자지급을롤백하고_재요청은성공한다() throws Exception {
        var data=transactions.execute(tx -> {
            var host=user(); var member=user(); var mission=mission();
            var progress=team(host,mission,ParticipantStatus.ACCEPTED,ParticipantRole.HOST,2,false);
            em.persist(participant(member,progress,ParticipantStatus.ACCEPTED,ParticipantRole.MEMBER)); roleProgress(progress); em.flush();
            return new RollbackData(host,member,progress.getId());
        });
        var teamBefore=snapshot(data.progressId()); var hostBefore=rewardSnapshot(data.host()); var memberBefore=rewardSnapshot(data.member());
        var calls=new AtomicInteger();
        doAnswer(invocation -> {
            var result=invocation.callRealMethod(); em.flush();
            if(calls.incrementAndGet()==2)throw new IllegalStateException("강제 지급 실패 비공개");
            return result;
        }).when(granter).grant(any(),any(),any(),any(),any(),anyInt());
        error(save(data.host(),data.progressId(),3),500,"INTERNAL_SERVER_ERROR","서버 내부 오류가 발생했습니다.");
        assertThat(calls.get()).isEqualTo(2);
        assertThat(snapshot(data.progressId())).isEqualTo(teamBefore);
        assertThat(rewardSnapshot(data.host())).isEqualTo(hostBefore); assertThat(rewardSnapshot(data.member())).isEqualTo(memberBefore);
        doCallRealMethod().when(granter).grant(any(),any(),any(),any(),any(),anyInt());
        save(data.host(),data.progressId(),3).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select point from user where id=?",Integer.class,data.host().getId())).isEqualTo(600);
        assertThat(jdbc.queryForObject("select point from user where id=?",Integer.class,data.member().getId())).isEqualTo(600);
    }

    /** 세 가지 보상을 갖는 장소 없는 미션을 트랜잭션 안에 준비한다. */
    private CooperativeMission fullRewardMission() {
        var character=ArCharacter.builder().name("감귤").description("설명").storyTitle("이야기").acquireCondition("완료")
                .imgUrl("character.png").representativeColor("#FFA500").hashtags(List.of()).build(); em.persist(character);
        var coupon=Coupon.builder().couponPrice(5000).build(); em.persist(coupon);
        var mission=CooperativeMission.builder().mission(commonMission(MissionTypeCode.COOPERATIVE)).status(MissionActivationStatus.ACTIVE)
                .arCharacter(character).point(200).coupon(coupon).build(); em.persist(mission); em.flush(); return mission;
    }
    private CooperativeRoleCard card() {
        var card=CooperativeRoleCard.builder().roleName("테스트").roleDescription("설명").locationToFind(List.of("돌담")).build(); em.persist(card); return card;
    }
    private CooperativeMissionParticipant participantOf(CooperativeMissionProgress team,User user) {
        return em.createQuery("select p from CooperativeMissionParticipant p where p.cooperativeMissionProgress.id=:team and p.user.id=:user",CooperativeMissionParticipant.class)
                .setParameter("team",team.getId()).setParameter("user",user.getId()).getSingleResult();
    }
    /** 지급 여부 조합을 실제 DB에 준비한다. */
    private void rewardStatus(User user,CooperativeMission mission,int mask) {
        var s=MissionRewardStatus.builder().user(user).mission(mission.getMission()).build();
        if((mask&1)!=0)s.grantArCharacterReward(); if((mask&2)!=0)s.grantPointReward(); if((mask&4)!=0)s.grantCouponReward(); em.persist(s);
    }
    /** 누적 포인트·지급 상태·획득 행을 확인한다. */
    private void assertPaid(User user,CooperativeMission mission,int mask,int point) {
        assertThat(jdbc.queryForObject("select point from user where id=?",Integer.class,user.getId())).isEqualTo(point);
        var s=em.find(MissionRewardStatus.class,new MissionRewardStatusId(mission.getMissionId(),user.getId()));
        assertThat(s.isArCharacterRewardGranted()).isEqualTo((mask&1)!=0);
        assertThat(s.isPointRewardGranted()).isEqualTo((mask&2)!=0); assertThat(s.isCouponRewardGranted()).isEqualTo((mask&4)!=0);
        if((mask&1)!=0)assertThat(jdbc.queryForObject("select count(*) from acquired_ar_character where user_id=? and mission_id=?",Long.class,user.getId(),mission.getMissionId())).isEqualTo(1);
        if((mask&4)!=0)assertThat(jdbc.queryForObject("select count(*) from acquired_coupon where user_id=? and coupon_id=?",Long.class,user.getId(),mission.getCoupon().getId())).isEqualTo(1);
    }
    private ResultActions save(User user,Object id,int next) throws Exception { return request(user,id,"{\"currentStep\":"+next+"}"); }
    private ResultActions request(User user,Object id,String json) throws Exception {
        return mvc.perform(patch(SAVE_URL,id).header("Authorization","Bearer "+tokens.createAccessToken(user).value()).contentType(MediaType.APPLICATION_JSON).content(json));
    }
    private ResultActions read(User user,Long id) throws Exception {
        return mvc.perform(get(SAVE_URL,id).header("Authorization","Bearer "+tokens.createAccessToken(user).value()).param("latitude","0").param("longitude","0"));
    }
    private void error(ResultActions result,int status,String code,String message) throws Exception {
        result.andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code)).andExpect(jsonPath("$.message").value(message));
        assertThat(body(result)).containsOnlyKeys("code","message");
    }
    private record RollbackData(User host,User member,Long progressId) { }
}
