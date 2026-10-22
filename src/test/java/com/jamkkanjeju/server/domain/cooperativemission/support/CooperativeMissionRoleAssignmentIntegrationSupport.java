package com.jamkkanjeju.server.domain.cooperativemission.support;

import static com.jamkkanjeju.server.domain.cooperativemission.support.CooperativeMissionFixtures.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** 역할 배정 API·동시 요청 테스트의 요청과 참가·역할 준비를 공유한다. */
public abstract class CooperativeMissionRoleAssignmentIntegrationSupport extends CooperativeMissionIntegrationTestSupport {
    protected static final String ASSIGN_URL="/api/v2/cooperative-missions/{id}/role-assignments/{card}";

    /** JWT와 지정한 JSON으로 역할 배정 요청을 보낸다. */
    protected ResultActions assignJson(User host,Object team,Object card,String json) throws Exception {
        return mvc.perform(put(ASSIGN_URL,team,card).header("Authorization","Bearer "+tokens.createAccessToken(host).value())
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }
    /** 참가자 ID를 본문으로 전달한다. */
    protected ResultActions assign(User host,Long team,Long card,Long participant) throws Exception {
        return assignJson(host,team,card,"{\"participantId\":"+participant+"}");
    }
    /** 팀과 사용자에 연결된 실제 참가자 한 건을 읽는다. */
    protected CooperativeMissionParticipant participantOf(CooperativeMissionProgress team,User user) {
        return em.createQuery("select p from CooperativeMissionParticipant p where p.cooperativeMissionProgress.id=:team and p.user.id=:user",CooperativeMissionParticipant.class)
                .setParameter("team",team.getId()).setParameter("user",user.getId()).getSingleResult();
    }
    /** 같은 팀의 수락·대기 팀원을 저장한다. */
    protected CooperativeMissionParticipant member(User user,CooperativeMissionProgress team,ParticipantStatus status) {
        var p=participant(user,team,status,ParticipantRole.MEMBER); em.persist(p); em.flush(); return p;
    }
    /** 지정한 인증 상태의 배정 행을 저장한다. */
    protected CooperativeMissionRoleProgress assignedRole(CooperativeMissionParticipant participant,CooperativeRoleCard card,boolean completed) {
        var role=CooperativeMissionRoleProgress.builder().participant(participant).roleCard(card)
                .progressStatus(completed ? MissionProgressStatus.COMPLETED : MissionProgressStatus.IN_PROGRESS)
                .itemImgUrl(completed ? "https://example.com/proof.jpg" : null).completedAt(completed ? JOINED_AT : null).build();
        em.persist(role); em.flush(); return role;
    }
    /** 팀과 카드 조합의 행을 JDBC로 읽어 영속성 컨텍스트와 무관하게 비교한다. */
    protected List<Map<String,Object>> assignmentRows(Long team,Long card) {
        return jdbc.queryForList("select r.* from cooperative_mission_role_progress r join cooperative_mission_participant p on p.id=r.cooperative_mission_participant_id where p.cooperative_mission_progress_id=? and r.cooperative_role_card_id=?",team,card);
    }
}
