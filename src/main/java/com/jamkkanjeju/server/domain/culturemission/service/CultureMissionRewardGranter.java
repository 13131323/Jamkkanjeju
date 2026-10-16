package com.jamkkanjeju.server.domain.culturemission.service;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 문화 미션 완료 보상을 정답 수만큼 지급하고, 같은 미션의 같은 보상을 다시 지급하지 않도록 지급 여부를 기록한다. */
@Component
@RequiredArgsConstructor
public class CultureMissionRewardGranter {

    private final MissionRewardGranter missionRewardGranter;

    /**
     * 아직 받지 않은 보상을 AR 캐릭터, 포인트, 쿠폰 순서로 정답 수만큼 지급하고 이번에 지급한 보상을 돌려준다.
     * 지급할 보상이 없으면 모든 항목이 null이다.
     */
    public GrantedReward grant(User user, CultureMission cultureMission, int correctCount) {
        MissionRewardGranter.GrantedReward reward = missionRewardGranter.grant(
                user, cultureMission.getMission(), cultureMission.getArCharacter(),
                cultureMission.getPoint(), cultureMission.getCoupon(), correctCount);
        return new GrantedReward(reward.arCharacter(), reward.point(), reward.coupon());
    }

    /** 이번 요청으로 지급한 보상. 지급하지 않은 항목은 null이다. */
    public record GrantedReward(ArCharacter arCharacter, Integer point, Coupon coupon) {
        public static final GrantedReward NONE = new GrantedReward(null, null, null);
    }
}
