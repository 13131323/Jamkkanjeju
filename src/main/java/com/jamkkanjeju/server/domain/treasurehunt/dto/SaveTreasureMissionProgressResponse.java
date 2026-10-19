package com.jamkkanjeju.server.domain.treasurehunt.dto;

import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import java.util.List;

/** 보물찾기 진행도 저장 응답. 갱신된 발견 정보와 이번 지급 보상, 완료 시 다음 장소를 담는다. */
public record SaveTreasureMissionProgressResponse(
        String missionProgressStatus,
        int treasureCount,
        List<Integer> foundTreasureIndexes,
        NextLocation nextLocation,
        Reward reward
) {

    /** 진행 중 응답을 만든다. 다음 장소는 null이고 이번 요청의 보상은 포함한다. */
    public static SaveTreasureMissionProgressResponse inProgress(TreasureMissionProgress progress, int treasureCount,
                                                                List<Integer> foundTreasureIndexes, Reward reward) {
        return of(progress, treasureCount, foundTreasureIndexes, null, reward);
    }

    /** 완료 응답을 만든다. 다음 장소와 마지막 보물 발견으로 지급한 보상을 담는다. */
    public static SaveTreasureMissionProgressResponse completed(TreasureMissionProgress progress, int treasureCount,
                                                               List<Integer> foundTreasureIndexes,
                                                               NextLocation nextLocation, Reward reward) {
        return of(progress, treasureCount, foundTreasureIndexes, nextLocation, reward);
    }

    /** 갱신된 진행도와 실제 보물 수, 정렬된 발견 번호 목록으로 응답을 만든다. */
    private static SaveTreasureMissionProgressResponse of(TreasureMissionProgress progress, int treasureCount,
                                                         List<Integer> foundTreasureIndexes,
                                                         NextLocation nextLocation, Reward reward) {
        return new SaveTreasureMissionProgressResponse(
                progress.getMissionStatus().name(), treasureCount, List.copyOf(foundTreasureIndexes), nextLocation, reward);
    }

    /** 완료 후 추천하는 다음 장소. 이미지나 연결된 활성 미션이 없으면 해당 값은 null이다. */
    public record NextLocation(
            Long id,
            String locationTitle,
            String locationImageUrl,
            int distanceMeter,
            NextMission mission
    ) {

        /** 추천 장소와 이미지, 거리, 연결된 미션으로 다음 장소를 만든다. */
        public static NextLocation of(Location location, String locationImageUrl, int distanceMeter,
                                      NextMission mission) {
            return new NextLocation(location.getId(), location.getTitle(), locationImageUrl, distanceMeter, mission);
        }
    }

    /** 다음 장소에서 수행할 활성 미션의 공통 ID와 유형이다. */
    public record NextMission(Long id, String missionType) {

        /** 공통 미션 엔티티로 다음 미션 정보를 만든다. */
        public static NextMission from(Mission mission) {
            return new NextMission(mission.getId(), mission.getMissionType().getType().name());
        }
    }

    /** 이번 보물 발견으로 지급한 보상이다. 지급하지 않은 항목은 null이다. */
    public record Reward(RewardArCharacter arCharacter, Integer point, RewardCoupon coupon) {

        /** 지급할 보상이 없어도 내부 항목이 null인 보상 객체를 만든다. */
        public static Reward of(ArCharacter arCharacter, Integer point, Coupon coupon) {
            return new Reward(
                    arCharacter != null ? RewardArCharacter.from(arCharacter) : null,
                    point,
                    coupon != null ? RewardCoupon.from(coupon) : null);
        }
    }

    /** 지급된 AR 캐릭터의 공개 정보이다. */
    public record RewardArCharacter(Long id, String name, String imageUrl) {

        /** AR 캐릭터 엔티티로 지급 보상 정보를 만든다. */
        public static RewardArCharacter from(ArCharacter arCharacter) {
            return new RewardArCharacter(arCharacter.getId(), arCharacter.getName(), arCharacter.getImgUrl());
        }
    }

    /** 지급된 쿠폰의 사용처와 금액이다. 연결된 장소가 없으면 사용처는 null이다. */
    public record RewardCoupon(String couponLocation, int couponPrice) {

        /** 쿠폰 엔티티로 지급 보상 정보를 만든다. */
        public static RewardCoupon from(Coupon coupon) {
            return new RewardCoupon(
                    coupon.getLocation() != null ? coupon.getLocation().getTitle() : null,
                    coupon.getCouponPrice());
        }
    }
}
