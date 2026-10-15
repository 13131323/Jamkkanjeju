package com.jamkkanjeju.server.domain.culturemission.dto;

import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;

/** 문화 미션 진행도 저장 응답. 제출한 문제의 채점 결과와 갱신된 진행 정보, 완료 시 다음 장소와 지급 보상을 담는다. */
public record SaveCultureMissionProgressResponse(
        boolean isCorrect,
        String answer,
        String explanation,
        String missionProgressStatus,
        int quizCount,
        int currentQuizNumber,
        int correctNumber,
        NextLocation nextLocation,
        Reward reward
) {

    /** 진행 중 응답을 만든다. 다음 장소와 보상은 null이다. */
    public static SaveCultureMissionProgressResponse inProgress(boolean isCorrect, CultureMissionQuiz quiz,
                                                                CultureMissionProgress progress, int quizCount) {
        return of(isCorrect, quiz, progress, quizCount, null, null);
    }

    /** 완료 응답을 만든다. 다음 장소와 이번 요청으로 지급한 보상을 담는다. */
    public static SaveCultureMissionProgressResponse completed(boolean isCorrect, CultureMissionQuiz quiz,
                                                               CultureMissionProgress progress, int quizCount,
                                                               NextLocation nextLocation, Reward reward) {
        return of(isCorrect, quiz, progress, quizCount, nextLocation, reward);
    }

    /** 채점한 문제와 갱신된 진행도로 응답을 만든다. */
    private static SaveCultureMissionProgressResponse of(boolean isCorrect, CultureMissionQuiz quiz,
                                                         CultureMissionProgress progress, int quizCount,
                                                         NextLocation nextLocation, Reward reward) {
        return new SaveCultureMissionProgressResponse(
                isCorrect,
                quiz.getAnswer(),
                quiz.getExplanation(),
                progress.getMissionStatus().name(),
                quizCount,
                progress.getCurrentQuizIndex(),
                progress.getCorrectCount(),
                nextLocation,
                reward
        );
    }

    /** 완료 후 추천하는 다음 장소. 이미지를 제공하지 못하면 이미지 URL만 null이다. */
    public record NextLocation(
            Long id,
            String locationTitle,
            String locationImageUrl,
            int distanceMeter,
            NextMission mission
    ) {

        /** 추천 장소와 이미지, 요청 위치로부터의 거리, 장소에서 수행할 미션으로 다음 장소를 만든다. */
        public static NextLocation of(Location location, String locationImageUrl, int distanceMeter,
                                      NextMission mission) {
            return new NextLocation(location.getId(), location.getTitle(), locationImageUrl, distanceMeter, mission);
        }
    }

    /** 다음 장소에서 수행할 미션. */
    public record NextMission(
            Long id,
            String missionType
    ) {

        /** 공통 미션으로 다음 미션을 만든다. 미션 유형은 연결된 미션 유형의 코드이다. */
        public static NextMission from(Mission mission) {
            return new NextMission(mission.getId(), mission.getMissionType().getType().name());
        }
    }

    /** 이번 요청으로 실제 지급된 보상. 지급되지 않은 항목은 null이다. */
    public record Reward(
            RewardArCharacter arCharacter,
            Integer point,
            RewardCoupon coupon
    ) {

        /** 지급한 AR 캐릭터, 포인트, 쿠폰으로 보상을 만든다. 지급하지 않은 항목은 null로 전달한다. */
        public static Reward of(ArCharacter arCharacter, Integer point,
                                Coupon coupon) {
            return new Reward(
                    arCharacter != null ? RewardArCharacter.from(arCharacter) : null,
                    point,
                    coupon != null ? RewardCoupon.from(coupon) : null
            );
        }
    }

    /** 지급된 AR 캐릭터. */
    public record RewardArCharacter(
            Long id,
            String name,
            String imageUrl
    ) {

        /** AR 캐릭터 엔티티로 보상 항목을 만든다. */
        public static RewardArCharacter from(ArCharacter arCharacter) {
            return new RewardArCharacter(arCharacter.getId(), arCharacter.getName(), arCharacter.getImgUrl());
        }
    }

    /** 지급된 쿠폰. 연결된 장소가 없으면 사용처는 null이다. */
    public record RewardCoupon(
            String couponLocation,
            int couponPrice
    ) {

        /** 쿠폰 엔티티로 보상 항목을 만든다. 사용처는 쿠폰에 연결된 장소명이다. */
        public static RewardCoupon from(Coupon coupon) {
            return new RewardCoupon(
                    coupon.getLocation() != null ? coupon.getLocation().getTitle() : null,
                    coupon.getCouponPrice()
            );
        }
    }
}
