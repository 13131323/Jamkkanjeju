package com.jamkkanjeju.server.domain.map.support;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 지도 모달 테스트의 고정 장소·사용자·방명록 데이터이다. null ID는 통합 테스트에서 DB가 생성한다. */
public final class MapModalFixtures {
    public static final LocalDate DATE = LocalDate.of(2026, 10, 25);
    public static final LocalDateTime TIME = DATE.atTime(12, 0);

    private MapModalFixtures() { }

    /** 명시한 식별자와 이메일로 사용자를 준비한다. */
    public static User user(Long id, String email) {
        User user = User.builder().email(email).passwordHash("{test}").nickname("지도 작성자").point(17).build();
        org.springframework.test.util.ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    /** 좌표와 기본 정보가 고정된 장소를 준비한다. */
    public static Location location(Long id, long contentId) {
        return Location.builder().id(id).contentId(contentId).title("지도 테스트 장소").address("제주 테스트 주소")
                .category("관광지").radius(100).latitude(33.45).longitude(126.92).build();
    }

    /** AR 캐릭터 이미지와 구분되는 온보딩 프로필을 준비한다. */
    public static OnboardingResult onboarding() {
        return OnboardingResult.builder().userType("여행자").typeDescription("테스트 유형")
                .hashtags(List.of("여행")).profileImgUrl("https://example.com/profile.png").build();
    }

    /** 저장 날짜와 콘텐츠가 고정된 공통 방명록을 준비한다. */
    public static Guestbook guestbook(Long id, User user, GuestbookStatus status, LocalDate date) {
        return Guestbook.builder().id(id).user(user).status(status).visitedAt(date).savedAt(TIME)
                .contentImgUrl("https://example.com/photo.jpg").contentAudioUrl("https://example.com/audio.mp3")
                .contentWriting("제주 산책 기록").contentWeather("맑음").contentColorCode("#123456").build();
    }
}
