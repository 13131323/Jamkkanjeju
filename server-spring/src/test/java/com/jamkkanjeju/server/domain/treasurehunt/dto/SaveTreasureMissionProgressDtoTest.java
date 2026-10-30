package com.jamkkanjeju.server.domain.treasurehunt.dto;

import static org.assertj.core.api.Assertions.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.TreasureMissionFixtures.*;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.*;

import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import jakarta.validation.Validation;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 저장 요청 검증과 응답의 공개 필드·nullable 보상 변환을 검증한다. */
class SaveTreasureMissionProgressDtoTest {
    @Test
    void 보물번호는_필수이고_별도_범위제한을_추가하지_않는다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(new SaveTreasureMissionProgressRequest(null))).hasSize(1);
            for (int index : List.of(-1, 0, 1, 5)) {
                assertThat(factory.getValidator().validate(new SaveTreasureMissionProgressRequest(index))).isEmpty();
            }
        }
    }

    @Test
    void 요청좌표는_필수이고_경계값만_허용한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(new SaveTreasureMissionProgressLocationRequest(null, null))).hasSize(2);
            for (double[] value : List.of(new double[]{-90, -180}, new double[]{90, 180})) {
                assertThat(validator.validate(new SaveTreasureMissionProgressLocationRequest(value[0], value[1]))).isEmpty();
            }
            for (double[] value : List.of(new double[]{-90.01, 0}, new double[]{90.01, 0},
                    new double[]{0, -180.01}, new double[]{0, 180.01})) {
                assertThat(validator.validate(new SaveTreasureMissionProgressLocationRequest(value[0], value[1]))).hasSize(1);
            }
        }
    }

    @Test
    void 진행중에도_빈보상객체를_유지하고_발견목록을_복사한다() {
        var indexes = new ArrayList<>(List.of(2, 4));
        var response = SaveTreasureMissionProgressResponse.inProgress(progress(null, null), 5, indexes,
                SaveTreasureMissionProgressResponse.Reward.of(null, null, null));
        indexes.clear();
        assertThat(response.foundTreasureIndexes()).containsExactly(2, 4);
        assertThat(response.treasureCount()).isEqualTo(5);
        assertThat(response.missionProgressStatus()).isEqualTo("IN_PROGRESS");
        var json = JsonMapper.builder().build().valueToTree(response);
        assertThat(json.get("nextLocation").isNull()).isTrue();
        assertThat(json.get("reward").isObject()).isTrue();
        assertThat(json.at("/reward/arCharacter").isNull()).isTrue();
        assertThat(json.at("/reward/point").isNull()).isTrue();
        assertThat(json.at("/reward/coupon").isNull()).isTrue();
    }

    @Test
    void 완료장소_미션_캐릭터_쿠폰의_공개정보를_변환한다() {
        var progress = progress(null, null);
        progress.complete(COMPLETED_AT);
        var nextMission = SaveTreasureMissionProgressResponse.NextMission.from(mission(31L, MissionTypeCode.TREASURE));
        var nextLocation = SaveTreasureMissionProgressResponse.NextLocation.of(location(8L, "다음", 33, 126), null, 42, nextMission);
        var character = ArCharacter.builder().requiredFragmentCount(10).id(9L).name("캐릭터").imgUrl("character.png").build();
        var coupon = Coupon.builder().couponPrice(3000).build();
        var reward = SaveTreasureMissionProgressResponse.Reward.of(character, 0, coupon);
        var response = SaveTreasureMissionProgressResponse.completed(progress, 1, List.of(1), nextLocation, reward);
        assertThat(response.missionProgressStatus()).isEqualTo("COMPLETED");
        assertThat(response.nextLocation().mission().missionType()).isEqualTo("TREASURE");
        assertThat(response.nextLocation().locationImageUrl()).isNull();
        assertThat(reward.arCharacter()).isEqualTo(new SaveTreasureMissionProgressResponse.RewardArCharacter(9L, "캐릭터", "character.png"));
        assertThat(reward.point()).isZero();
        assertThat(reward.coupon().couponLocation()).isNull();
        assertThat(reward.coupon().couponPrice()).isEqualTo(3000);
        assertThat(SaveTreasureMissionProgressResponse.RewardCoupon.from(Coupon.builder()
                .location(location(8L, "쿠폰 사용처", 33, 126)).couponPrice(100).build()).couponLocation()).isEqualTo("쿠폰 사용처");
    }
}
