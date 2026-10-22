package com.jamkkanjeju.server.domain.cooperativemission.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import org.springframework.test.web.servlet.ResultActions;

/** 중단 테스트의 실제 JWT 요청과 첫 단계 팀 준비를 공유한다. */
public abstract class CooperativeMissionStopIntegrationSupport extends CooperativeMissionRoleAssignmentIntegrationSupport {
    protected static final String STOP_URL="/api/v2/cooperative-missions/{id}/progress/stop";
    protected ResultActions stop(User user,Object team) throws Exception {
        return mvc.perform(patch(STOP_URL,team).header("Authorization","Bearer "+tokens.createAccessToken(user).value()));
    }
    protected ResultActions poll(User user,Long team) throws Exception {
        return mvc.perform(get("/api/v2/cooperative-missions/{id}/progress",team)
                .param("latitude","33.4").param("longitude","126.5")
                .header("Authorization","Bearer "+tokens.createAccessToken(user).value()));
    }
    /** 방장·수락 팀원·양쪽 역할 한 개를 준비한다. */
    protected Data data() {
        var host=user(); var team=team(host,mission(),ParticipantStatus.ACCEPTED,ParticipantRole.HOST,1,false);
        var hostP=participantOf(team,host); var member=member(user(),team,ParticipantStatus.ACCEPTED);
        var hostCard=trackedRoleCard(); var memberCard=trackedRoleCard();
        assignedRole(hostP,hostCard,false); assignedRole(member,memberCard,false); em.flush();
        return new Data(host,team,hostP,member,hostCard,memberCard);
    }
    protected record Data(User host,CooperativeMissionProgress team,CooperativeMissionParticipant hostP,
                          CooperativeMissionParticipant member,CooperativeRoleCard hostCard,CooperativeRoleCard memberCard) { }
}
