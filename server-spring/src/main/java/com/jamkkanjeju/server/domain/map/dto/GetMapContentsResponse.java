package com.jamkkanjeju.server.domain.map.dto;

import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCoupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import java.util.List;
import java.time.LocalDateTime;

/** 지도 홈의 상세 응답. 장소별 미션·방명록·수령 쿠폰과 길바닥 방명록을 담는다. */
public record GetMapContentsResponse(
        List<LocationInfo> locations,
        List<RoadGuestbookInfo> roadGuestbooks
) {

    /** 서비스가 조합한 두 목록으로 상세 응답을 만든다. */
    public static GetMapContentsResponse of(List<LocationInfo> locations, List<RoadGuestbookInfo> roadGuestbooks) {
        return new GetMapContentsResponse(List.copyOf(locations), List.copyOf(roadGuestbooks));
    }

    /** 장소 한 건과 해당 장소의 상세 지도 콘텐츠이다. */
    public record LocationInfo(
            Long id,
            String locationTitle,
            double latitude,
            double longitude,
            Integer distanceMeter,
            Integer durationMinutes,
            MissionInfo mission,
            long guestbooksCount,
            String representativeImageUrl,
            List<ReceivedCoupon> receivedCoupons
    ) {

        /** 장소 기본 정보에 서비스의 계산·집계·조회 결과를 붙인다. 수령 쿠폰이 없으면 null로 유지한다. */
        public static LocationInfo of(Location location, TravelEstimate travel, MissionInfo mission,
                                      long guestbooksCount, String representativeImageUrl,
                                      List<ReceivedCoupon> receivedCoupons) {
            return new LocationInfo(location.getId(), location.getTitle(), location.getLatitude(), location.getLongitude(),
                    travel.distanceMeter(), travel.durationMinutes(), mission, guestbooksCount, representativeImageUrl,
                    receivedCoupons == null || receivedCoupons.isEmpty() ? null : List.copyOf(receivedCoupons));
        }
    }

    /** 장소에 연결된 단일 미션과 현재 사용자의 완료·방명록 작성 여부이다. */
    public record MissionInfo(
            Long id,
            String missionType,
            String missionTitle,
            boolean isCompleted,
            Boolean hasWrittenGuestbook
    ) {

        /** 공통 미션 ID·유형·제목과 서비스가 판정한 사용자별 결과를 공개 응답으로 변환한다. */
        public static MissionInfo of(Mission mission, boolean isCompleted, Boolean hasWrittenGuestbook) {
            return new MissionInfo(mission.getId(), mission.getMissionType().getType().name(),
                    mission.getMissionType().getTitle(), isCompleted, isCompleted ? hasWrittenGuestbook : null);
        }
    }

    /** 현재 사용자가 획득한 쿠폰의 ID·금액·사용처 주소와 사용 시각이다. */
    public record ReceivedCoupon(Long couponId, int couponPrice, String locationAddress, LocalDateTime usedAt) {

        /** 장소가 연결된 수령 쿠폰을 응답 정보로 변환한다. */
        public static ReceivedCoupon from(AcquiredCoupon acquiredCoupon) {
            Coupon coupon = acquiredCoupon.getCoupon();
            return new ReceivedCoupon(coupon.getId(), coupon.getCouponPrice(), coupon.getLocation().getAddress(),
                    acquiredCoupon.getUsedAt());
        }
    }

    /** 길바닥 방명록의 식별자·좌표·위치 별칭·첨부 대표 이미지이다. */
    public record RoadGuestbookInfo(
            Long id,
            double latitude,
            double longitude,
            String locationAlias,
            String representativeGuestbookImageUrl
    ) {

        /** 공통 방명록과 PK를 공유하는 길바닥 방명록을 상세 항목으로 변환한다. */
        public static RoadGuestbookInfo from(RoadGuestbook guestbook) {
            return new RoadGuestbookInfo(guestbook.getGuestbookId(), guestbook.getLatitude(), guestbook.getLongitude(),
                    guestbook.getLocationAlias(), guestbook.getGuestbook().getContentImgUrl());
        }
    }
}
