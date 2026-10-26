package com.jamkkanjeju.server.domain.map.dto;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import java.time.LocalDate;
import java.util.List;

/** 장소 모달의 기본 정보·방문 여부·미션 보상과 최신 방명록을 담는다. */
public record GetLocationMapModalResponse(
        Long id,
        String locationTitle,
        String locationCategory,
        String representativeImageUrl,
        Integer distanceMeter,
        Integer durationMinutes,
        boolean isVisited,
        MissionInfo mission,
        long guestbooksCount,
        List<GuestbookInfo> guestbooks
) {

    /** 장소 정보에 서비스가 계산·조회한 결과를 붙이고 방명록 목록을 복사한다. */
    public static GetLocationMapModalResponse of(Location location, String representativeImageUrl,
                                                 TravelEstimate travel, boolean isVisited, MissionInfo mission,
                                                 long guestbooksCount, List<GuestbookInfo> guestbooks) {
        return new GetLocationMapModalResponse(location.getId(), location.getTitle(), location.getCategory(),
                representativeImageUrl, travel.distanceMeter(), travel.durationMinutes(), isVisited,
                mission, guestbooksCount, List.copyOf(guestbooks));
    }

    /** 장소에 연결된 활성 미션과 현재 사용자의 완료 여부·전체 보상이다. */
    public record MissionInfo(Long missionId, String missionType, String missionTitle,
                              boolean isCompleted, RewardDetail rewardDetail) {

        /** 공통 미션 정보와 서비스의 완료 판정·보상 조합 결과를 응답으로 변환한다. */
        public static MissionInfo of(Mission mission, boolean isCompleted, RewardDetail rewardDetail) {
            return new MissionInfo(mission.getId(), mission.getMissionType().getType().name(),
                    mission.getMissionType().getTitle(), isCompleted, rewardDetail);
        }
    }

    /** 이미 받은 항목도 유지하는 전체 보상 정보이다. 설정된 보상이 없어도 객체는 유지한다. */
    public record RewardDetail(RewardArCharacter arCharacter, RewardPoint point, RewardCoupon coupon) {

        /** 보상 설정에 사용자별 지급 상태를 붙인다. 상태 기록이 없으면 모든 항목을 미수령으로 표시한다. */
        public static RewardDetail of(ArCharacter arCharacter, Integer point, Coupon coupon,
                                      MissionRewardStatus status) {
            return new RewardDetail(
                    arCharacter == null ? null : RewardArCharacter.of(arCharacter,
                            status != null && status.isArCharacterRewardGranted()),
                    point == null ? null : RewardPoint.of(point,
                            status != null && status.isPointRewardGranted()),
                    coupon == null ? null : RewardCoupon.of(coupon,
                            status != null && status.isCouponRewardGranted()));
        }
    }

    /** AR 캐릭터 보상과 해당 미션에서의 수령 여부이다. */
    public record RewardArCharacter(Long id, String name, String imageUrl, boolean isReceived) {

        /** 캐릭터의 공개 정보와 수령 여부를 구성한다. */
        public static RewardArCharacter of(ArCharacter arCharacter, boolean isReceived) {
            return new RewardArCharacter(arCharacter.getId(), arCharacter.getName(), arCharacter.getImgUrl(), isReceived);
        }
    }

    /** 포인트 보상량과 해당 미션에서의 수령 여부이다. */
    public record RewardPoint(int amount, boolean isReceived) {

        /** 설정된 포인트와 수령 여부를 구성한다. */
        public static RewardPoint of(int amount, boolean isReceived) {
            return new RewardPoint(amount, isReceived);
        }
    }

    /** 쿠폰 사용처·금액과 해당 미션에서의 수령 여부이다. */
    public record RewardCoupon(String couponLocation, int couponPrice, boolean isReceived) {

        /** 쿠폰 사용처가 없으면 이름만 null로 유지한다. */
        public static RewardCoupon of(Coupon coupon, boolean isReceived) {
            return new RewardCoupon(coupon.getLocation() == null ? null : coupon.getLocation().getTitle(),
                    coupon.getCouponPrice(), isReceived);
        }
    }

    /** 장소 방명록의 단일 첨부 이미지·작성자·온보딩 프로필·참조 미션·방문일·글이다. */
    public record GuestbookInfo(Long id, String representativeImageUrl, Long userId, String userNickname,
                                String characterImgUrl, String missionTitle, LocalDate visitedAt,
                                String contentWriting) {

        /** 작성자·온보딩 결과·미션 연결이 없어도 방명록을 유지하고 해당 값만 null로 구성한다. */
        public static GuestbookInfo from(LocationGuestbook locationGuestbook) {
            Guestbook guestbook = locationGuestbook.getGuestbook();
            User user = guestbook.getUser();
            Mission mission = locationGuestbook.getMission();
            return new GuestbookInfo(guestbook.getId(), guestbook.getContentImgUrl(),
                    user == null ? null : user.getId(), user == null ? null : user.getNickname(),
                    user == null || user.getOnboardingResult() == null
                            ? null : user.getOnboardingResult().getProfileImgUrl(),
                    mission == null ? null : mission.getMissionType().getTitle(),
                    guestbook.getVisitedAt(), guestbook.getContentWriting());
        }
    }
}
