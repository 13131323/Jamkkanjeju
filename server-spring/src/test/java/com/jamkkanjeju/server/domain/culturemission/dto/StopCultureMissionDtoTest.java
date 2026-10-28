package com.jamkkanjeju.server.domain.culturemission.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.*;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

/** 중단 요청 좌표와 명세에 맞는 응답 구성을 검증한다. */
class StopCultureMissionDtoTest {
    @Test void coordinatesRequireBothValuesAndAcceptOnlyValidRanges() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (var request : new StopCultureMissionLocationRequest[] {
                    new StopCultureMissionLocationRequest(-90.0, -180.0),
                    new StopCultureMissionLocationRequest(90.0, 180.0),
                    new StopCultureMissionLocationRequest(0.0, 0.0)}) {
                assertThat(validator.validate(request)).isEmpty();
            }
            for (var request : new StopCultureMissionLocationRequest[] {
                    new StopCultureMissionLocationRequest(null, 0.0), new StopCultureMissionLocationRequest(0.0, null),
                    new StopCultureMissionLocationRequest(-90.1, 0.0), new StopCultureMissionLocationRequest(90.1, 0.0),
                    new StopCultureMissionLocationRequest(0.0, -180.1), new StopCultureMissionLocationRequest(0.0, 180.1)}) {
                assertThat(validator.validate(request)).isNotEmpty();
            }
        }
    }

    @Test void responseUsesStoredCountAndKeepsNullableFieldsAndEmptyRewardObject() {
        var progress = progress(7L, activeUser(15L), cultureMission(31L, MissionActivationStatus.ACTIVE),
                MissionProgressStatus.COMPLETED, 2, 1, LAST_COMPLETED_AT);
        var next = new StopCultureMissionResponse.NextLocation(8L, "다음 장소", null, 12, null);
        var reward = StopCultureMissionResponse.Reward.of(null, null, null);
        var response = StopCultureMissionResponse.of(progress, 3, next, reward);
        assertThat(response.missionProgressStatus()).isEqualTo("COMPLETED");
        assertThat(response.quizCount()).isEqualTo(3);
        assertThat(response.correctNumber()).isEqualTo(1);
        assertThat(response.nextLocation()).isEqualTo(next);
        assertThat(response.nextLocation().locationImageUrl()).isNull();
        assertThat(response.nextLocation().mission()).isNull();
        assertThat(response.reward()).isEqualTo(new StopCultureMissionResponse.Reward(null, null, null));
        var coupon = Coupon.builder().couponPrice(3000).build();
        assertThat(StopCultureMissionResponse.RewardCoupon.from(coupon).couponLocation()).isNull();
        assertThat(StopCultureMissionResponse.RewardCoupon.from(coupon).couponPrice()).isEqualTo(3000);
    }
}
