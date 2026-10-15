package com.jamkkanjeju.server.domain.mission.dto;

import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionStep;
import com.jamkkanjeju.server.domain.mission.entity.MissionType;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import java.util.List;

/** 미션 홈 조회 응답. 미션 공통 정보와 사용자에게 남은 보상, 진행 단계 안내를 담는다. */
public record GetMissionHomeResponse(
        Long id,
        String missionType,
        String missionTitle,
        String description,
        RemainingReward remainingReward,
        List<Step> steps
) {

    /** 공통 미션과 단계 번호 오름차순으로 정렬된 안내 목록, 남은 보상으로 응답을 만든다. */
    public static GetMissionHomeResponse of(Mission mission, List<MissionStep> sortedSteps,
                                            RemainingReward remainingReward) {
        MissionType type = mission.getMissionType();
        return new GetMissionHomeResponse(
                mission.getId(),
                type.getType().name(),
                type.getTitle(),
                type.getDescription(),
                remainingReward,
                sortedSteps.stream().map(Step::from).toList()
        );
    }

    /** 남은 보상 정보. 남은 항목이 없어도 객체는 유지한다. */
    public record RemainingReward(
            RewardArCharacter arCharacter,
            Integer point,
            RewardCoupon coupon
    ) {

        /** 미지급 보상만 전달받아 공개 응답으로 변환한다. */
        public static RemainingReward of(ArCharacter arCharacter, Integer point, Coupon coupon) {
            return new RemainingReward(
                    arCharacter != null ? RewardArCharacter.from(arCharacter) : null,
                    point,
                    coupon != null ? RewardCoupon.from(coupon) : null
            );
        }
    }

    /** 남은 AR 캐릭터 보상의 공개 정보이다. */
    public record RewardArCharacter(
            Long id,
            String name,
            String imageUrl
    ) {

        /** 캐릭터의 ID·이름·이미지 URL을 구성한다. */
        public static RewardArCharacter from(ArCharacter arCharacter) {
            return new RewardArCharacter(arCharacter.getId(), arCharacter.getName(), arCharacter.getImgUrl());
        }
    }

    /** 남은 쿠폰 보상의 사용처와 금액이다. */
    public record RewardCoupon(
            String couponLocation,
            int couponPrice
    ) {

        /** 연결된 장소가 없어도 쿠폰은 유지하고 사용처만 null로 구성한다. */
        public static RewardCoupon from(Coupon coupon) {
            return new RewardCoupon(
                    coupon.getLocation() != null ? coupon.getLocation().getTitle() : null,
                    coupon.getCouponPrice()
            );
        }
    }

    /** 미션 진행 방법을 안내하는 단계이다. */
    public record Step(
            int step,
            String stepTitle,
            String description
    ) {

        /** 저장된 안내 단계를 API의 필드 이름에 맞춰 변환한다. */
        public static Step from(MissionStep step) {
            return new Step(
                    step.step(),
                    step.stepTitle(),
                    step.description()
            );
        }
    }
}
