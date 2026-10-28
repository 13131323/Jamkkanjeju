package com.jamkkanjeju.server.domain.mission.dto;

import static com.jamkkanjeju.server.domain.mission.support.MissionFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.mission.dto.GetMissionHomeResponse.RemainingReward;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import org.junit.jupiter.api.Test;

/** 미션 홈 응답의 공개 정보 변환과 nullable 보상 구성을 검증한다. */
class GetMissionHomeResponseTest {

    @Test
    void 공통_미션과_보상을_응답으로_변환한다() {
        var mission = mission(MissionTypeCode.CULTURE);
        var response = GetMissionHomeResponse.of(mission, mission.getMissionType().getSteps(),
                RemainingReward.of(character(), 100, coupon(true)));

        assertThat(response.id()).isEqualTo(31L);
        assertThat(response.missionType()).isEqualTo("CULTURE");
        assertThat(response.missionTitle()).isEqualTo("미션 제목");
        assertThat(response.description()).isEqualTo("미션 설명");
        assertThat(response.steps()).extracting(GetMissionHomeResponse.Step::step).containsExactly(2, 1);
        assertThat(response.steps().get(0).stepTitle()).isEqualTo("두 번째");
        assertThat(response.steps().get(0).description()).isEqualTo("설명2");
        assertThat(response.remainingReward().arCharacter())
                .isEqualTo(new GetMissionHomeResponse.RewardArCharacter(9L, "돌담이", "https://example.com/character.png"));
        assertThat(response.remainingReward().point()).isEqualTo(100);
        assertThat(response.remainingReward().coupon())
                .isEqualTo(new GetMissionHomeResponse.RewardCoupon("쿠폰 사용처", 3000));
    }

    @Test
    void 빈_보상과_장소_없는_쿠폰과_0포인트를_유지한다() {
        var empty = RemainingReward.of(null, null, null);
        assertThat(empty).isNotNull();
        assertThat(empty.arCharacter()).isNull();
        assertThat(empty.point()).isNull();
        assertThat(empty.coupon()).isNull();
        var reward = RemainingReward.of(null, 0, coupon(false));
        assertThat(reward.point()).isZero();
        assertThat(reward.coupon()).isEqualTo(new GetMissionHomeResponse.RewardCoupon(null, 3000));
    }
}
