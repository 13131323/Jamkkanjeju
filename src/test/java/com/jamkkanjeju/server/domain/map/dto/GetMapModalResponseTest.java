package com.jamkkanjeju.server.domain.map.dto;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.*;
import static com.jamkkanjeju.server.domain.mission.support.MissionFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.GuestbookInfo;
import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.RewardDetail;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** 지도 모달의 보상 수령 표시와 nullable 작성자·저장 콘텐츠 변환을 검증한다. */
class GetMapModalResponseTest {
    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3, 4, 5, 6, 7})
    void 지급_여부와_무관하게_설정된_보상_상세를_유지한다(int flags) {
        MissionRewardStatus status = MissionRewardStatus.builder().mission(mission(MissionTypeCode.TREASURE))
                .user(user(15L, "dto@example.com")).build();
        if ((flags & 1) != 0) status.grantArCharacterReward();
        if ((flags & 2) != 0) status.grantPointReward();
        if ((flags & 4) != 0) status.grantCouponReward();
        RewardDetail detail = RewardDetail.of(character(), 100, coupon(true), status);
        assertThat(detail.arCharacter().id()).isEqualTo(9L);
        assertThat(detail.arCharacter().name()).isEqualTo("돌담이");
        assertThat(detail.arCharacter().imageUrl()).isEqualTo("https://example.com/character.png");
        assertThat(detail.arCharacter().isReceived()).isEqualTo((flags & 1) != 0);
        assertThat(detail.point().amount()).isEqualTo(100);
        assertThat(detail.point().isReceived()).isEqualTo((flags & 2) != 0);
        assertThat(detail.coupon().couponLocation()).isEqualTo("쿠폰 사용처");
        assertThat(detail.coupon().couponPrice()).isEqualTo(3000);
        assertThat(detail.coupon().isReceived()).isEqualTo((flags & 4) != 0);
    }

    @Test
    void 상태_없음과_보상_없음_0포인트_nullable_사용처를_구분한다() {
        RewardDetail detail = RewardDetail.of(character(), 0, coupon(false), null);
        assertThat(detail.arCharacter().isReceived()).isFalse();
        assertThat(detail.point().amount()).isZero();
        assertThat(detail.point().isReceived()).isFalse();
        assertThat(detail.coupon().couponLocation()).isNull();
        assertThat(detail.coupon().isReceived()).isFalse();
        assertThat(RewardDetail.of(null, null, null, null)).isEqualTo(new RewardDetail(null, null, null));
    }

    @Test
    void 장소_방명록의_이미지는_작성자_온보딩에서_가져오고_없는_연결만_비운다() {
        User author = user(15L, "author@example.com");
        author.assignOnboardingResult(onboarding());
        LocationGuestbook book = LocationGuestbook.builder()
                .guestbook(guestbook(300L, author, GuestbookStatus.ACTIVE, DATE))
                .mission(mission(MissionTypeCode.TREASURE)).build();
        GuestbookInfo response = GuestbookInfo.from(book);
        assertThat(response).isEqualTo(new GuestbookInfo(300L, "https://example.com/photo.jpg", 15L,
                "지도 작성자", "https://example.com/profile.png", "미션 제목", DATE, "제주 산책 기록"));
        User withoutProfile = user(16L, "no-profile@example.com");
        assertThat(GuestbookInfo.from(LocationGuestbook.builder()
                .guestbook(guestbook(301L, withoutProfile, GuestbookStatus.ACTIVE, DATE)).build()))
                .isEqualTo(new GuestbookInfo(301L, "https://example.com/photo.jpg", 16L,
                        "지도 작성자", null, null, DATE, "제주 산책 기록"));
        GuestbookInfo deleted = GuestbookInfo.from(LocationGuestbook.builder()
                .guestbook(guestbook(302L, null, GuestbookStatus.ACTIVE, DATE)).build());
        assertThat(deleted.userId()).isNull();
        assertThat(deleted.userNickname()).isNull();
        assertThat(deleted.characterImgUrl()).isNull();
        User unnamed = User.builder().build();
        assertThat(GuestbookInfo.from(LocationGuestbook.builder()
                .guestbook(guestbook(303L, unnamed, GuestbookStatus.ACTIVE, DATE)).build()).userNickname()).isNull();
    }

    @Test
    void 길바닥_방명록은_단일_URL과_저장된_콘텐츠를_그대로_반환한다() {
        RoadGuestbook road = RoadGuestbook.builder()
                .guestbook(guestbook(100L, null, GuestbookStatus.ACTIVE, DATE))
                .locationAlias("성산 바다 앞").latitude(33).longitude(126).build();
        org.springframework.test.util.ReflectionTestUtils.setField(road, "guestbookId", 100L);
        assertThat(GetRoadGuestbookMapModalResponse.of(road, new TravelEstimate(850, 11)))
                .isEqualTo(new GetRoadGuestbookMapModalResponse(100L, null, "성산 바다 앞", 850, 11, DATE,
                        "https://example.com/photo.jpg", "제주 산책 기록", "https://example.com/audio.mp3", "맑음", "#123456"));
    }
}
